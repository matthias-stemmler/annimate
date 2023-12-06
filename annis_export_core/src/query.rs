use graphannis::{
    corpusstorage::{QueryLanguage, ResultOrder, SearchQuery},
    errors::GraphAnnisError,
    graph::Component,
    model::AnnotationComponentType,
    util::node_names_from_match,
};
use graphannis_core::{errors::GraphAnnisCoreError, types::AnnoKey};
use std::{
    collections::HashSet,
    iter::StepBy,
    ops::{Bound, RangeFrom},
    slice, vec,
};

const PAGE_SIZE: usize = 10;

#[derive(Clone, Copy)]
pub(crate) struct CorpusRef<'a> {
    storage: &'a graphannis::CorpusStorage,
    name: &'a str,
}

impl<'a> CorpusRef<'a> {
    pub(crate) fn new(storage: &'a graphannis::CorpusStorage, name: &'a str) -> Self {
        Self { storage, name }
    }
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Query<'a> {
    aql_query: &'a str,
    config: QueryConfig,
}

impl<'a> Query<'a> {
    pub(crate) fn new(aql_query: &'a str, config: QueryConfig) -> Self {
        Self { aql_query, config }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct QueryConfig {
    pub left_context: usize,
    pub right_context: usize,
}

pub(crate) struct MatchesPaginated<'a> {
    corpus_ref: CorpusRef<'a>,
    query: Query<'a>,
    offset_iter: StepBy<RangeFrom<usize>>,
}

impl<'a> MatchesPaginated<'a> {
    pub(crate) fn new(corpus_ref: CorpusRef<'a>, query: Query<'a>) -> Self {
        Self {
            corpus_ref,
            query,
            offset_iter: (0..).step_by(PAGE_SIZE),
        }
    }

    pub(crate) fn total_count(&self) -> Result<u64, GraphAnnisError> {
        self.corpus_ref.storage.count(self.search_query())
    }

    fn search_query(&'a self) -> SearchQuery<'a, &'a str> {
        SearchQuery {
            corpus_names: slice::from_ref(&self.corpus_ref.name),
            query: self.query.aql_query,
            query_language: QueryLanguage::AQL,
            timeout: None,
        }
    }
}

impl<'a> Iterator for MatchesPaginated<'a> {
    type Item = Result<MatchesPage<'a>, GraphAnnisError>;

    fn next(&mut self) -> Option<Self::Item> {
        let offset = self.offset_iter.next()?;
        let result = self.corpus_ref.storage.find(
            self.search_query(),
            offset,
            Some(PAGE_SIZE),
            ResultOrder::Normal,
        );

        match result {
            Ok(match_node_names) if match_node_names.is_empty() => None,
            Ok(match_ids) => Some(Ok(MatchesPage::new(
                self.corpus_ref,
                self.query.config,
                match_ids,
            ))),
            Err(err) => Some(Err(err)),
        }
    }
}

pub(crate) struct MatchesPage<'a> {
    corpus_ref: CorpusRef<'a>,
    query_config: QueryConfig,
    len: usize,
    match_ids_iter: vec::IntoIter<String>,
}

impl<'a> MatchesPage<'a> {
    fn new(corpus_ref: CorpusRef<'a>, query_config: QueryConfig, match_ids: Vec<String>) -> Self {
        Self {
            corpus_ref,
            query_config,
            len: match_ids.len(),
            match_ids_iter: match_ids.into_iter(),
        }
    }

    pub(crate) fn len(&self) -> usize {
        self.len
    }
}

impl Iterator for MatchesPage<'_> {
    type Item = Result<Match, GraphAnnisError>;

    fn next(&mut self) -> Option<Self::Item> {
        let match_id = self.match_ids_iter.next()?;
        let parts = get_parts(
            self.corpus_ref,
            match_id,
            self.query_config.left_context,
            self.query_config.right_context,
        );
        Some(parts.map(Match::from_parts))
    }
}

#[derive(Debug)]
pub(crate) struct Match {
    pub(crate) parts: Vec<MatchPart>,
}

impl Match {
    pub(crate) fn from_parts(parts: Vec<MatchPart>) -> Self {
        Self { parts }
    }

    pub(crate) fn match_token_count(&self) -> usize {
        self.parts
            .iter()
            .filter(|part| part.is_match_token())
            .count()
    }
}

#[derive(Debug)]
pub(crate) enum MatchPart {
    MatchToken(String),
    ContextToken(String),
    Gap,
}

impl MatchPart {
    fn is_match_token(&self) -> bool {
        matches!(self, MatchPart::MatchToken(..))
    }
}

fn get_parts(
    corpus_ref: CorpusRef<'_>,
    match_id: String,
    left_context: usize,
    right_context: usize,
) -> Result<Vec<MatchPart>, GraphAnnisError> {
    let match_node_names = node_names_from_match(&match_id);

    let subgraph = corpus_ref.storage.subgraph(
        corpus_ref.name,
        match_node_names.clone(),
        left_context,
        right_context,
        None,
    )?;

    // TODO make configurable?
    let component = Component::new(
        AnnotationComponentType::Ordering,
        "default_ns".into(),
        "tok_anno".into(),
    );

    let graphstorage =
        subgraph
            .get_graphstorage_as_ref(&component)
            .ok_or(GraphAnnisError::Core(
                GraphAnnisCoreError::MissingComponent(component.to_string()).into(),
            ))?;

    let mut seen_node_ids: HashSet<u64> = HashSet::new();
    let mut parts = Vec::new();

    let match_node_ids: Vec<_> = {
        let node_annos = subgraph.get_node_annos();
        match_node_names
            .into_iter()
            .map(|node_name| {
                node_annos
                    .get_node_id_from_name(&node_name)
                    .map_err(GraphAnnisError::from)
                    .and_then(|node_id| node_id.ok_or(GraphAnnisError::NoSuchNodeID(node_name)))
            })
            .collect::<Result<_, _>>()
    }?;

    for match_node_id in match_node_ids.iter().copied() {
        if seen_node_ids.contains(&match_node_id) {
            continue;
        }

        if !parts.is_empty() {
            parts.push(MatchPart::Gap);
        }

        let left_context_tokens = graphstorage
            .find_connected_inverse(match_node_id, 1, Bound::Unbounded)
            .collect::<Vec<_>>()
            .into_iter()
            .rev();

        let right_context_tokens = graphstorage.find_connected(match_node_id, 1, Bound::Unbounded);

        for node_id in left_context_tokens
            .chain(Some(Ok(match_node_id)))
            .chain(right_context_tokens)
        {
            let node_id = node_id?;
            seen_node_ids.insert(node_id);

            let token = subgraph
                .get_node_annos()
                .get_value_for_item(
                    &node_id,
                    // TODO: Make configurable?
                    &AnnoKey {
                        name: "tok_anno".into(),
                        ns: "default_ns".into(),
                    },
                )?
                .unwrap() // TODO handle error
                .to_string();

            parts.push(if match_node_ids.contains(&node_id) {
                MatchPart::MatchToken(token)
            } else {
                MatchPart::ContextToken(token)
            });
        }
    }

    Ok(parts)
}
