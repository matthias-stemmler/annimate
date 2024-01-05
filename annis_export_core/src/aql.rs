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
pub enum QueryValidationResult {
    Valid,
    Invalid(AQLError),
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

#[cfg(test)]
mod tests {
    use super::*;
    use QueryLanguage::*;

    macro_rules! query_nodes_test {
        ($(
            $name:ident: $query:expr, $query_language:expr => [$([$($expected_var:expr => $expected_frag:expr),*$(,)?]),*$(,)?]
        )*) => { $(
            #[test]
            fn $name() {
                let actual: Vec<_> = query_nodes(
                    &graphannis::CorpusStorage::with_auto_cache_size(tempfile::tempdir().unwrap().path(), true).unwrap(),
                    $query,
                    $query_language,
                )
                .unwrap()
                .into_iter()
                .collect();

                let expected: Vec<Vec<QueryNode>> = vec![$(
                    vec![$(
                        QueryNode {
                            query_fragment: $expected_frag.into(),
                            variable: $expected_var.into(),
                        }
                    ),*]
                ),*];

                assert_eq!(actual, expected);
            }
        )* };
    }

    query_nodes_test! {
        simple: "foo1=\"foo2\"", AQL => [
            ["1" => "foo1=\"foo2\""],
        ]
        conjunction: "foo1=\"foo2\" & bar1=\"bar2\"", AQL => [
            ["1" => "foo1=\"foo2\""],
            ["2" => "bar1=\"bar2\""],
        ]
        disjunction: "foo1=\"foo2\" | bar1=\"bar2\"", AQL => [
            ["1" => "foo1=\"foo2\"", "2" => "bar1=\"bar2\""],
        ]
        cnf: "(foo1=\"foo2\" | bar1=\"bar2\") & (baz1=\"baz2\" | qux1=\"qux2\")", AQL => [
            ["1" => "foo1=\"foo2\"", "3" => "foo1=\"foo2\"", "5" => "bar1=\"bar2\"", "7" => "bar1=\"bar2\""],
            ["2" => "baz1=\"baz2\"", "4" => "qux1=\"qux2\"", "6" => "baz1=\"baz2\"", "8" => "qux1=\"qux2\""],
        ]
        dnf: "(foo1=\"foo2\" & bar1=\"bar2\") | (baz1=\"baz2\" & qux1=\"qux2\")", AQL => [
            ["1" => "foo1=\"foo2\"", "3" => "baz1=\"baz2\""],
            ["2" => "bar1=\"bar2\"", "4" => "qux1=\"qux2\""],
        ]
        meta_only_single: "meta::doc=\"foo\"", AQLQuirksV3 => []
        meta_only_multiple: "meta::doc=\"foo\" & meta::foo1=\"foo2\"", AQLQuirksV3 => []
        meta_single: "meta::doc=\"foo\" & bar1=\"bar2\"", AQLQuirksV3 => [
            ["1" => "bar1=\"bar2\""],
        ]
        meta_multiple: "meta::doc=\"foo\" & bar1=\"bar2\" & meta::foo1=\"foo2\"", AQLQuirksV3 => [
            ["1" => "bar1=\"bar2\""],
        ]
        meta_with_doc: "meta::doc=\"foo\" & doc=\"foo\" & annis:doc", AQLQuirksV3 => [
            ["1" => "doc=\"foo\""],
            ["2" => "annis:doc"],
        ]
    }
}
