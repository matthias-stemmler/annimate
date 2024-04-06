use crate::{
    anno::{
        self, default_ordering_component, gap_ordering_component, get_anno_key_for_segmentation,
        token_anno_key,
    },
    aql,
    corpus::CorpusRef,
    error::AnnisExportError,
    node_name::{self, node_name_to_node_id},
    util::group_by,
    QueryNode,
};
use graphannis::{
    corpusstorage::{ResultOrder, SearchQuery},
    errors::GraphAnnisError,
    graph::GraphStorage,
    model::AnnotationComponentType,
    util::node_names_from_match,
    Graph,
};
use graphannis_core::{
    errors::GraphAnnisCoreError,
    types::{AnnoKey, NodeID},
};
use itertools::Itertools;
use std::{
    collections::{HashMap, HashSet},
    iter::{self, successors, StepBy},
    ops::{Bound, RangeFrom},
    slice, vec,
};

pub use graphannis::corpusstorage::QueryLanguage;

const PAGE_SIZE: usize = 1000;

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub enum ExportData {
    Anno(ExportDataAnno),
    Text(ExportDataText),
}

impl ExportData {
    pub(crate) fn node_indices(&self) -> &[usize] {
        match self {
            ExportData::Anno(ExportDataAnno::MatchNode { index, .. }) => slice::from_ref(index),
            ExportData::Text(text) => text.primary_node_indices.as_deref().unwrap_or(&[]),
            _ => &[],
        }
    }
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub enum ExportDataAnno {
    Corpus { anno_key: AnnoKey },
    Document { anno_key: AnnoKey },
    MatchNode { anno_key: AnnoKey, index: usize },
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct ExportDataText {
    pub left_context: usize,
    pub right_context: usize,
    pub segmentation: Option<String>,
    pub primary_node_indices: Option<Vec<usize>>,
}

impl ExportDataText {
    pub(crate) fn has_left_context(&self) -> bool {
        self.left_context > 0
    }

    pub(crate) fn has_right_context(&self) -> bool {
        self.right_context > 0
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Match {
    pub(crate) annos: HashMap<ExportDataAnno, String>,
    pub(crate) texts: HashMap<ExportDataText, Vec<TextPart>>,
}

#[derive(Debug, Clone)]
pub(crate) enum TextPart {
    Match {
        index: usize,
        fragments: Vec<String>,
    },
    Context {
        fragments: Vec<String>,
    },
    Gap,
}

impl TextPart {
    pub(crate) fn is_match(&self) -> bool {
        matches!(self, TextPart::Match { .. })
    }
}

pub(crate) struct Query<'a, S> {
    corpus_ref: CorpusRef<'a, S>,
    aql_query: &'a str,
    query_language: QueryLanguage,
    nodes: Vec<Vec<QueryNode>>,
}

impl<'a, S> Query<'a, S> {
    pub(crate) fn new(
        corpus_ref: CorpusRef<'a, S>,
        aql_query: &'a str,
        query_language: QueryLanguage,
    ) -> Result<Self, GraphAnnisError> {
        Ok(Self {
            corpus_ref,
            aql_query,
            query_language,
            nodes: aql::query_nodes_valid(corpus_ref.storage, aql_query, query_language)?.into(),
        })
    }

    pub(crate) fn nodes(&self) -> &[Vec<QueryNode>] {
        &self.nodes
    }

    pub(crate) fn find<I>(
        &self,
        export_data: I,
    ) -> Result<ExportableMatches<'a, S>, AnnisExportError>
    where
        I: IntoIterator<Item = ExportData>,
        S: AsRef<str>,
    {
        let export_data: HashSet<_> = export_data.into_iter().collect();

        export_data
            .iter()
            .flat_map(ExportData::node_indices)
            .map(|&index| {
                let max_index = self.nodes.len() - 1;
                if index > max_index {
                    Err(AnnisExportError::MatchNodeIndexOutOfBounds { index, max_index })
                } else {
                    Ok(())
                }
            })
            .try_collect()?;

        ExportableMatches::new(
            self.corpus_ref,
            self.aql_query,
            self.query_language,
            export_data,
        )
    }
}

pub(crate) struct ExportableMatches<'a, S> {
    matches_paginated: MatchesPaginated<'a, S>,
    total_count: usize,
}

impl<S> Clone for ExportableMatches<'_, S> {
    fn clone(&self) -> Self {
        Self {
            matches_paginated: self.matches_paginated.clone(),
            total_count: self.total_count,
        }
    }
}

impl<'a, S> ExportableMatches<'a, S>
where
    S: AsRef<str>,
{
    fn new(
        corpus_ref: CorpusRef<'a, S>,
        aql_query: &'a str,
        query_language: QueryLanguage,
        export_data: HashSet<ExportData>,
    ) -> Result<Self, AnnisExportError> {
        let matches_paginated =
            MatchesPaginated::new(corpus_ref, aql_query, query_language, export_data)?;

        let total_count = {
            let total_count = matches_paginated.total_count()?;
            total_count
                .try_into()
                .map_err(|_| AnnisExportError::TooManyResults(total_count))?
        };

        Ok(Self {
            matches_paginated,
            total_count,
        })
    }

    pub(crate) fn total_count(&self) -> usize {
        self.total_count
    }
}

impl<'a, S> IntoIterator for ExportableMatches<'a, S>
where
    S: AsRef<str>,
{
    type Item = Result<Match, AnnisExportError>;
    type IntoIter = ExportableMatchesIter<'a, S>;

    fn into_iter(self) -> Self::IntoIter {
        ExportableMatchesIter {
            matches_paginated_iter: self.matches_paginated.into_iter(),
            matches_page: None,
            total_count: self.total_count,
        }
    }
}

pub(crate) struct ExportableMatchesIter<'a, S> {
    matches_paginated_iter: MatchesPaginatedIter<'a, S>,
    matches_page: Option<MatchesPage<'a, S>>,
    total_count: usize,
}

impl<S> Iterator for ExportableMatchesIter<'_, S>
where
    S: AsRef<str>,
{
    type Item = Result<Match, AnnisExportError>;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if self.matches_page.is_none() {
                self.matches_page = match self.matches_paginated_iter.next()? {
                    Ok(page) => Some(page),
                    Err(err) => return Some(Err(err.into())),
                };
            }

            if let Some(ref mut page) = &mut self.matches_page {
                match page.next() {
                    Some(m) => return Some(m),
                    None => self.matches_page = None,
                }
            }
        }
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        (self.total_count, Some(self.total_count))
    }
}

impl<S> ExactSizeIterator for ExportableMatchesIter<'_, S> where S: AsRef<str> {}

pub(crate) struct MatchesPaginated<'a, S> {
    corpus_ref: CorpusRef<'a, S>,
    aql_query: &'a str,
    query_language: QueryLanguage,
    export_data: HashSet<ExportData>,
    fragment_anno_keys: HashMap<Option<String>, AnnoKey>,
}

impl<S> Clone for MatchesPaginated<'_, S> {
    fn clone(&self) -> Self {
        Self {
            corpus_ref: self.corpus_ref,
            aql_query: self.aql_query,
            query_language: self.query_language,
            export_data: self.export_data.clone(),
            fragment_anno_keys: self.fragment_anno_keys.clone(),
        }
    }
}

impl<'a, S> MatchesPaginated<'a, S>
where
    S: AsRef<str>,
{
    pub(crate) fn new(
        corpus_ref: CorpusRef<'a, S>,
        aql_query: &'a str,
        query_language: QueryLanguage,
        export_data: HashSet<ExportData>,
    ) -> Result<Self, AnnisExportError> {
        let mut fragment_anno_keys = HashMap::new();

        for data in &export_data {
            if let ExportData::Text(text) = data {
                if !fragment_anno_keys.contains_key(&text.segmentation) {
                    fragment_anno_keys.insert(
                        text.segmentation.clone(),
                        get_anno_key_for_segmentation(corpus_ref, text.segmentation.as_deref())?,
                    );
                }
            }
        }

        Ok(Self {
            corpus_ref,
            aql_query,
            query_language,
            export_data,
            fragment_anno_keys,
        })
    }

    pub(crate) fn total_count(&self) -> Result<u64, GraphAnnisError> {
        self.corpus_ref.storage.count(self.search_query())
    }

    fn search_query(&'a self) -> SearchQuery<'a, S> {
        SearchQuery {
            corpus_names: self.corpus_ref.names,
            query: self.aql_query,
            query_language: self.query_language,
            timeout: None,
        }
    }
}

impl<'a, S> IntoIterator for MatchesPaginated<'a, S>
where
    S: AsRef<str>,
{
    type Item = Result<MatchesPage<'a, S>, GraphAnnisError>;
    type IntoIter = MatchesPaginatedIter<'a, S>;

    fn into_iter(self) -> Self::IntoIter {
        MatchesPaginatedIter {
            matches_paginated: self,
            offset_iter: (0..).step_by(PAGE_SIZE),
        }
    }
}

pub(crate) struct MatchesPaginatedIter<'a, S> {
    matches_paginated: MatchesPaginated<'a, S>,
    offset_iter: StepBy<RangeFrom<usize>>,
}

impl<'a, S> Iterator for MatchesPaginatedIter<'a, S>
where
    S: AsRef<str>,
{
    type Item = Result<MatchesPage<'a, S>, GraphAnnisError>;

    fn next(&mut self) -> Option<Self::Item> {
        let offset = self.offset_iter.next()?;
        let result = self.matches_paginated.corpus_ref.storage.find(
            self.matches_paginated.search_query(),
            offset,
            Some(PAGE_SIZE),
            ResultOrder::Normal,
        );

        match result {
            Ok(match_ids) if match_ids.is_empty() => None,
            Ok(match_ids) => Some(Ok(MatchesPage {
                corpus_ref: self.matches_paginated.corpus_ref,
                export_data: self.matches_paginated.export_data.clone(),
                fragment_anno_keys: self.matches_paginated.fragment_anno_keys.clone(),
                match_ids_iter: match_ids.into_iter(),
            })),
            Err(err) => Some(Err(err)),
        }
    }
}

pub(crate) struct MatchesPage<'a, S> {
    corpus_ref: CorpusRef<'a, S>,
    export_data: HashSet<ExportData>,
    fragment_anno_keys: HashMap<Option<String>, AnnoKey>,
    match_ids_iter: vec::IntoIter<String>,
}

impl<S> Iterator for MatchesPage<'_, S> {
    type Item = Result<Match, AnnisExportError>;

    fn next(&mut self) -> Option<Self::Item> {
        let match_id = self.match_ids_iter.next()?;
        Some(self.match_id_to_match(match_id))
    }
}

impl<S> MatchesPage<'_, S> {
    fn match_id_to_match(&self, match_id: String) -> Result<Match, AnnisExportError> {
        let match_node_names = node_names_from_match(&match_id);
        let first_node_name = match_node_names
            .first()
            .ok_or(AnnisExportError::MatchWithoutNodes)?;

        let corpus_name = node_name::get_corpus_name(first_node_name)?;
        let doc_name = node_name::get_doc_name(first_node_name);

        let mut annos = HashMap::new();
        let mut texts = HashMap::new();

        for d in &self.export_data {
            match d {
                ExportData::Anno(anno) => match anno {
                    ExportDataAnno::Corpus { anno_key } => {
                        if let Some(value) =
                            get_anno(self.corpus_ref.storage, &corpus_name, None, anno_key)?
                        {
                            annos.insert(anno.clone(), value);
                        }
                    }
                    ExportDataAnno::Document { anno_key } => {
                        if let Some(value) = get_anno(
                            self.corpus_ref.storage,
                            &corpus_name,
                            Some(doc_name),
                            anno_key,
                        )? {
                            annos.insert(anno.clone(), value);
                        }
                    }
                    ExportDataAnno::MatchNode { anno_key, index } => {
                        if let Some(value) = match_node_names
                            .get(*index)
                            .map(|node_name| {
                                get_anno_with_overlapping_coverage(
                                    self.corpus_ref.storage,
                                    &corpus_name,
                                    node_name,
                                    anno_key,
                                )
                            })
                            .transpose()?
                            .flatten()
                        {
                            annos.insert(anno.clone(), value);
                        }
                    }
                },
                ExportData::Text(text) => {
                    texts.insert(
                        text.clone(),
                        get_parts(
                            self.corpus_ref.storage,
                            &corpus_name,
                            match_node_names.clone(),
                            text,
                            self.fragment_anno_keys.get(&text.segmentation).unwrap(),
                        )?,
                    );
                }
            }
        }

        Ok(Match { annos, texts })
    }
}

fn get_anno(
    storage: &graphannis::CorpusStorage,
    corpus_name: &str,
    node_name: Option<&str>,
    anno_key: &AnnoKey,
) -> Result<Option<String>, GraphAnnisError> {
    let graph = match node_name {
        Some(node_name) => storage.subgraph(corpus_name, vec![node_name.into()], 0, 0, None)?,
        None => storage.corpus_graph(corpus_name)?,
    };

    let node_id = node_name_to_node_id(&graph, node_name.unwrap_or(corpus_name))?;

    anno::get_anno(&graph, node_id, anno_key)
}

fn get_anno_with_overlapping_coverage(
    storage: &graphannis::CorpusStorage,
    corpus_name: &str,
    node_name: &str,
    anno_key: &AnnoKey,
) -> Result<Option<String>, GraphAnnisError> {
    let graph = storage.subgraph(corpus_name, vec![node_name.into()], 0, 0, None)?;
    let node_id = node_name_to_node_id(&graph, node_name)?;

    if let Some(anno) = anno::get_anno(&graph, node_id, anno_key)? {
        return Ok(Some(anno));
    }

    let graph_helper = GraphHelper::new(&graph)?;

    let Some(covered_token_id) = graph_helper.get_covered_token_id(node_id)? else {
        return Ok(None);
    };

    for token_id in graph_helper.get_connected_node_ids_in_order(covered_token_id) {
        for node_id in graph_helper.get_covering_node_ids(token_id?) {
            if let Some(anno) = anno::get_anno(&graph, node_id?, anno_key)? {
                return Ok(Some(anno));
            }
        }
    }

    Ok(None)
}

fn get_parts(
    storage: &graphannis::CorpusStorage,
    corpus_name: &str,
    match_node_names: Vec<String>,
    export_data: &ExportDataText,
    fragment_anno_key: &AnnoKey,
) -> Result<Vec<TextPart>, AnnisExportError> {
    #[derive(Debug)]
    struct Chain {
        token_ids: Vec<NodeID>,
        next_chain_id: Option<NodeID>,
    }

    let ExportDataText {
        left_context,
        right_context,
        segmentation,
        primary_node_indices,
    } = export_data;

    let primary_node_indices = primary_node_indices
        .clone()
        .unwrap_or_else(|| (0..match_node_names.len()).collect());

    let subgraph = storage.subgraph(
        corpus_name,
        match_node_names.clone(),
        *left_context,
        *right_context,
        segmentation.clone(),
    )?;

    let graph_helper = GraphHelper::new(&subgraph)?;
    let gap_storage = subgraph.get_graphstorage_as_ref(gap_ordering_component());
    let node_annos = subgraph.get_node_annos();

    let match_node_ids: Vec<_> = match_node_names
        .into_iter()
        .map(|node_name| node_name_to_node_id(&subgraph, &node_name))
        .try_collect()?;

    let mut seen_token_ids = HashSet::<NodeID>::new();
    let mut chains = HashMap::new();
    let mut chain_ids_with_predecessor = HashSet::new();

    for &match_node_id in &match_node_ids {
        let Some(token_id) = graph_helper.get_covered_token_id(match_node_id)? else {
            continue;
        };

        if seen_token_ids.contains(&token_id) {
            continue;
        }

        let token_ids: Vec<_> = graph_helper
            .get_connected_node_ids_in_order(token_id)
            .try_collect()?;

        seen_token_ids.extend(&token_ids);

        let chain_id = *token_ids.first().unwrap();

        let next_chain_id = gap_storage
            .and_then(|gs| gs.get_outgoing_edges(*token_ids.last().unwrap()).next())
            .transpose()?;

        if let Some(next_chain_id) = next_chain_id {
            chain_ids_with_predecessor.insert(next_chain_id);
        }

        chains.insert(
            chain_id,
            Chain {
                token_ids,
                next_chain_id,
            },
        );
    }

    let first_chain = chains
        .keys()
        .find(|id| !chain_ids_with_predecessor.contains(id))
        .copied()
        .and_then(|id| chains.remove(&id));

    let chains_in_order = successors(first_chain, |chain| {
        chain.next_chain_id.and_then(|id| chains.remove(&id))
    });

    let mut parts = Vec::new();
    let mut current_part = None;

    for chain in chains_in_order {
        if !parts.is_empty() {
            parts.push(TextPart::Gap);
        }

        let get_fragment_node_id = |token_id: &NodeID| {
            graph_helper
                .get_covering_node_ids(*token_id)
                .find_map(|node_id| {
                    node_id
                        .and_then(|node_id| {
                            node_annos
                                .has_value_for_item(&node_id, fragment_anno_key)
                                .map(|has_fragment| has_fragment.then_some(node_id))
                        })
                        .transpose()
                })
                .transpose()
        };

        for group in group_by(&chain.token_ids, get_fragment_node_id) {
            let (fragment_node_id, token_ids) = group?;
            let fragment = node_annos
                .get_value_for_item(&fragment_node_id, fragment_anno_key)?
                .expect("Value is present by choice of fragment_node_id")
                .to_string();

            let match_node_index = primary_node_indices
                .clone()
                .into_iter()
                .cartesian_product(token_ids.iter())
                .find_map(|(node_index, &token_id)| {
                    graph_helper
                        .is_covering_node_id(match_node_ids[node_index], token_id)
                        .map(|is_covering| is_covering.then_some(node_index))
                        .transpose()
                })
                .transpose()?;

            current_part = Some(match (current_part.take(), match_node_index) {
                (
                    Some(TextPart::Match {
                        index,
                        mut fragments,
                    }),
                    Some(match_node_index),
                ) if index == match_node_index => TextPart::Match {
                    index,
                    fragments: {
                        fragments.push(fragment);
                        fragments
                    },
                },
                (Some(TextPart::Match { index, fragments }), Some(match_node_index)) => {
                    parts.push(TextPart::Match { index, fragments });
                    TextPart::Match {
                        index: match_node_index,
                        fragments: vec![fragment],
                    }
                }
                (Some(TextPart::Match { index, fragments }), None) => {
                    parts.push(TextPart::Match { index, fragments });
                    TextPart::Context {
                        fragments: vec![fragment],
                    }
                }
                (Some(TextPart::Context { fragments }), Some(match_node_index)) => {
                    parts.push(TextPart::Context { fragments });
                    TextPart::Match {
                        index: match_node_index,
                        fragments: vec![fragment],
                    }
                }
                (Some(TextPart::Context { mut fragments }), None) => TextPart::Context {
                    fragments: {
                        fragments.push(fragment);
                        fragments
                    },
                },
                (_, Some(index)) => TextPart::Match {
                    index,
                    fragments: vec![fragment],
                },
                (_, None) => TextPart::Context {
                    fragments: vec![fragment],
                },
            });
        }

        if let Some(part) = current_part.take() {
            parts.push(part);
        }
    }

    if !chains.is_empty() {
        return Err(AnnisExportError::FailedToOrderChains);
    }

    Ok(parts)
}

struct GraphHelper<'a> {
    graph: &'a Graph<AnnotationComponentType>,
    coverage_storages: Vec<&'a dyn GraphStorage>,
    order_storage: Option<&'a dyn GraphStorage>,
}

impl<'a> GraphHelper<'a> {
    fn new(graph: &'a Graph<AnnotationComponentType>) -> Result<Self, GraphAnnisError> {
        let coverage_storages = graph
            .get_all_components(Some(AnnotationComponentType::Coverage), None)
            .into_iter()
            .filter_map(|c| graph.get_graphstorage_as_ref(&c))
            .filter(|gs| {
                if let Some(stats) = gs.get_statistics() {
                    stats.nodes > 0
                } else {
                    true
                }
            })
            .collect();

        let order_storage = graph.get_graphstorage_as_ref(default_ordering_component());

        Ok(Self {
            graph,
            coverage_storages,
            order_storage,
        })
    }

    fn get_covered_token_id(&self, node_id: NodeID) -> Result<Option<NodeID>, GraphAnnisError> {
        if self.is_token(node_id)? {
            return Ok(Some(node_id));
        }

        for storage in &self.coverage_storages {
            for covered_node_id in storage.get_outgoing_edges(node_id) {
                let covered_node_id = covered_node_id?;

                if self.is_token(covered_node_id)? {
                    return Ok(Some(covered_node_id));
                }
            }
        }

        Ok(None)
    }

    fn get_connected_node_ids_in_order(
        &self,
        node_id: NodeID,
    ) -> impl Iterator<Item = Result<NodeID, GraphAnnisCoreError>> + '_ {
        let left_connected_node_ids = self.order_storage.into_iter().flat_map(move |s| {
            s.find_connected_inverse(node_id, 1, Bound::Unbounded)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
        });

        let right_connected_node_ids = self
            .order_storage
            .into_iter()
            .flat_map(move |s| s.find_connected(node_id, 1, Bound::Unbounded));

        left_connected_node_ids
            .chain(Some(Ok(node_id)))
            .chain(right_connected_node_ids)
    }

    fn get_covering_node_ids(
        &self,
        node_id: NodeID,
    ) -> impl Iterator<Item = Result<NodeID, GraphAnnisCoreError>> + '_ {
        iter::once(Ok(node_id)).chain(
            self.coverage_storages
                .iter()
                .flat_map(move |&gs| gs.get_ingoing_edges(node_id)),
        )
    }

    fn is_covering_node_id(
        &self,
        source: NodeID,
        target: NodeID,
    ) -> Result<bool, GraphAnnisCoreError> {
        self.coverage_storages
            .iter()
            .map(|gs| gs.is_connected(source, target, 0, Bound::Included(1)))
            .fold_ok(false, |a, b| a || b)
    }

    fn is_token(&self, node_id: NodeID) -> Result<bool, GraphAnnisError> {
        Ok(self.has_token_anno(node_id)? && !self.has_outgoing_coverage_edges(node_id)?)
    }

    fn has_token_anno(&self, node_id: NodeID) -> Result<bool, GraphAnnisError> {
        Ok(self
            .graph
            .get_node_annos()
            .has_value_for_item(&node_id, token_anno_key())?)
    }

    fn has_outgoing_coverage_edges(&self, node_id: NodeID) -> Result<bool, GraphAnnisError> {
        for storage in &self.coverage_storages {
            if storage.has_outgoing_edges(node_id)? {
                return Ok(true);
            }
        }

        Ok(false)
    }
}
