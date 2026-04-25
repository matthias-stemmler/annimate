use std::collections::BTreeMap;
use std::sync::LazyLock;
use std::vec;

use graphannis::CorpusStorage;
use graphannis::corpusstorage::{CacheStrategy, QueryLanguage};
use graphannis::errors::{AQLError, GraphAnnisError};
use itertools::{Itertools, Position};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tempfile::TempDir;

use crate::error::AnnimateError;

const MAX_QUERY_LEN_CHARS: usize = 400;

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
        QueryAnalysisResult::from_result(
            {
                // Shortcut for empty query because CorpusStorage::validate_query overflows
                if aql_query.is_empty() {
                    Ok(())
                } else {
                    // Validate query length first to prevent stack overflow
                    validate_query_length(aql_query).and_then(|_| {
                        self.corpus_storage
                            .validate_query(
                                &[Self::VALIDATION_CORPUS_NAME],
                                aql_query,
                                query_language,
                            )
                            .map(|_| ())
                    })
                }
            },
            aql_query,
        )
    }
}

pub(crate) fn query_nodes(
    corpus_storage: &CorpusStorage,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<QueryNodes>, GraphAnnisError> {
    QueryAnalysisResult::from_result(
        query_nodes_valid(corpus_storage, aql_query, query_language),
        aql_query,
    )
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

/// Asserts that the query does not exceed a certain maximal length, to prevent stack overflows when
/// parsing. The length is counted in characters, not UTF-8 bytes, to account for multibyte
/// characters, which do not pose a problem when parsing.
fn validate_query_length(aql_query: &str) -> Result<(), GraphAnnisError> {
    let len_chars = aql_query.chars().count();

    if len_chars > MAX_QUERY_LEN_CHARS {
        Err(GraphAnnisError::AQLSyntaxError(AQLError {
            desc: format!(
                "Query is too long ({} characters), must be at most {} characters.",
                len_chars, MAX_QUERY_LEN_CHARS
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
    Invalid(QueryValidationError),
}

/// Error when validating an AQL query.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryValidationError {
    /// Location where the error occurred.
    pub location: Option<LineColumnRange<LineColumnIndex>>,

    /// Error message.
    pub message: String,
}

/// Range of line-column coordinates within a string with optional end.
///
/// This mimics the non-exported `LineColumnRange` type from [graphANNIS](https://docs.rs/graphannis),
/// except that it is generic over the coordinate type to allow for different coordinate
/// representations.
#[derive(Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LineColumnRange<T> {
    /// Start of the range.
    pub start: T,

    /// Optional end of the range.
    pub end: Option<T>,
}

/// Line-column coordinates within a string as represented by [graphANNIS](https://docs.rs/graphannis).
///
/// This mimics the non-exported `LineColumn` type from graphANNIS, which has these properties:
/// - `line` is 0-based, `column` is 1-based.
/// - Coordinates are in UTF-8 bytes.
#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LineColumn {
    line: usize,
    column: usize,
}

/// Line-column coordinates within a string.
///
/// This differs from [`LineColumn`] in the following ways:
/// - Both `line` and `column` are 0-based, hence the name `*_index`.
/// - Coordinates are in Unicode code points, not in UTF-8 bytes. Note that this is not the same as
///   UTF-16 code units, which are used for string indexing in JavaScript.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LineColumnIndex {
    /// 0-based line index.
    pub line_index: usize,

    /// 0-based column index in Unicode code points.
    pub column_index: usize,
}

impl LineColumnIndex {
    fn from_line_column(line_column: LineColumn, value: &str) -> Self {
        let target_line_index = line_column.line;
        let target_column_index_bytes = line_column.column - 1;

        let mut line_index = 0;
        let mut column_index = 0;
        let mut line_start_byte_index = 0;

        for (byte_index, ch) in value.char_indices() {
            if line_index == target_line_index
                && (ch == '\n' || byte_index - line_start_byte_index >= target_column_index_bytes)
            {
                return Self {
                    line_index,
                    column_index,
                };
            }

            if ch == '\n' {
                line_index += 1;
                column_index = 0;
                line_start_byte_index = byte_index + 1;
            } else {
                column_index += 1;
            }
        }

        Self {
            line_index,
            column_index,
        }
    }
}

impl QueryValidationError {
    fn from_aql_error(aql_error: AQLError, aql_query: &str) -> Self {
        let AQLError {
            location,
            desc: mut message,
        } = aql_error;

        // We need a round-trip through serde_json::Value because the fields of `LineColumnRange`
        // are not public in graphANNIS.
        let location: Option<LineColumnRange<LineColumn>> = location.map(|location| {
            serde_json::from_value(
                serde_json::to_value(location).expect("should serialize AQL error location"),
            )
            .expect("should deserialize AQL error location")
        });

        Self {
            location: location.map(|location| LineColumnRange {
                start: LineColumnIndex::from_line_column(location.start, aql_query),
                end: location
                    .end
                    .map(|end| LineColumnIndex::from_line_column(end, aql_query)),
            }),
            message: {
                if let Some(idx) = message.find(" Expected one of: ") {
                    message.truncate(idx);
                }
                message
            },
        }
    }
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
        aql_query: &str,
    ) -> Result<QueryAnalysisResult<T>, GraphAnnisError> {
        match result {
            Ok(x) => Ok(QueryAnalysisResult::Valid(x)),
            Err(GraphAnnisError::AQLSyntaxError(err) | GraphAnnisError::AQLSemanticError(err)) => {
                Ok(QueryAnalysisResult::Invalid(
                    QueryValidationError::from_aql_error(err, aql_query),
                ))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn line_column_index_from_line_column_ascii_single_line() {
        assert_line_column_index("hello", (0, 1), (0, 0));
        assert_line_column_index("hello", (0, 6), (0, 5));
        assert_line_column_index("hello", (0, 7), (0, 5));
    }

    #[test]
    fn line_column_index_from_line_column_ascii_multi_line() {
        assert_line_column_index("foo\nbar\nbaz", (0, 1), (0, 0));
        assert_line_column_index("foo\nbar\nbaz", (1, 4), (1, 3));
        assert_line_column_index("foo\nbar\nbaz", (2, 5), (2, 3));
    }

    #[test]
    fn line_column_index_from_line_column_empty_string() {
        assert_line_column_index("", (0, 1), (0, 0));
    }

    #[test]
    fn line_column_index_from_line_column_multibyte_at_boundary() {
        // 'é' is 2 bytes (0xC3 0xA9): h(0) é(1..3) l(3) l(4) o(5)
        assert_line_column_index("héllo", (0, 2), (0, 1));
        assert_line_column_index("héllo", (0, 4), (0, 2));
        assert_line_column_index("héllo", (0, 7), (0, 5));

        // '€' is 3 bytes (0xE2 0x82 0xAC): h(0) €(1..4) l(4) l(5) o(6)
        assert_line_column_index("h€llo", (0, 2), (0, 1));
        assert_line_column_index("h€llo", (0, 5), (0, 2));
        assert_line_column_index("h€llo", (0, 8), (0, 5));

        // '🎉' is 4 bytes (0xF0 0x9F 0x8E 0x89): h(0) 🎉(1..5) l(5) l(6) o(7)
        assert_line_column_index("h🎉llo", (0, 2), (0, 1));
        assert_line_column_index("h🎉llo", (0, 6), (0, 2));
        assert_line_column_index("h🎉llo", (0, 9), (0, 5));
    }

    #[test]
    fn line_column_index_from_line_column_multibyte_not_at_boundary_rounds_up() {
        // Byte column 3 falls inside 'é' (bytes 1..3) and should round up to start of 'l'.
        assert_line_column_index("héllo", (0, 3), (0, 2));

        // Byte columns 3 and 4 fall inside '€' (bytes 1..4) and should round up to start of 'l'.
        assert_line_column_index("h€llo", (0, 3), (0, 2));
        assert_line_column_index("h€llo", (0, 4), (0, 2));

        // Byte columns 3, 4, 5 fall inside '🎉' (bytes 1..5) and should round up to start of 'l'.
        assert_line_column_index("h🎉llo", (0, 3), (0, 2));
        assert_line_column_index("h🎉llo", (0, 4), (0, 2));
        assert_line_column_index("h🎉llo", (0, 5), (0, 2));
    }

    #[test]
    fn line_column_index_from_line_column_line_out_of_range_returns_end_of_string() {
        assert_line_column_index("foo\nbar\nbaz", (3, 1), (2, 3));
        assert_line_column_index("héllo", (1, 1), (0, 5));
        assert_line_column_index("", (1, 1), (0, 0));
    }

    #[test]
    fn line_column_index_from_line_column_column_out_of_range_returns_end_of_line() {
        assert_line_column_index("foo\nbar\nbaz", (1, 5), (1, 3));
        assert_line_column_index("héllo", (0, 7), (0, 5));
    }

    #[test]
    fn line_column_index_from_line_column_multibyte_on_earlier_line() {
        // First line contains a 2-byte char, target is on second (ASCII) line - confirms
        // multi-byte chars on earlier lines don't affect column counting on the target line.
        assert_line_column_index("héllo\nfoo", (1, 2), (1, 1));
    }

    fn assert_line_column_index(
        value: &str,
        (line, column): (usize, usize),
        expected: (usize, usize),
    ) {
        let index = LineColumnIndex::from_line_column(LineColumn { line, column }, value);
        assert_eq!((index.line_index, index.column_index), expected);
    }
}
