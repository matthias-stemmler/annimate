use crate::{
    anno::{
        default_ordering_component, gap_ordering_component, get_anno_key_for_segmentation,
        token_anno_key,
    },
    corpus::CorpusRef,
    error::AnnisExportError,
    node_name,
    util::group_by,
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
use std::{
    collections::{HashMap, HashSet},
    iter::{self, successors, StepBy},
    ops::{Bound, RangeFrom},
    vec,
};

pub use graphannis::corpusstorage::QueryLanguage;

const PAGE_SIZE: usize = 10;

#[derive(Debug)]
pub enum ExportData {
    DocName,
    Text(ExportDataText),
}

#[derive(Debug)]
pub struct ExportDataText {
    pub left_context: usize,
    pub right_context: usize,
}

impl ExportDataText {
    pub(crate) fn has_left_context(&self) -> bool {
        self.left_context > 0
    }

    pub(crate) fn has_right_context(&self) -> bool {
        self.right_context > 0
    }
}

#[derive(Clone, Debug)]
pub(crate) struct Query<'a> {
    pub(crate) aql_query: &'a str,
    pub(crate) config: QueryConfig,
}

impl<'a> Query<'a> {
    pub(crate) fn new(aql_query: &'a str, config: QueryConfig) -> Self {
        Self { aql_query, config }
    }
}

#[derive(Clone, Debug, Default)]
pub struct QueryConfig {
    pub left_context: usize,
    pub right_context: usize,
    pub query_language: QueryLanguage,
    pub segmentation: Option<String>,
}

pub(crate) struct MatchesPaginated<'a, S> {
    corpus_ref: CorpusRef<'a, S>,
    query: Query<'a>,
    fragment_anno_key: AnnoKey,
}

impl<S> Clone for MatchesPaginated<'_, S> {
    fn clone(&self) -> Self {
        Self {
            corpus_ref: self.corpus_ref,
            query: self.query.clone(),
            fragment_anno_key: self.fragment_anno_key.clone(),
        }
    }
}

impl<'a, S> MatchesPaginated<'a, S>
where
    S: AsRef<str>,
{
    pub(crate) fn new(
        corpus_ref: CorpusRef<'a, S>,
        query: Query<'a>,
    ) -> Result<Self, AnnisExportError> {
        let fragment_anno_key =
            get_anno_key_for_segmentation(corpus_ref, query.config.segmentation.as_deref())?;

        Ok(Self {
            corpus_ref,
            query,
            fragment_anno_key,
        })
    }

    pub(crate) fn total_count(&self) -> Result<u64, GraphAnnisError> {
        self.corpus_ref.storage.count(self.search_query())
    }

    fn search_query(&'a self) -> SearchQuery<'a, S> {
        SearchQuery {
            corpus_names: self.corpus_ref.names,
            query: self.query.aql_query,
            query_language: self.query.config.query_language,
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
            Ok(match_ids) => Some(Ok(MatchesPage::new(
                self.matches_paginated.corpus_ref,
                self.matches_paginated.query.config.clone(),
                self.matches_paginated.fragment_anno_key.clone(),
                match_ids,
            ))),
            Err(err) => Some(Err(err)),
        }
    }
}

pub(crate) struct MatchesPage<'a, S> {
    corpus_ref: CorpusRef<'a, S>,
    query_config: QueryConfig,
    fragment_anno_key: AnnoKey,
    match_ids_iter: vec::IntoIter<String>,
}

impl<'a, S> MatchesPage<'a, S> {
    fn new(
        corpus_ref: CorpusRef<'a, S>,
        query_config: QueryConfig,
        fragment_anno_key: AnnoKey,
        match_ids: Vec<String>,
    ) -> Self {
        Self {
            corpus_ref,
            query_config,
            fragment_anno_key,
            match_ids_iter: match_ids.into_iter(),
        }
    }
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

        Ok(Match {
            doc_name: node_name::get_doc_name(&match_node_names[0]).into(),
            parts: get_parts(
                self.corpus_ref,
                match_node_names,
                self.query_config.left_context,
                self.query_config.right_context,
                self.query_config.segmentation.clone(),
                self.fragment_anno_key.clone(),
            )?,
        })
    }
}

#[derive(Debug, Clone)]
pub(crate) struct Match {
    // TODO add metadata, also take doc_name from metadata
    pub(crate) doc_name: String,
    pub(crate) parts: Vec<MatchPart>,
}

#[derive(Debug, Clone)]
pub(crate) enum MatchPart {
    Match {
        index: usize,
        fragments: Vec<String>,
    },
    Context {
        fragments: Vec<String>,
    },
    Gap,
}

impl MatchPart {
    pub(crate) fn is_match(&self) -> bool {
        matches!(self, MatchPart::Match { .. })
    }
}

fn get_parts<S>(
    corpus_ref: CorpusRef<S>,
    match_node_names: Vec<String>,
    left_context: usize,
    right_context: usize,
    segmentation: Option<String>,
    fragment_anno_key: AnnoKey,
) -> Result<Vec<MatchPart>, AnnisExportError> {
    #[derive(Debug)]
    struct Chain {
        token_ids: Vec<NodeID>,
        next_chain_id: Option<NodeID>,
    }

    let corpus_name = {
        let Some(node_name) = match_node_names.first() else {
            return Ok(Vec::new());
        };
        node_name::get_corpus_name(node_name)
    };

    let subgraph = corpus_ref.storage.subgraph(
        corpus_name,
        match_node_names.clone(),
        left_context,
        right_context,
        segmentation,
    )?;

    let graph_helper = GraphHelper::new(&subgraph)?;
    let order_storage = subgraph.get_graphstorage_as_ref(default_ordering_component());
    let gap_storage = subgraph.get_graphstorage_as_ref(gap_ordering_component());
    let node_annos = subgraph.get_node_annos();

    let match_node_ids: Vec<_> = {
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

    let mut seen_token_ids = HashSet::<NodeID>::new();
    let mut chains = HashMap::new();
    let mut chain_ids_with_predecessor = HashSet::new();

    for &match_node_id in match_node_ids.iter() {
        let Some(covered_token_id) = graph_helper.get_covered_token_id(match_node_id)? else {
            continue;
        };

        if seen_token_ids.contains(&covered_token_id) {
            continue;
        }

        let left_context_token_ids = order_storage.into_iter().flat_map(|s| {
            s.find_connected_inverse(covered_token_id, 1, Bound::Unbounded)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
        });

        let right_context_token_ids = order_storage
            .into_iter()
            .flat_map(|s| s.find_connected(covered_token_id, 1, Bound::Unbounded));

        let token_ids: Vec<_> = left_context_token_ids
            .chain(Some(Ok(covered_token_id)))
            .chain(right_context_token_ids)
            .collect::<Result<_, _>>()?;

        seen_token_ids.extend(&token_ids);

        let chain_id = *token_ids.first().unwrap();

        let next_chain_id = if let Some(gap_storage) = gap_storage {
            gap_storage
                .get_outgoing_edges(*token_ids.last().unwrap())
                .next()
                .transpose()?
        } else {
            None
        };

        chains.insert(
            chain_id,
            Chain {
                token_ids,
                next_chain_id,
            },
        );

        if let Some(next_chain_id) = next_chain_id {
            chain_ids_with_predecessor.insert(next_chain_id);
        }
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
            parts.push(MatchPart::Gap);
        }

        let get_fragment = |token_id: &NodeID| {
            graph_helper
                .get_covering_node_ids(*token_id)
                .find_map(|node_id| {
                    node_id
                        .and_then(|node_id| {
                            node_annos.get_value_for_item(&node_id, &fragment_anno_key)
                        })
                        .transpose()
                })
                .transpose()
        };

        for group in group_by(&chain.token_ids, get_fragment) {
            let (fragment, token_ids) = group?;
            let fragment = fragment.to_string();

            let match_node_index = token_ids
                .iter()
                .flat_map(|token_id| graph_helper.get_covering_node_ids(*token_id))
                .find_map(|node_id| {
                    node_id
                        .map(|node_id| {
                            match_node_ids
                                .iter()
                                .position(|&match_node_id| match_node_id == node_id)
                        })
                        .transpose()
                })
                .transpose()?;

            current_part = Some(match (current_part.take(), match_node_index) {
                (
                    Some(MatchPart::Match {
                        index,
                        mut fragments,
                    }),
                    Some(match_node_index),
                ) if index == match_node_index => MatchPart::Match {
                    index,
                    fragments: {
                        fragments.push(fragment);
                        fragments
                    },
                },
                (Some(MatchPart::Match { index, fragments }), Some(match_node_index)) => {
                    parts.push(MatchPart::Match { index, fragments });
                    MatchPart::Match {
                        index: match_node_index,
                        fragments: vec![fragment],
                    }
                }
                (Some(MatchPart::Match { index, fragments }), None) => {
                    parts.push(MatchPart::Match { index, fragments });
                    MatchPart::Context {
                        fragments: vec![fragment],
                    }
                }
                (Some(MatchPart::Context { fragments }), Some(match_node_index)) => {
                    parts.push(MatchPart::Context { fragments });
                    MatchPart::Match {
                        index: match_node_index,
                        fragments: vec![fragment],
                    }
                }
                (Some(MatchPart::Context { mut fragments }), None) => MatchPart::Context {
                    fragments: {
                        fragments.push(fragment);
                        fragments
                    },
                },
                (_, Some(index)) => MatchPart::Match {
                    index,
                    fragments: vec![fragment],
                },
                (_, None) => MatchPart::Context {
                    fragments: vec![fragment],
                },
            });
        }

        if let Some(part) = current_part.take() {
            parts.push(part);
        }
    }

    Ok(parts)
}

struct GraphHelper<'a> {
    graph: &'a Graph<AnnotationComponentType>,
    coverage_component_storages: Vec<&'a dyn GraphStorage>,
}

impl<'a> GraphHelper<'a> {
    fn new(graph: &'a Graph<AnnotationComponentType>) -> Result<Self, GraphAnnisError> {
        let coverage_component_storages = graph
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

        Ok(Self {
            graph,
            coverage_component_storages,
        })
    }

    fn get_covered_token_id(&self, node_id: NodeID) -> Result<Option<NodeID>, GraphAnnisError> {
        if self.is_token(node_id)? {
            return Ok(Some(node_id));
        }

        for storage in &self.coverage_component_storages {
            for covered_node_id in storage.get_outgoing_edges(node_id) {
                let covered_node_id = covered_node_id?;

                if self.is_token(covered_node_id)? {
                    return Ok(Some(covered_node_id));
                }
            }
        }

        Ok(None)
    }

    fn get_covering_node_ids(
        &self,
        node_id: NodeID,
    ) -> impl Iterator<Item = Result<NodeID, GraphAnnisCoreError>> + '_ {
        iter::once(Ok(node_id)).chain(
            self.coverage_component_storages
                .iter()
                .flat_map(move |&gs| gs.get_ingoing_edges(node_id)),
        )
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
        for storage in &self.coverage_component_storages {
            if storage.has_outgoing_edges(node_id)? {
                return Ok(true);
            }
        }

        Ok(false)
    }
}
