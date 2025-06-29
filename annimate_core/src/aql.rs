use std::collections::BTreeMap;
use std::sync::LazyLock;
use std::vec;

use graphannis::corpusstorage::QueryLanguage;
use graphannis::errors::{AQLError, GraphAnnisError};
use itertools::{Itertools, Position};
use regex::Regex;
use serde::Serialize;

use crate::corpus::CorpusRef;

pub(crate) fn validate_query<S>(
    corpus_ref: CorpusRef<'_, S>,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<()>, GraphAnnisError>
where
    S: AsRef<str>,
{
    // Shortcut for empty query because graphannis::CorpusStorage::validate_query overflows
    if aql_query.is_empty() {
        return Ok(QueryAnalysisResult::Valid(()));
    }

    // When there are no corpora, graphannis::CorpusStorage::validate_query always succeeds, even
    // when there are syntax errors. So we catch these by using
    // graphannis::CorpusStorage::node_descriptions instead
    QueryAnalysisResult::from_result(if corpus_ref.names.is_empty() {
        corpus_ref
            .storage
            .node_descriptions(aql_query, query_language)
            .map(|_| ())
    } else {
        corpus_ref
            .storage
            .validate_query(corpus_ref.names, aql_query, query_language)
            .map(|_| ())
    })
}

pub(crate) fn query_nodes(
    storage: &graphannis::CorpusStorage,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<QueryNodes>, GraphAnnisError> {
    QueryAnalysisResult::from_result(query_nodes_valid(storage, aql_query, query_language))
}

pub(crate) fn query_nodes_valid(
    storage: &graphannis::CorpusStorage,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryNodes, GraphAnnisError> {
    // Shortcut for empty query because graphannis::CorpusStorage::node_descriptions overflows
    if aql_query.is_empty() {
        return Ok(Vec::new().into());
    }

    let mut node_descriptions = storage.node_descriptions(aql_query, query_language)?;

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
