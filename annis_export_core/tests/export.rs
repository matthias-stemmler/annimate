use annis_export_core::{
    AnnoKey, CorpusStorage, CsvExportColumn, CsvExportConfig, ExportData, ExportDataAnno,
    ExportDataText, ExportFormat, QueryLanguage,
};
use itertools::Itertools;
use serde::Serialize;
use std::fs::File;
use std::path::Path;

macro_rules! export_test {
    ($(
        $name:ident: {
            corpus_paths: $corpus_paths:expr,
            corpus_names: $corpus_names:expr,
            aql_query: $aql_query:expr,
            query_language: $query_language:expr,
            export_columns: [$($export_columns:expr,)*],
        }
    )*) => {
        $(
            #[test]
            fn $name() {
                let test_data = TestData {
                    corpus_paths: &$corpus_paths,
                    corpus_names: &$corpus_names,
                    aql_query: $aql_query,
                    query_language: {
                        use QueryLanguage::*;
                        $query_language
                    },
                    export_columns: {
                        use TestCsvExportColumn::*;
                        use TestExportData::*;
                        vec![$($export_columns,)*]
                    },
                };

                let storage = CorpusStorage::from_db_dir(tempfile::tempdir().unwrap()).unwrap();

                for corpus_path in test_data.corpus_paths {
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
                        test_data.corpus_names,
                        test_data.aql_query,
                        test_data.query_language,
                        ExportFormat::Csv(CsvExportConfig {
                            columns: test_data.export_columns.clone().into_iter().map_into().collect(),
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
        aql_query: "pos=\"DT\" _=_ lemma",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Anno(TestExportDataAnno::Corpus {
                anno_key: ("", "language"),
            })),
            Data(Anno(TestExportDataAnno::Document {
                anno_key: ("annis", "doc"),
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 1,
            })),
            Data(Text(TestExportDataText {
                left_context: 4,
                right_context: 4,
                segmentation: None,
            })),
        ],
    }
    subtok_segmentation_diplomatic: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "pos=\"DT\" _=_ lemma",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Anno(TestExportDataAnno::Corpus {
                anno_key: ("", "language"),
            })),
            Data(Anno(TestExportDataAnno::Document {
                anno_key: ("annis", "doc"),
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 1,
            })),
            Data(Text(TestExportDataText {
                left_context: 4,
                right_context: 4,
                segmentation: Some("diplomatic"),
            })),
        ],
    }
    subtok_segmentation_norm: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "pos=\"DT\" _=_ lemma",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Anno(TestExportDataAnno::Corpus {
                anno_key: ("", "language"),
            })),
            Data(Anno(TestExportDataAnno::Document {
                anno_key: ("annis", "doc"),
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 1,
            })),
            Data(Text(TestExportDataText {
                left_context: 4,
                right_context: 4,
                segmentation: Some("norm"),
            })),
        ],
    }
    subtok_gap: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "pos=\"DT\" .5,5 pos=\"DT\" & lemma & lemma & #1 _=_ #3 & #2 _=_ #4",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Anno(TestExportDataAnno::Corpus {
                anno_key: ("", "language"),
            })),
            Data(Anno(TestExportDataAnno::Document {
                anno_key: ("annis", "doc"),
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 2,
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 3,
            })),
            Data(Text(TestExportDataText {
                left_context: 1,
                right_context: 1,
                segmentation: None,
            })),
        ],
    }
    subtok_varying_number_of_match_nodes: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "(pos=\"DT\" .5,5 pos=\"DT\") | pos=\"NN\"",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Anno(TestExportDataAnno::Corpus {
                anno_key: ("", "language"),
            })),
            Data(Anno(TestExportDataAnno::Document {
                anno_key: ("annis", "doc"),
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "pos"),
                index: 1,
            })),
            Data(Text(TestExportDataText {
                left_context: 1,
                right_context: 1,
                segmentation: None,
            })),
        ],
    }
    subtok_multiple_corpora: {
        corpus_paths: ["subtok.demo_relANNIS.zip", "subtok.demo2_relANNIS.zip"],
        corpus_names: ["subtok.demo", "subtok.demo2"],
        aql_query: "pos=\"DT\"",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Anno(TestExportDataAnno::Corpus {
                anno_key: ("", "language"),
            })),
            Data(Anno(TestExportDataAnno::Document {
                anno_key: ("annis", "doc"),
            })),
            Data(Text(TestExportDataText {
                left_context: 1,
                right_context: 1,
                segmentation: Some("diplomatic"),
            })),
        ],
    }
    pcc2: {
        corpus_paths: ["pcc2_v7_relANNIS.zip"],
        corpus_names: ["pcc2"],
        aql_query: "Sent _i_ NP & Inf-Stat & #2 _=_ #3",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Anno(TestExportDataAnno::Corpus {
                anno_key: ("", "language"),
            })),
            Data(Anno(TestExportDataAnno::Document {
                anno_key: ("annis", "doc"),
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("exmaralda", "Inf-Stat"),
                index: 2,
            })),
            Data(Text(TestExportDataText {
                left_context: 10,
                right_context: 10,
                segmentation: None,
            })),
        ],
    }
}

#[derive(Serialize)]
struct TestData {
    corpus_paths: &'static [&'static str],
    corpus_names: &'static [&'static str],
    aql_query: &'static str,
    query_language: QueryLanguage,
    export_columns: Vec<TestCsvExportColumn>,
}

#[derive(Clone, Serialize)]
enum TestCsvExportColumn {
    Number,
    Data(TestExportData),
}

#[derive(Clone, Serialize)]
enum TestExportData {
    Anno(TestExportDataAnno),
    Text(TestExportDataText),
}

#[derive(Clone, Serialize)]
enum TestExportDataAnno {
    Corpus {
        anno_key: (&'static str, &'static str),
    },
    Document {
        anno_key: (&'static str, &'static str),
    },
    MatchNode {
        anno_key: (&'static str, &'static str),
        index: usize,
    },
}

#[derive(Clone, Serialize)]
struct TestExportDataText {
    pub left_context: usize,
    pub right_context: usize,
    pub segmentation: Option<&'static str>,
}

impl From<TestCsvExportColumn> for CsvExportColumn {
    fn from(column: TestCsvExportColumn) -> Self {
        match column {
            TestCsvExportColumn::Number => CsvExportColumn::Number,
            TestCsvExportColumn::Data(data) => CsvExportColumn::Data(match data {
                TestExportData::Anno(TestExportDataAnno::Corpus {
                    anno_key: (ns, name),
                }) => ExportData::Anno(ExportDataAnno::Corpus {
                    anno_key: AnnoKey {
                        ns: ns.into(),
                        name: name.into(),
                    },
                }),
                TestExportData::Anno(TestExportDataAnno::Document {
                    anno_key: (ns, name),
                }) => ExportData::Anno(ExportDataAnno::Document {
                    anno_key: AnnoKey {
                        ns: ns.into(),
                        name: name.into(),
                    },
                }),
                TestExportData::Anno(TestExportDataAnno::MatchNode {
                    anno_key: (ns, name),
                    index,
                }) => ExportData::Anno(ExportDataAnno::MatchNode {
                    anno_key: AnnoKey {
                        ns: ns.into(),
                        name: name.into(),
                    },
                    index,
                }),
                TestExportData::Text(TestExportDataText {
                    left_context,
                    right_context,
                    segmentation,
                }) => ExportData::Text(ExportDataText {
                    left_context,
                    right_context,
                    segmentation: segmentation.map(|s| s.to_string()),
                }),
            }),
        }
    }
}
