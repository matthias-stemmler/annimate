use std::collections::{HashMap, HashSet};
use std::ops::Bound;
use std::{iter, slice, vec};

pub use graphannis::corpusstorage::QueryLanguage;
use graphannis::corpusstorage::{ResultOrder, SearchQuery};
use graphannis::errors::GraphAnnisError;
use graphannis::graph::GraphStorage;
use graphannis::model::AnnotationComponentType;
use graphannis::{CorpusStorage, Graph, util};
use graphannis_core::errors::GraphAnnisCoreError;
use graphannis_core::graph::DEFAULT_NS;
use graphannis_core::types::{AnnoKey, NodeID};
use itertools::Itertools;
use rayon::prelude::*;

use crate::anno::{
    self, DEFAULT_ORDERING_COMPONENT, GAP_ORDERING_COMPONENT, TOKEN_ANNO_KEY,
    get_anno_key_for_segmentation,
};
use crate::cache::CacheStorage;
use crate::error::{self, AnnimateError};
use crate::util::group_by;
use crate::{QueryNode, aql, name};

/// Configuration of data of a match to be exported.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub enum ExportData {
    /// An annotation of a node related to the match (single column).
    Anno(ExportDataAnno),

    /// Text of the match ("Match in context", possibly multiple columns).
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

/// Configuration of an annotation of a node related to a match to be exported.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub enum ExportDataAnno {
    /// Annotation of the corpus the match belongs to.
    Corpus {
        /// Key of the annotation.
        anno_key: AnnoKey,
    },
    /// Annotation of the document the match belongs to.
    Document {
        /// Key of the annotation.
        anno_key: AnnoKey,
    },
    /// Annotation of one of the match nodes.
    MatchNode {
        /// Key of the annotation.
        anno_key: AnnoKey,

        /// Index of the matched node within the match.
        ///
        /// If the query matches multiple nodes, this specifies the index of the node for which to
        /// export the annotation.
        index: usize,
    },
}

/// Configuration of the text of a match to be exported.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub struct ExportDataText {
    /// Size of the left context, in segmentation nodes.
    pub left_context: usize,

    /// Size of the right context, in segmentation nodes.
    pub right_context: usize,

    /// Segmentation to use, or [None] to use tokens.
    pub segmentation: Option<String>,

    /// Indices of primary query nodes, or [None] to treat all query nodes as primary.
    ///
    /// This specifies which of the query nodes are *primary*. A node is primary if text parts
    /// belonging to it count as a match and thus produce a match column in the export.
    ///
    /// This is useful in case the query contains nodes that are needed for the search but are not
    /// supposed to count as a match in the export, e.g. when doing a tree search.
    ///
    /// The list also specifies a priority among the primary query nodes: If a text part belongs to
    /// multiple primary query nodes, it is treated as belonging to the first one of them in the
    /// list.
    pub primary_node_indices: Option<Vec<usize>>,
}

#[derive(Debug, Clone)]
pub(crate) struct Match {
    pub(crate) annos: HashMap<ExportDataAnno, String>,
    pub(crate) texts: HashMap<ExportDataText, Vec<TextPart>>,
}

#[derive(Debug, Clone)]
pub(crate) enum TextPart {
    Match { index: usize, segments: Vec<String> },
    Context { segments: Vec<String> },
    Gap,
}

impl TextPart {
    pub(crate) fn is_match(&self) -> bool {
        matches!(self, TextPart::Match { .. })
    }
}

pub(crate) struct Query<'a, S> {
    corpus_storage: &'a CorpusStorage,
    cache_storage: &'a CacheStorage,
    corpus_names: &'a [S],
    aql_query: &'a str,
    query_language: QueryLanguage,
    nodes: Vec<Vec<QueryNode>>,
}

impl<'a, S> Query<'a, S> {
    pub(crate) fn new(
        corpus_storage: &'a CorpusStorage,
        cache_storage: &'a CacheStorage,
        corpus_names: &'a [S],
        aql_query: &'a str,
        query_language: QueryLanguage,
    ) -> Result<Self, GraphAnnisError> {
        Ok(Self {
            corpus_storage,
            cache_storage,
            corpus_names,
            aql_query,
            query_language,
            nodes: aql::query_nodes_valid(corpus_storage, aql_query, query_language)?.into(),
        })
    }

    pub(crate) fn nodes(&self) -> &[Vec<QueryNode>] {
        &self.nodes
    }

    pub(crate) fn find<F, G, I>(
        &self,
        export_data: I,
        mut on_corpora_searched: F,
        cancel_requested: G,
    ) -> Result<impl IndexedParallelIterator<Item = Result<Match, AnnimateError>>, AnnimateError>
    where
        F: FnMut(usize),
        G: Fn() -> bool,
        I: IntoIterator<Item = ExportData>,
        S: AsRef<str> + Sync,
    {
        let export_data: HashSet<_> = export_data.into_iter().collect();

        export_data
            .iter()
            .flat_map(ExportData::node_indices)
            .map(|&index| {
                let max_index = self.nodes.len() - 1;
                if index > max_index {
                    Err(AnnimateError::MatchNodeIndexOutOfBounds { index, max_index })
                } else {
                    Ok(())
                }
            })
            .try_collect::<_, (), _>()?;

        let mut segment_anno_keys = HashMap::new();

        for data in &export_data {
            if let ExportData::Text(text) = data
                && !segment_anno_keys.contains_key(&text.segmentation)
            {
                segment_anno_keys.insert(
                    text.segmentation.clone(),
                    get_anno_key_for_segmentation(
                        self.corpus_storage,
                        self.cache_storage,
                        self.corpus_names,
                        text.segmentation.as_deref(),
                    )?,
                );
            }
        }

        // We iterate over the corpus names ourselves instead of calling `CorpusStorage::find` with
        // the list of all corpus names, so we know which corpus each match belongs to. Otherwise
        // (and this is what ANNIS itself does) we would have to rely on the corpus name being equal
        // (up to URL encoding) to the first part of each match node name. While this is usually the
        // case, not relying on this assumption enables us to import a corpus under a different name
        // than its intrinsic name, which can happen, for instance, when a .graphml file is renamed.
        let corpus_names = {
            let mut corpus_names: Vec<_> = self.corpus_names.iter().map(|s| s.as_ref()).collect();
            // Sort in the same order as graphANNIS does when `ResultOrder::Normal` is used
            corpus_names.sort();
            corpus_names
        };

        let corpus_count = corpus_names.len();
        let mut match_ids = Vec::new();

        for (corpus_index, corpus_name) in corpus_names.into_iter().enumerate() {
            error::cancel_if(&cancel_requested)?;
            on_corpora_searched(corpus_index);

            match_ids.extend(
                self.corpus_storage
                    .find(
                        SearchQuery {
                            corpus_names: &[corpus_name],
                            query: self.aql_query,
                            query_language: self.query_language,
                            timeout: None,
                        },
                        0,
                        None,
                        ResultOrder::Normal,
                    )?
                    .into_iter()
                    .map(|match_id| (match_id, corpus_name)),
            );
        }

        error::cancel_if(&cancel_requested)?;
        on_corpora_searched(corpus_count);

        Ok(match_ids
            .into_par_iter()
            .map(move |(match_id, corpus_name)| {
                let match_node_names = util::node_names_from_match(&match_id);
                let first_match_node_name = match_node_names
                    .first()
                    .ok_or(AnnimateError::MatchWithoutNodes)?;

                let corpus_node_name = name::get_corpus_node_name(first_match_node_name)?;
                let doc_node_name = name::get_doc_node_name(first_match_node_name);

                let mut annos = HashMap::new();
                let mut texts = HashMap::new();

                for d in &export_data {
                    match d {
                        ExportData::Anno(anno) => match anno {
                            ExportDataAnno::Corpus { anno_key } => {
                                if let Some(value) = get_corpus_or_doc_anno(
                                    self.corpus_storage,
                                    corpus_name,
                                    &corpus_node_name,
                                    anno_key,
                                )? {
                                    annos.insert(anno.clone(), value);
                                }
                            }
                            ExportDataAnno::Document { anno_key } => {
                                if let Some(value) = get_corpus_or_doc_anno(
                                    self.corpus_storage,
                                    corpus_name,
                                    doc_node_name,
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
                                            self.corpus_storage,
                                            corpus_name,
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
                                    self.corpus_storage,
                                    corpus_name,
                                    match_node_names.clone(),
                                    text,
                                    segment_anno_keys.get(&text.segmentation).unwrap(),
                                )?,
                            );
                        }
                    }
                }

                Ok(Match { annos, texts })
            }))
    }
}

fn get_corpus_or_doc_anno(
    corpus_storage: &CorpusStorage,
    corpus_name: &str,
    node_name: &str,
    anno_key: &AnnoKey,
) -> Result<Option<String>, GraphAnnisError> {
    // Short-circuit when asked for `annis:node_name`
    // This helps in case of broken corpora with missing document nodes,
    // because one can at least export what their node names would have been
    if anno::is_node_name_anno_key(anno_key) {
        return Ok(Some(node_name.into()));
    }

    let graph = corpus_storage.corpus_graph(corpus_name)?;
    let node_id = name::node_name_to_node_id(&graph, node_name)?;
    anno::get_anno(&graph, node_id, anno_key)
}

fn get_anno_with_overlapping_coverage(
    corpus_storage: &CorpusStorage,
    corpus_name: &str,
    node_name: &str,
    anno_key: &AnnoKey,
) -> Result<Option<String>, GraphAnnisError> {
    let graph = corpus_storage.subgraph(corpus_name, vec![node_name.into()], 0, 0, None)?;
    let node_id = name::node_name_to_node_id(&graph, node_name)?;

    if let Some(anno) = anno::get_anno(&graph, node_id, anno_key)? {
        return Ok(Some(anno));
    }

    let graph_helper = GraphHelper::new(&graph);

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
    corpus_storage: &CorpusStorage,
    corpus_name: &str,
    match_node_names: Vec<String>,
    export_data: &ExportDataText,
    segment_anno_key: &AnnoKey,
) -> Result<Vec<TextPart>, AnnimateError> {
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

    let primary_node_indices: Vec<_> = {
        let valid_node_indices = 0..match_node_names.len();
        match primary_node_indices {
            Some(node_indices) => node_indices
                .iter()
                .filter(|&i| valid_node_indices.contains(i))
                .copied()
                .collect(),
            None => valid_node_indices.collect(),
        }
    };

    // The `subgraph` method assumes that there exists a component
    // Ordering/default_ns/<segmentation>. However, some corpora use segmentations with Ordering
    // component in a different layer. In that case, we pass `None`, causing the context to be
    // measured in tokens.
    let segmentation = match segmentation {
        Some(s)
            if corpus_storage
                .list_components(
                    corpus_name,
                    Some(AnnotationComponentType::Ordering),
                    Some(s),
                )?
                .into_iter()
                .any(|c| c.layer == DEFAULT_NS) =>
        {
            Some(s.clone())
        }
        _ => None,
    };

    let subgraph = corpus_storage.subgraph(
        corpus_name,
        match_node_names.clone(),
        *left_context,
        *right_context,
        segmentation,
    )?;

    let graph_helper = GraphHelper::new(&subgraph);
    let gap_storage = subgraph.get_graphstorage_as_ref(&GAP_ORDERING_COMPONENT);
    let node_annos = subgraph.get_node_annos();

    let match_node_ids: Vec<_> = match_node_names
        .into_iter()
        .map(|node_name| name::node_name_to_node_id(&subgraph, &node_name))
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

    let chains_in_order = iter::successors(first_chain, |chain| {
        chain.next_chain_id.and_then(|id| chains.remove(&id))
    });

    let mut parts = Vec::new();
    let mut current_part = None;

    for chain in chains_in_order {
        if !parts.is_empty() {
            parts.push(TextPart::Gap);
        }

        let get_segment_node_id = |token_id: &NodeID| {
            graph_helper
                .get_covering_node_ids(*token_id)
                .find_map(|node_id| {
                    node_id
                        .and_then(|node_id| {
                            node_annos
                                .has_value_for_item(&node_id, segment_anno_key)
                                .map(|has_segment| has_segment.then_some(node_id))
                        })
                        .transpose()
                })
                .transpose()
        };

        for group in group_by(&chain.token_ids, get_segment_node_id) {
            let (segment_node_id, token_ids) = group?;
            let segment = node_annos
                .get_value_for_item(&segment_node_id, segment_anno_key)?
                .expect("value should be present by choice of segment_node_id")
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
                        mut segments,
                    }),
                    Some(match_node_index),
                ) if index == match_node_index => TextPart::Match {
                    index,
                    segments: {
                        segments.push(segment);
                        segments
                    },
                },
                (Some(TextPart::Match { index, segments }), Some(match_node_index)) => {
                    parts.push(TextPart::Match { index, segments });
                    TextPart::Match {
                        index: match_node_index,
                        segments: vec![segment],
                    }
                }
                (Some(TextPart::Match { index, segments }), None) => {
                    parts.push(TextPart::Match { index, segments });
                    TextPart::Context {
                        segments: vec![segment],
                    }
                }
                (Some(TextPart::Context { segments }), Some(match_node_index)) => {
                    parts.push(TextPart::Context { segments });
                    TextPart::Match {
                        index: match_node_index,
                        segments: vec![segment],
                    }
                }
                (Some(TextPart::Context { mut segments }), None) => TextPart::Context {
                    segments: {
                        segments.push(segment);
                        segments
                    },
                },
                (_, Some(index)) => TextPart::Match {
                    index,
                    segments: vec![segment],
                },
                (_, None) => TextPart::Context {
                    segments: vec![segment],
                },
            });
        }

        if let Some(part) = current_part.take() {
            parts.push(part);
        }
    }

    if !chains.is_empty() {
        return Err(AnnimateError::FailedToOrderChains);
    }

    Ok(parts)
}

struct GraphHelper<'a> {
    graph: &'a Graph<AnnotationComponentType>,
    coverage_storages: Vec<&'a dyn GraphStorage>,
    order_storage: Option<&'a dyn GraphStorage>,
}

impl<'a> GraphHelper<'a> {
    fn new(graph: &'a Graph<AnnotationComponentType>) -> Self {
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

        let order_storage = graph.get_graphstorage_as_ref(&DEFAULT_ORDERING_COMPONENT);

        Self {
            graph,
            coverage_storages,
            order_storage,
        }
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
    ) -> impl Iterator<Item = Result<NodeID, GraphAnnisCoreError>> + use<'_> {
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
    ) -> impl Iterator<Item = Result<NodeID, GraphAnnisCoreError>> + use<'_> {
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
        if source == target {
            return Ok(true);
        }

        self.coverage_storages
            .iter()
            .map(|gs| gs.is_connected(source, target, 1, Bound::Included(1)))
            .fold_ok(false, |a, b| a || b)
    }

    fn is_token(&self, node_id: NodeID) -> Result<bool, GraphAnnisError> {
        Ok(self.has_token_anno(node_id)? && !self.has_outgoing_coverage_edges(node_id)?)
    }

    fn has_token_anno(&self, node_id: NodeID) -> Result<bool, GraphAnnisError> {
        Ok(self
            .graph
            .get_node_annos()
            .has_value_for_item(&node_id, &TOKEN_ANNO_KEY)?)
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
