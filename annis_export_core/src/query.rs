use graphannis::{
    corpusstorage::{QueryLanguage, ResultOrder, SearchQuery},
    errors::GraphAnnisError,
    util::node_names_from_match,
    AnnotationGraph,
};
use std::{
    iter::{Enumerate, StepBy},
    ops::RangeFrom,
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
            Ok(match_ids) if match_ids.is_empty() => None,
            Ok(match_ids) => Some(Ok(MatchesPage::new(
                self.corpus_ref,
                self.query.config,
                offset,
                match_ids,
            ))),
            Err(err) => Some(Err(err)),
        }
    }
}

pub(crate) struct MatchesPage<'a> {
    corpus_ref: CorpusRef<'a>,
    query_config: QueryConfig,
    offset: usize,
    len: usize,
    match_ids_iter: Enumerate<vec::IntoIter<String>>,
}

impl<'a> MatchesPage<'a> {
    fn new(
        corpus_ref: CorpusRef<'a>,
        query_config: QueryConfig,
        offset: usize,
        match_ids: Vec<String>,
    ) -> Self {
        Self {
            corpus_ref,
            query_config,
            offset,
            len: match_ids.len(),
            match_ids_iter: match_ids.into_iter().enumerate(),
        }
    }

    pub(crate) fn len(&self) -> usize {
        self.len
    }
}

impl Iterator for MatchesPage<'_> {
    type Item = Result<Match, GraphAnnisError>;

    fn next(&mut self) -> Option<Self::Item> {
        let (index, match_id) = self.match_ids_iter.next()?;
        let node_ids = node_names_from_match(&match_id);
        Some(
            self.corpus_ref
                .storage
                .subgraph(
                    self.corpus_ref.name,
                    node_ids,
                    self.query_config.left_context,
                    self.query_config.right_context,
                    None,
                )
                .map(|graph| Match::new(self.offset + index, graph)),
        )
    }
}

pub(crate) struct Match {
    index: usize,
    graph: AnnotationGraph,
}

impl Match {
    fn new(index: usize, graph: AnnotationGraph) -> Self {
        Self { index, graph }
    }

    pub(crate) fn index(&self) -> usize {
        self.index
    }
}
