use std::collections::BTreeMap;
use std::sync::OnceLock;
use std::vec;

use graphannis::corpusstorage::{QueryAttributeDescription, QueryLanguage};
use graphannis::errors::{AQLError, GraphAnnisError};
use itertools::{Itertools, Position};
use regex::Regex;
use serde::Serialize;

use crate::corpus::CorpusRef;

pub(crate) fn validate_query<S>(
    corpus_ref: CorpusRef<S>,
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

    if let QueryLanguage::AQLQuirksV3 = query_language {
        for (position, capture) in meta_regex().captures_iter(aql_query).with_position() {
            if let Position::First | Position::Only = position {
                if let Some(i) = node_descriptions
                    .iter()
                    .rposition(|n| n.query_fragment == "annis:doc")
                {
                    node_descriptions.swap_remove(i);
                }
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
        let index_in_alternative = {
            let count = count_by_alternative.entry(node.alternative).or_insert(0);
            let index = *count;
            *count += 1;
            index
        };

        nodes_by_index_in_alternative
            .entry(index_in_alternative)
            .or_insert_with(Vec::new)
            .push(node.into());
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
    Valid(
        /// Data returned by the analysis.
        T,
    ),
    /// Query is invalid.
    Invalid(
        /// The error encountered while analyzing the query.
        AQLError,
    ),
}

impl<T> QueryAnalysisResult<T> {
    pub fn unwrap_valid(self) -> T {
        match self {
            QueryAnalysisResult::Valid(x) => x,
            QueryAnalysisResult::Invalid(_) => panic!("query is invalid"),
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
    /// Nodes grouped by index in alternative.
    ///
    /// The outer `Vec` groups the nodes by the index in their respective alternative.
    /// If `nodes` has length `n`, then each match consists of up to `n` nodes, and the `i`-th
    /// match node could refer to any of the nodes in `nodes[i]`.
    ///
    /// # Example
    /// If the query is `(foo & bar) | baz`, this is `[[#1, #3], [#2]]`.
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

impl From<QueryAttributeDescription> for QueryNode {
    fn from(node: QueryAttributeDescription) -> Self {
        QueryNode {
            query_fragment: node.query_fragment,
            variable: node.variable,
        }
    }
}

fn meta_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r"meta::((?:[a-zA-Z_%](?:[a-zA-Z0-9_\-%])*:)?(?:[a-zA-Z_%](?:[a-zA-Z0-9_\-%])*))",
        )
        .unwrap()
    })
}
