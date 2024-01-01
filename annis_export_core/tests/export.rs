use annis_export_core::{CorpusStorage, ExportFormat, QueryConfig, QueryLanguage};
use serde::Serialize;
use std::fs::File;

macro_rules! export_test {
    ($(
        $name:ident: {
            corpus_path: $corpus_path:expr,
            corpus_name: $corpus_name:expr,
            aql_query: $aql_query:expr,
            query_config: {
                left_context: $left_context:expr,
                right_context: $right_context:expr,
                query_language: $query_language:expr,
                segmentation: $segmentation:expr,
            },
        }
    )*) => {
        $(
            #[test]
            fn $name() {
                let test_data = TestData {
                    corpus_path: $corpus_path,
                    corpus_name: $corpus_name,
                    aql_query: $aql_query,
                    query_config: TestQueryConfig {
                        left_context: $left_context,
                        right_context: $right_context,
                        query_language: {
                            use QueryLanguage::*;
                            $query_language
                        },
                        segmentation: $segmentation,
                    }
                };

                let storage = CorpusStorage::from_db_dir(tempfile::tempdir().unwrap()).unwrap();

                storage
                    .import_corpora_from_zip(
                        File::open(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/data/", $corpus_path)).unwrap(),
                        |_| (),
                    )
                    .unwrap();

                let mut export_bytes = Vec::new();

                storage
                    .export_matches(
                        $corpus_name,
                        $aql_query,
                        QueryConfig {
                            left_context: $left_context,
                            right_context: $right_context,
                            query_language: {
                                use QueryLanguage::*;
                                $query_language
                            },
                            segmentation: $segmentation.map(|s: &str| s.to_string()),
                        },
                        ExportFormat::Csv,
                        &mut export_bytes,
                        |_| (),
                    )
                    .unwrap();

                let export = String::from_utf8(export_bytes).unwrap();

                insta::with_settings!(
                    {
                         info => &test_data,
                         omit_expression => true,
                    },
                    { insta::assert_snapshot!(export) }
                );
            }
        )*
    };
}

export_test! {
    subtok_segmentation_tokens: {
        corpus_path: "subtok.demo_relANNIS.zip",
        corpus_name: "subtok.demo",
        aql_query: "pos=\"DT\"",
        query_config: {
            left_context: 4,
            right_context: 4,
            query_language: AQL,
            segmentation: None,
        },
    }
    subtok_segmentation_diplomatic: {
        corpus_path: "subtok.demo_relANNIS.zip",
        corpus_name: "subtok.demo",
        aql_query: "pos=\"DT\"",
        query_config: {
            left_context: 4,
            right_context: 4,
            query_language: AQL,
            segmentation: Some("diplomatic"),
        },
    }
    subtok_segmentation_norm: {
        corpus_path: "subtok.demo_relANNIS.zip",
        corpus_name: "subtok.demo",
        aql_query: "pos=\"DT\"",
        query_config: {
            left_context: 4,
            right_context: 4,
            query_language: AQL,
            segmentation: Some("norm"),
        },
    }
    subtok_gap: {
        corpus_path: "subtok.demo_relANNIS.zip",
        corpus_name: "subtok.demo",
        aql_query: "pos=\"DT\" .5,5 pos=\"DT\"",
        query_config: {
            left_context: 1,
            right_context: 1,
            query_language: AQL,
            segmentation: None,
        },
    }
    pcc2: {
        corpus_path: "pcc2_v7_relANNIS.zip",
        corpus_name: "pcc2",
        aql_query: "Sent _i_ NP",
        query_config: {
            left_context: 10,
            right_context: 10,
            query_language: AQL,
            segmentation: None,
        },
    }
}

#[derive(Serialize)]
struct TestData {
    corpus_path: &'static str,
    corpus_name: &'static str,
    aql_query: &'static str,
    query_config: TestQueryConfig,
}

#[derive(Serialize)]
struct TestQueryConfig {
    left_context: usize,
    right_context: usize,
    query_language: QueryLanguage,
    segmentation: Option<&'static str>,
}
