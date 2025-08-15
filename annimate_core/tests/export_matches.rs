use std::cell::Cell;
use std::fs;
use std::path::Path;

use annimate_core::{
    AnnimateError, AnnoKey, CsvExportConfig, ExportConfig, ExportData, ExportDataAnno,
    ExportDataText, ExportFormat, ExportStatusEvent, QueryLanguage, Storage, TableExportColumn,
};
use itertools::Itertools;
use serde::Serialize;

const DATA_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/data");
const DB_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/export_matches/db");
const OUTPUT_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/export_matches/output");

macro_rules! export_matches_test {
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
                        use TestTableExportColumn::*;
                        #[allow(unused_imports)]
                        use TestExportData::*;
                        vec![$($export_columns,)*]
                    },
                };

                let db_dir = Path::new(DB_DIR).join(stringify!($name));

                let _ = fs::remove_dir_all(&db_dir);
                let storage = Storage::from_db_dir(db_dir).unwrap();

                fs::create_dir_all(Path::new(OUTPUT_DIR)).unwrap();
                let output_file = Path::new(OUTPUT_DIR).join(concat!(stringify!($name), ".csv"));
                let _ = fs::remove_file(&output_file);

                storage
                    .import_corpora(
                        test_data
                            .corpus_paths
                            .into_iter()
                            .map(|p| Path::new(DATA_DIR).join(p))
                            .collect(),
                        |_| (),
                        || false,
                    )
                    .unwrap();

                storage
                    .export_matches(
                        ExportConfig {
                            corpus_names: test_data.corpus_names.into_iter().cloned().map_into().collect_vec(),
                            aql_query: test_data.aql_query.into(),
                            query_language: test_data.query_language,
                            format: ExportFormat::Csv(CsvExportConfig {
                                columns: test_data
                                    .export_columns
                                    .clone()
                                    .into_iter()
                                    .map_into()
                                    .collect(),
                            }),
                        },
                        &output_file,
                        |_| (),
                        || false,
                    )
                    .unwrap();

                let output = fs::read_to_string(output_file).unwrap();

                insta::with_settings!(
                    {
                         info => &test_data,
                         omit_expression => true,
                    },
                    { insta::assert_snapshot!(output) }
                );
            }
        )*
    };
}

export_matches_test! {
    empty: {
        corpus_paths: ["empty_graphml.zip"],
        corpus_names: ["empty"],
        aql_query: "doc",
        query_language: AQL,
        export_columns: [
            Number,
        ],
    }
    subtok_annos: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "tok=\"tokenized\" | norm=\"subtokenized\"",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("annis", "tok"),
                index: 0,
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "norm"),
                index: 0,
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("structure", "line"),
                index: 0,
            })),
        ],
    }
    subtok_segmentation_tokens: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
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
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 0,
            })),
            Data(Text(TestExportDataText {
                left_context: 4,
                right_context: 4,
                segmentation: None,
                primary_node_indices: None,
            })),
        ],
    }
    subtok_segmentation_diplomatic: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
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
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 0,
            })),
            Data(Text(TestExportDataText {
                left_context: 4,
                right_context: 4,
                segmentation: Some("diplomatic"),
                primary_node_indices: None,
            })),
        ],
    }
    subtok_segmentation_norm: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
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
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 0,
            })),
            Data(Text(TestExportDataText {
                left_context: 4,
                right_context: 4,
                segmentation: Some("norm"),
                primary_node_indices: None,
            })),
        ],
    }
    subtok_gap: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "pos=\"DT\" .5,5 pos=\"DT\"",
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
                index: 0,
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 1,
            })),
            Data(Text(TestExportDataText {
                left_context: 1,
                right_context: 1,
                segmentation: None,
                primary_node_indices: None,
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
                index: 0,
            })),
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "pos"),
                index: 1,
            })),
            Data(Text(TestExportDataText {
                left_context: 1,
                right_context: 1,
                segmentation: None,
                primary_node_indices: None,
            })),
        ],
    }
    subtok_varying_number_of_match_nodes_with_explicit_primary_node_indices: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "(pos=\"DT\" .5,5 pos=\"DT\") | pos=\"NN\"",
        query_language: AQL,
        export_columns: [
            Data(Text(TestExportDataText {
                left_context: 1,
                right_context: 1,
                segmentation: None,
                primary_node_indices: Some(&[0, 1]),
            })),
        ],
    }
    subtok_optional_nodes: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
        aql_query: "norm? !.norm,3 norm",
        query_language: AQL,
        export_columns: [
            Data(Anno(TestExportDataAnno::MatchNode {
                anno_key: ("grammar", "lemma"),
                index: 0,
            })),
            Data(Text(TestExportDataText {
                left_context: 1,
                right_context: 1,
                segmentation: Some("norm"),
                primary_node_indices: None,
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
                primary_node_indices: None,
            })),
        ],
    }
    subtok_renamed: {
        corpus_paths: ["subtok.demo_renamed_graphml.zip"],
        corpus_names: ["subtok.demo_renamed"],
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
                primary_node_indices: None,
            })),
        ],
    }
    pcc2_primary_node: {
        corpus_paths: ["pcc2_v7_relANNIS.zip"],
        corpus_names: ["pcc2"],
        aql_query: "Sent _i_ NP",
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
                index: 1,
            })),
            Data(Text(TestExportDataText {
                left_context: 10,
                right_context: 10,
                segmentation: None,
                primary_node_indices: Some(&[1]),
            })),
        ],
    }
    pcc2_primary_nodes_priority: {
        corpus_paths: ["pcc2_v7_relANNIS.zip"],
        corpus_names: ["pcc2"],
        aql_query: "Sent _i_ NP",
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
                index: 1,
            })),
            Data(Text(TestExportDataText {
                left_context: 10,
                right_context: 10,
                segmentation: None,
                primary_node_indices: Some(&[1, 0]),
            })),
        ],
    }
    pcc2_no_context: {
        corpus_paths: ["pcc2_v7_relANNIS.zip"],
        corpus_names: ["pcc2"],
        aql_query: "Sent _i_ NP",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Text(TestExportDataText {
                left_context: 0,
                right_context: 0,
                segmentation: None,
                primary_node_indices: Some(&[]),
            })),
            Data(Text(TestExportDataText {
                left_context: 0,
                right_context: 0,
                segmentation: None,
                primary_node_indices: Some(&[1]),
            })),
            Data(Text(TestExportDataText {
                left_context: 0,
                right_context: 0,
                segmentation: None,
                primary_node_indices: Some(&[0, 1]),
            })),
        ],
    }
    nocoverage: {
        corpus_paths: ["nocoverage.demo_graphml.zip"],
        corpus_names: ["nocoverage.demo"],
        aql_query: "tok=\"no\"",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Text(TestExportDataText {
                left_context: 2,
                right_context: 2,
                segmentation: None,
                primary_node_indices: None,
            })),
        ],
    }
    nondefaultsegmentation: {
        corpus_paths: ["nondefaultsegmentation.demo_graphml.zip"],
        corpus_names: ["nondefaultsegmentation.demo"],
        aql_query: "norm",
        query_language: AQL,
        export_columns: [
            Number,
            Data(Text(TestExportDataText {
                left_context: 2,
                right_context: 2,
                segmentation: Some("norm"),
                primary_node_indices: None,
            })),
        ],
    }
}

#[test]
fn export_cancelled_before_matches_found() {
    let db_dir = Path::new(DB_DIR).join("export_cancelled_before_matches_found");

    let _ = fs::remove_dir_all(&db_dir);
    let storage = Storage::from_db_dir(db_dir).unwrap();

    fs::create_dir_all(Path::new(OUTPUT_DIR)).unwrap();
    let output_file = Path::new(OUTPUT_DIR).join("export_cancelled_before_matches_found.csv");
    let _ = fs::remove_file(&output_file);

    storage
        .import_corpora(
            vec![Path::new(DATA_DIR).join("subtok.demo_relANNIS.zip")],
            |_| (),
            || false,
        )
        .unwrap();

    let result = storage.export_matches(
        ExportConfig {
            corpus_names: vec!["subtok.demo".into()],
            aql_query: "tok".into(),
            query_language: QueryLanguage::AQL,
            format: ExportFormat::Csv(CsvExportConfig {
                columns: vec![TableExportColumn::Number],
            }),
        },
        &output_file,
        |_| (),
        || true,
    );

    assert!(matches!(result, Err(AnnimateError::Cancelled)));
    assert!(!output_file.try_exists().unwrap());
}

#[test]
fn export_cancelled_after_matches_found() {
    let db_dir = Path::new(DB_DIR).join("export_cancelled_after_matches_found");

    let _ = fs::remove_dir_all(&db_dir);
    let storage = Storage::from_db_dir(db_dir).unwrap();

    fs::create_dir_all(Path::new(OUTPUT_DIR)).unwrap();
    let output_file = Path::new(OUTPUT_DIR).join("export_cancelled_after_matches_found.csv");
    let _ = fs::remove_file(&output_file);

    storage
        .import_corpora(
            vec![Path::new(DATA_DIR).join("subtok.demo_relANNIS.zip")],
            |_| (),
            || false,
        )
        .unwrap();

    let cancel_requested = Cell::new(false);

    let result = storage.export_matches(
        ExportConfig {
            corpus_names: vec!["subtok.demo".into()],
            aql_query: "tok".into(),
            query_language: QueryLanguage::AQL,
            format: ExportFormat::Csv(CsvExportConfig {
                columns: vec![TableExportColumn::Number],
            }),
        },
        &output_file,
        |event| {
            if let ExportStatusEvent::Found { .. } = event {
                cancel_requested.set(true);
            }
        },
        || cancel_requested.get(),
    );

    assert!(matches!(result, Err(AnnimateError::Cancelled)));
    assert!(!output_file.try_exists().unwrap());
}

#[derive(Serialize)]
struct TestData {
    corpus_paths: &'static [&'static str],
    corpus_names: &'static [&'static str],
    aql_query: &'static str,
    query_language: QueryLanguage,
    export_columns: Vec<TestTableExportColumn>,
}

#[derive(Clone, Serialize)]
enum TestTableExportColumn {
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
    left_context: usize,
    right_context: usize,
    segmentation: Option<&'static str>,
    primary_node_indices: Option<&'static [usize]>,
}

impl From<TestTableExportColumn> for TableExportColumn {
    fn from(column: TestTableExportColumn) -> Self {
        match column {
            TestTableExportColumn::Number => TableExportColumn::Number,
            TestTableExportColumn::Data(data) => TableExportColumn::Data(match data {
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
                    primary_node_indices,
                }) => ExportData::Text(ExportDataText {
                    left_context,
                    right_context,
                    segmentation: segmentation.map(|s| s.to_string()),
                    primary_node_indices: primary_node_indices.map(Into::into),
                }),
            }),
        }
    }
}
