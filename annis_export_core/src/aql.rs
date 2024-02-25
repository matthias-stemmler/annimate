use crate::corpus::CorpusRef;
use graphannis::{
    corpusstorage::{QueryAttributeDescription, QueryLanguage},
    errors::{AQLError, GraphAnnisError},
};
use itertools::{Itertools, Position};
use regex::Regex;
use std::{collections::BTreeMap, sync::OnceLock};

pub fn validate_query<S>(
    corpus_ref: CorpusRef<S>,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryValidationResult, GraphAnnisError>
where
    S: AsRef<str>,
{
    if corpus_ref.names.is_empty() {
        return Ok(QueryValidationResult::Indeterminate);
    }

    match corpus_ref
        .storage
        .validate_query(corpus_ref.names, aql_query, query_language)
    {
        Ok(true) => Ok(QueryValidationResult::Valid),
        Ok(false) => unreachable!("Cannot occur according to docs"),
        Err(GraphAnnisError::AQLSyntaxError(err) | GraphAnnisError::AQLSemanticError(err)) => {
            Ok(QueryValidationResult::Invalid(err))
        }
        Err(err) => Err(err),
    }
}

#[derive(Debug)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(tag = "type", rename_all = "camelCase"))]
pub enum QueryValidationResult {
    Valid,
    Invalid(AQLError),
    Indeterminate,
}

pub fn query_nodes(
    storage: &graphannis::CorpusStorage,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<Vec<Vec<QueryNode>>, GraphAnnisError> {
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

    Ok(nodes_by_index_in_alternative.into_values().collect())
}

#[derive(Debug, PartialEq)]
pub struct QueryNode {
    pub query_fragment: String,
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
