use std::collections::BTreeMap;
use std::sync::LazyLock;
use std::vec;

use graphannis::CorpusStorage;
use graphannis::corpusstorage::{CacheStrategy, QueryLanguage};
use graphannis::errors::{AQLError, GraphAnnisError};
use itertools::{Itertools, Position};
use regex::Regex;
use serde::Serialize;
use tempfile::TempDir;

use crate::error::AnnimateError;

const MAX_QUERY_LENGTH: usize = 400;

/// Storage for validating AQL queries.
///
/// We validate queries against an empty corpus, which has multiple advantages over validating
/// against the actual corpora:
/// - It is faster because the actual corpora don't need to be loaded.
/// - We catch syntax errors and corpus-independent semantic errors (e.g. "variable not bound") even
///   when there are no corpora.
///
/// The disadvantage is that we may miss corpus-dependent semantic errors, but those seem to be rare
/// and will be caught during export anyway.
///
/// This type encapsulates the temporary corpus storage needed for this empty corpus.
pub(crate) struct ValidationStorage {
    corpus_storage: CorpusStorage,
    _temp_dir: TempDir, // must be last field to ensure it is dropped after `corpus_storage`
}

impl ValidationStorage {
    const VALIDATION_CORPUS_NAME: &str = "validation";

    pub(crate) fn new() -> Result<Self, AnnimateError> {
        let temp_dir = TempDir::new()?;

        let corpus_storage = CorpusStorage::with_cache_strategy(
            temp_dir.path(),
            CacheStrategy::FixedMaxMemory(0),
            true, /* use_parallel_joins */
        )?;
        corpus_storage
            .create_empty_corpus(Self::VALIDATION_CORPUS_NAME, false /* disk_based */)?;

        Ok(Self {
            corpus_storage,
            _temp_dir: temp_dir,
        })
    }

    pub(crate) fn validate_query(
        &self,
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryAnalysisResult<()>, GraphAnnisError> {
        QueryAnalysisResult::from_result({
            // Shortcut for empty query because CorpusStorage::validate_query overflows
            if aql_query.is_empty() {
                Ok(())
            } else {
                // Validate query length first to prevent stack overflow
                validate_query_length(aql_query).and_then(|_| {
                    self.corpus_storage
                        .validate_query(&[Self::VALIDATION_CORPUS_NAME], aql_query, query_language)
                        .map(|_| ())
                })
            }
        })
    }
}

pub(crate) fn query_nodes(
    corpus_storage: &CorpusStorage,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<QueryNodes>, GraphAnnisError> {
    QueryAnalysisResult::from_result(query_nodes_valid(corpus_storage, aql_query, query_language))
}

pub(crate) fn query_nodes_valid(
    corpus_storage: &CorpusStorage,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryNodes, GraphAnnisError> {
    // Shortcut for empty query because CorpusStorage::node_descriptions overflows
    if aql_query.is_empty() {
        return Ok(Vec::new().into());
    }

    // Validate query length first to prevent stack overflow
    validate_query_length(aql_query)?;

    let mut node_descriptions = corpus_storage.node_descriptions(aql_query, query_language)?;

    // In quirks mode, remove artifically added nodes for meta queries
    if let QueryLanguage::AQLQuirksV3 = query_language {
        for (position, capture) in META_REGEX.captures_iter(aql_query).with_position() {
            if let Position::First | Position::Only = position
                && let Some(i) = node_descriptions
                    .iter()
                    .rposition(|n| n.query_fragment == "annis:doc")
            {
                node_descriptions.swap_remove(i);
            }

            let anno_name = capture.get(1).unwrap().as_str();
            if let Some(i) = node_descriptions
                .iter()
                .rposition(|n| n.anno_name.as_deref() == Some(anno_name))
            {
                node_descriptions.swap_remove(i);
            }
        }
    }

    let mut count_by_alternative = BTreeMap::new();
    let mut nodes_by_index_in_alternative = BTreeMap::new();

    for node in node_descriptions {
        if node.optional {
            continue;
        }

        let index_in_alternative = {
            let count = count_by_alternative.entry(node.alternative).or_insert(0);
            let index = *count;
            *count += 1;
            index
        };

        nodes_by_index_in_alternative
            .entry(index_in_alternative)
            .or_insert_with(Vec::new)
            .push(QueryNode {
                query_fragment: node.query_fragment.clone(),
                variable: node.variable.clone(),
            });
    }

    Ok(nodes_by_index_in_alternative
        .into_values()
        .collect_vec()
        .into())
}

fn validate_query_length(aql_query: &str) -> Result<(), GraphAnnisError> {
    if aql_query.len() > MAX_QUERY_LENGTH {
        Err(GraphAnnisError::AQLSyntaxError(AQLError {
            desc: format!(
                "Query is too long ({} characters), must be at most {} characters.",
                aql_query.len(),
                MAX_QUERY_LENGTH
            ),
            location: None,
        }))
    } else {
        Ok(())
    }
}

/// Result of analyzing an AQL query.
#[derive(Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum QueryAnalysisResult<T = ()> {
    /// Query is valid.
    Valid(T),

    /// Query is invalid.
    Invalid(AQLError),
}

impl<T> QueryAnalysisResult<T> {
    /// Returns the payload if valid, otherwise returns `None`.
    pub fn valid(self) -> Option<T> {
        match self {
            QueryAnalysisResult::Valid(x) => Some(x),
            QueryAnalysisResult::Invalid(_) => None,
        }
    }

    fn from_result(
        result: Result<T, GraphAnnisError>,
    ) -> Result<QueryAnalysisResult<T>, GraphAnnisError> {
        match result {
            Ok(x) => Ok(QueryAnalysisResult::Valid(x)),
            Err(GraphAnnisError::AQLSyntaxError(err) | GraphAnnisError::AQLSemanticError(err)) => {
                Ok(QueryAnalysisResult::Invalid(err))
            }
            Err(err) => Err(err),
        }
    }
}

/// Nodes of an AQL query.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryNodes {
    /// Nodes grouped by their indices within a match.
    ///
    /// The outer `Vec` groups the nodes by their indices in a match.
    /// If `nodes` has length `n`, then each match consists of up to `n` nodes,
    /// and the `i`-th match node could refer to any of the nodes in the group `nodes[i]`.
    ///
    /// Example: If the query is `(foo & bar) | baz`, this is `[[#1, #3], [#2]]`.
    nodes: Vec<Vec<QueryNode>>,
}

impl From<Vec<Vec<QueryNode>>> for QueryNodes {
    fn from(nodes: Vec<Vec<QueryNode>>) -> QueryNodes {
        QueryNodes { nodes }
    }
}

impl From<QueryNodes> for Vec<Vec<QueryNode>> {
    fn from(query_nodes: QueryNodes) -> Vec<Vec<QueryNode>> {
        query_nodes.nodes
    }
}

impl IntoIterator for QueryNodes {
    type Item = Vec<QueryNode>;
    type IntoIter = vec::IntoIter<Vec<QueryNode>>;

    fn into_iter(self) -> Self::IntoIter {
        self.nodes.into_iter()
    }
}

/// A node of a query.
#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryNode {
    /// Fragment of the query defining the node.
    pub query_fragment: String,

    /// Variable referring to the node.
    pub variable: String,
}

/// Regex to recognize legacy meta queries.
///
/// Taken from [ANNIS](https://github.com/korpling/ANNIS/blob/9d75e92ddf99bf8cf2633750fd3ba4c4edaf3b51/src/main/resources/org/corpus_tools/annis/gui/components/codemirror/mode/aql/aql.js#L18).
static META_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"meta::((?:[a-zA-Z_%](?:[a-zA-Z0-9_\-%])*:)?(?:[a-zA-Z_%](?:[a-zA-Z0-9_\-%])*))")
        .unwrap()
});
