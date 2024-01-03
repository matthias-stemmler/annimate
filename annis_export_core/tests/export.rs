use annis_export_core::{
    CorpusStorage, CsvExportColumn, CsvExportConfig, ExportData, ExportDataText, ExportFormat,
    QueryConfig, QueryLanguage,
};
use serde::Serialize;
use std::fs::File;
use std::path::Path;

macro_rules! export_test {
    ($(
        $name:ident: {
            corpus_paths: $corpus_paths:expr,
            corpus_names: $corpus_names:expr,
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
                    corpus_paths: &$corpus_paths,
                    corpus_names: &$corpus_names,
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

                for corpus_path in $corpus_paths {
                    storage
                        .import_corpora_from_zip(
                            File::open(Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/data")).join(corpus_path)).unwrap(),
                            |_| (),
                        )
                        .unwrap();
                }

                let mut export_bytes = Vec::new();

                storage
                    .export_matches(
                        &$corpus_names,
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
                        ExportFormat::Csv(CsvExportConfig {
                            columns: vec![
                                CsvExportColumn::Number,
                                CsvExportColumn::Data(ExportData::DocName),
                                CsvExportColumn::Data(ExportData::Text(ExportDataText {
                                    left_context: $left_context,
                                    right_context: $right_context,
                                })),
                            ],
                        }),
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
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "pos=\"DT\"",
        query_config: {
            left_context: 4,
            right_context: 4,
            query_language: AQL,
            segmentation: None,
        },
    }
    subtok_segmentation_diplomatic: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "pos=\"DT\"",
        query_config: {
            left_context: 4,
            right_context: 4,
            query_language: AQL,
            segmentation: Some("diplomatic"),
        },
    }
    subtok_segmentation_norm: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "pos=\"DT\"",
        query_config: {
            left_context: 4,
            right_context: 4,
            query_language: AQL,
            segmentation: Some("norm"),
        },
    }
    subtok_gap: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "pos=\"DT\" .5,5 pos=\"DT\"",
        query_config: {
            left_context: 1,
            right_context: 1,
            query_language: AQL,
            segmentation: None,
        },
    }
    subtok_varying_number_of_match_nodes: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "(pos=\"DT\" .5,5 pos=\"DT\") | pos=\"NN\"",
        query_config: {
            left_context: 1,
            right_context: 1,
            query_language: AQL,
            segmentation: None,
        },
    }
    subtok_multiple_corpora: {
        corpus_paths: ["subtok.demo_relANNIS.zip", "subtok.demo2_relANNIS.zip"],
        corpus_names: ["subtok.demo", "subtok.demo2"],
        aql_query: "pos=\"DT\" .5,5 pos=\"DT\"",
        query_config: {
            left_context: 1,
            right_context: 1,
            query_language: AQL,
            segmentation: Some("diplomatic"),
        },
    }
    pcc2: {
        corpus_paths: ["pcc2_v7_relANNIS.zip"],
        corpus_names: ["pcc2"],
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
    corpus_paths: &'static [&'static str],
    corpus_names: &'static [&'static str],
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
