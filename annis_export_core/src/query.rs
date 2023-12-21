use graphannis::{
    corpusstorage::{QueryLanguage, ResultOrder, SearchQuery},
    errors::GraphAnnisError,
    graph::{Component, GraphStorage},
    model::AnnotationComponentType,
    util::node_names_from_match,
    Graph,
};
use graphannis_core::{
    errors::GraphAnnisCoreError,
    graph::{ANNIS_NS, DEFAULT_NS},
    types::{AnnoKey, NodeID},
};
use std::{
    collections::{HashMap, HashSet},
    iter::{successors, StepBy},
    ops::{Bound, RangeFrom},
    slice,
    sync::OnceLock,
    vec,
};

use crate::error::AnnisExportError;

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
            query_language: QueryLanguage::AQLQuirksV3,
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
    type Item = Result<Match, AnnisExportError>;

    fn next(&mut self) -> Option<Self::Item> {
        let match_id = self.match_ids_iter.next()?;
        Some(self.match_id_to_match(match_id))
    }
}

impl MatchesPage<'_> {
    fn match_id_to_match(&self, match_id: String) -> Result<Match, AnnisExportError> {
        let match_node_names = node_names_from_match(&match_id);

        Ok(Match {
            doc_name: get_doc_name(&match_node_names[0]).into(),
            parts: get_parts(
                self.corpus_ref,
                match_node_names,
                self.query_config.left_context,
                self.query_config.right_context,
            )?,
        })
    }
}

#[derive(Debug)]
pub(crate) struct Match {
    // TODO add metadata, also take doc_name from metadata
    pub(crate) doc_name: String,
    pub(crate) parts: Vec<MatchPart>,
}

#[derive(Debug)]
pub(crate) enum MatchPart {
    Match(Vec<String>),
    Context(Vec<String>),
    Gap,
}

fn get_doc_name(node_name: &str) -> &str {
    match node_name.rsplit_once('#') {
        Some((doc_name, _)) => doc_name,
        None => node_name,
    }
}

fn get_parts(
    corpus_ref: CorpusRef<'_>,
    match_node_names: Vec<String>,
    left_context: usize,
    right_context: usize,
) -> Result<Vec<MatchPart>, AnnisExportError> {
    #[derive(Debug)]
    struct Chain {
        node_ids: Vec<NodeID>,
        next_chain_id: Option<NodeID>,
    }

    // TODO make configurable
    let segmentation = String::from("tok_dipl");
    let anno_key = AnnoKey {
        ns: DEFAULT_NS.into(),
        name: "tok_anno".into(),
    };

    let subgraph = corpus_ref.storage.subgraph(
        corpus_ref.name,
        match_node_names.clone(),
        left_context,
        right_context,
        Some(segmentation.clone()),
    )?;

    let graph_helper = GraphHelper::new(&subgraph)?;

    let order_storage = {
        let component = Component::new(
            AnnotationComponentType::Ordering,
            DEFAULT_NS.into(),
            segmentation.into(),
        );

        subgraph
            .get_graphstorage_as_ref(&component)
            .ok_or_else(|| GraphAnnisCoreError::MissingComponent(component.to_string()))?
    };

    let gap_storage = {
        let component = Component::new(
            AnnotationComponentType::Ordering,
            ANNIS_NS.into(),
            "datasource-gap".into(),
        );

        subgraph.get_graphstorage_as_ref(&component)
    };

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

    let mut seen_node_ids = HashSet::<NodeID>::new();
    let mut chains = HashMap::new();
    let mut chain_ids_with_predecessor = HashSet::new();

    for &match_node_id in match_node_ids.iter() {
        if seen_node_ids.contains(&match_node_id) {
            continue;
        }

        let left_context_tokens = order_storage
            .find_connected_inverse(match_node_id, 1, Bound::Unbounded)
            .collect::<Vec<_>>()
            .into_iter()
            .rev();

        let right_context_tokens = order_storage.find_connected(match_node_id, 1, Bound::Unbounded);

        let node_ids: Vec<_> = left_context_tokens
            .chain(Some(Ok(match_node_id)))
            .chain(right_context_tokens)
            .collect::<Result<_, _>>()?;

        seen_node_ids.extend(&node_ids);

        let first_node_id = node_ids.first().unwrap();
        let last_node_id = node_ids.last().unwrap();

        let chain_id = graph_helper
            .get_first_covered_token_id(*first_node_id)?
            .ok_or_else(|| AnnisExportError::CoveredNodeNotFound(*first_node_id))?;

        let next_chain_id = if let Some(gap_storage) = gap_storage {
            gap_storage
                .get_outgoing_edges(
                    graph_helper
                        .get_last_covered_token_id(*last_node_id)?
                        .ok_or_else(|| AnnisExportError::CoveredNodeNotFound(*last_node_id))?,
                )
                .next()
                .transpose()?
        } else {
            None
        };

        chains.insert(
            chain_id,
            Chain {
                node_ids,
                next_chain_id,
            },
        );

        if let Some(next_chain_id) = next_chain_id {
            chain_ids_with_predecessor.insert(next_chain_id);
        }
    }

    let first_chain = {
        let &id = chains
            .keys()
            .find(|chain_id| !chain_ids_with_predecessor.contains(chain_id))
            .unwrap();

        chains.remove(&id).unwrap()
    };

    let chains_in_order = successors(Some(first_chain), |chain| {
        chain.next_chain_id.map(|id| chains.remove(&id)).flatten()
    });

    let mut parts = Vec::new();

    for chain in chains_in_order {
        if !parts.is_empty() {
            parts.push(MatchPart::Gap);
        }

        for node_id in chain.node_ids {
            let token = node_annos
                .get_value_for_item(&node_id, &anno_key)?
                .unwrap() // TODO handle error
                .to_string();

            parts.push(if match_node_ids.contains(&node_id) {
                MatchPart::Match(vec![token])
            } else {
                MatchPart::Context(vec![token])
            });
        }
    }

    Ok(parts)
}

struct GraphHelper<'a> {
    graph: &'a Graph<AnnotationComponentType>,
    coverage_component_storages: Vec<&'a dyn GraphStorage>,
    ordering_component_storage: &'a dyn GraphStorage,
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

        let ordering_component_storage = {
            let component = Component::new(
                AnnotationComponentType::Ordering,
                ANNIS_NS.into(),
                "".into(),
            );

            graph
                .get_graphstorage_as_ref(&component)
                .ok_or_else(|| GraphAnnisCoreError::MissingComponent(component.to_string()))?
        };

        Ok(Self {
            graph,
            coverage_component_storages,
            ordering_component_storage,
        })
    }

    fn get_first_covered_token_id(
        &self,
        node_id: NodeID,
    ) -> Result<Option<NodeID>, GraphAnnisError> {
        if self.is_token(node_id)? {
            return Ok(Some(node_id));
        }

        for storage in &self.coverage_component_storages {
            for covered_node_id in storage.get_outgoing_edges(node_id) {
                let covered_node_id = covered_node_id?;

                for s in &self.coverage_component_storages {
                    dbg!((
                        node_id,
                        covered_node_id,
                        s.get_ingoing_edges(covered_node_id).collect::<Vec<_>>()
                    ));
                }

                if self.is_token(covered_node_id)? {
                    return Ok(Some(
                        self.ordering_component_storage
                            .find_connected_inverse(covered_node_id, 0, Bound::Unbounded)
                            .last()
                            .unwrap()?,
                    ));
                }
            }
        }

        Ok(None)
    }

    fn get_last_covered_token_id(
        &self,
        node_id: NodeID,
    ) -> Result<Option<NodeID>, GraphAnnisError> {
        if self.is_token(node_id)? {
            return Ok(Some(node_id));
        }

        for storage in &self.coverage_component_storages {
            for covered_node_id in storage.get_outgoing_edges(node_id) {
                let covered_node_id = covered_node_id?;

                if self.is_token(covered_node_id)? {
                    return Ok(Some(
                        self.ordering_component_storage
                            .find_connected(covered_node_id, 0, Bound::Unbounded)
                            .last()
                            .unwrap()?,
                    ));
                }
            }
        }

        Ok(None)
    }

    fn is_token(&self, node_id: NodeID) -> Result<bool, GraphAnnisError> {
        Ok(self.has_token_anno(node_id)? && !self.has_outgoing_coverage_edges(node_id)?)
    }

    fn has_token_anno(&self, node_id: NodeID) -> Result<bool, GraphAnnisError> {
        Ok(self
            .graph
            .get_node_annos()
            .has_value_for_item(&node_id, token_key())?)
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

fn token_key() -> &'static AnnoKey {
    static TOKEN_KEY: OnceLock<AnnoKey> = OnceLock::new();

    TOKEN_KEY.get_or_init(|| AnnoKey {
        ns: ANNIS_NS.into(),
        name: "tok".into(),
    })
}
