use std::fs;
use std::path::Path;

use annimate_core::{
    AnnoKey, Project, ProjectContext, ProjectExportColumn, ProjectExportFormat, QueryLanguage,
};
use serde::Serialize;

const OUTPUT_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/project/output");

macro_rules! project_test {
    ($(
        $name:ident: {
            corpus_set: $corpus_set:expr,
            corpus_names: $corpus_names:expr,
            aql_query: $aql_query:expr,
            query_language: $query_language:expr,
            export_columns: [$($export_column:expr),*$(,)?],
            export_format: $export_format:expr,
        }
    )*) => { $(
        #[test]
        fn $name() {
            let test_project = TestProject {
                corpus_set: $corpus_set,
                corpus_names: &$corpus_names,
                aql_query: $aql_query,
                query_language: {
                    use QueryLanguage::*;
                    $query_language
                },
                export_columns: {
                    #[allow(unused_imports)]
                    use TestProjectExportColumn::*;
                    #[allow(unused_imports)]
                    use TestProjectContext::*;
                    vec![$($export_column,)*]
                },
                export_format: {
                    use TestProjectExportFormat::*;
                    $export_format
                },
            };
            let project = test_project.clone().into();
            let project_debug = format!("{:?}", project);

            fs::create_dir_all(Path::new(OUTPUT_DIR)).unwrap();
            let project_file = Path::new(OUTPUT_DIR).join(concat!(stringify!($name), ".anmt"));
            let _ = fs::remove_file(&project_file);

            annimate_core::save_project(project, &project_file).unwrap();

            let output = fs::read_to_string(&project_file).unwrap();
            insta::with_settings!(
                {
                    info => &test_project,
                    omit_expression => true,
                },
                { insta::assert_snapshot!(output) }
            );

            let loaded_project = annimate_core::load_project(&project_file).unwrap();

            assert_eq!(project_debug, format!("{:?}", loaded_project));
        }
    )* };
}

project_test! {
    default: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "",
        query_language: AQL,
        export_columns: [],
        export_format: Csv,
    }
    with_corpus_set: {
        corpus_set: Some("Test Corpus Set"),
        corpus_names: [],
        aql_query: "",
        query_language: AQL,
        export_columns: [],
        export_format: Csv,
    }
    with_one_corpus_name: {
        corpus_set: None,
        corpus_names: ["Test Corpus 1"],
        aql_query: "",
        query_language: AQL,
        export_columns: [],
        export_format: Csv,
    }
    with_two_corpus_names: {
        corpus_set: None,
        corpus_names: ["Test Corpus 1", "Test Corpus 2"],
        aql_query: "",
        query_language: AQL,
        export_columns: [],
        export_format: Csv,
    }
    with_aql_query: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "Test AQL query",
        query_language: AQL,
        export_columns: [],
        export_format: Csv,
    }
    with_aql_query_complex: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "a'''\"\nb",
        query_language: AQL,
        export_columns: [],
        export_format: Csv,
    }
    with_query_language_aql_quirks_v3: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "",
        query_language: AQLQuirksV3,
        export_columns: [],
        export_format: Csv,
    }
    with_export_columns_default: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "",
        query_language: AQL,
        export_columns: [
            Number,
            AnnoCorpus {
                anno_key: None,
            },
            AnnoDocument {
                anno_key: None,
            },
            AnnoMatch {
                anno_key: None,
                node_index: None,
            },
            MatchInContext {
                segmentation: None,
                context: Symmetric(20),
                primary_node_indices: &[],
            },
        ],
        export_format: Csv,
    }
    with_export_columns_with_annos: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "",
        query_language: AQL,
        export_columns: [
            AnnoCorpus {
                anno_key: Some(("ns1", "anno1")),
            },
            AnnoDocument {
                anno_key: Some(("ns2", "anno2")),
            },
            AnnoMatch {
                anno_key: Some(("ns3", "anno3")),
                node_index: None,
            },
        ],
        export_format: Csv,
    }
    with_export_columns_with_node_indices: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "",
        query_language: AQL,
        export_columns: [
            AnnoMatch {
                anno_key: None,
                node_index: Some(0),
            },
            MatchInContext {
                segmentation: None,
                context: Symmetric(20),
                primary_node_indices: &[1, 2, 3],
            },
        ],
        export_format: Csv,
    }
    with_export_columns_with_asymmetric_context: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "",
        query_language: AQL,
        export_columns: [
            MatchInContext {
                segmentation: None,
                context: Asymmetric { left: 5, right: 10 },
                primary_node_indices: &[],
            },
        ],
        export_format: Csv,
    }
    with_export_columns_with_segmentation: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "",
        query_language: AQL,
        export_columns: [
            MatchInContext {
                segmentation: Some("Test Segmentation"),
                context: Symmetric(20),
                primary_node_indices: &[],
            },
        ],
        export_format: Csv,
    }
    with_export_format_xlsx: {
        corpus_set: None,
        corpus_names: [],
        aql_query: "",
        query_language: AQL,
        export_columns: [],
        export_format: Xlsx,
    }
    full: {
        corpus_set: Some("Test Corpus Set"),
        corpus_names: ["Test Corpus 1", "Test Corpus 2"],
        aql_query: "Test AQL query",
        query_language: AQLQuirksV3,
        export_columns: [
            Number,
            AnnoCorpus {
                anno_key: Some(("ns1", "anno1")),
            },
            AnnoDocument {
                anno_key: Some(("ns2", "anno2")),
            },
            AnnoMatch {
                anno_key: Some(("ns3", "anno3")),
                node_index: Some(0),
            },
            MatchInContext {
                segmentation: Some("Test Segmentation"),
                context: Asymmetric { left: 5, right: 10 },
                primary_node_indices: &[1, 2, 3],
            },
        ],
        export_format: Xlsx,
    }
}

#[derive(Clone, Serialize)]
struct TestProject {
    corpus_set: Option<&'static str>,
    corpus_names: &'static [&'static str],
    aql_query: &'static str,
    query_language: QueryLanguage,
    export_columns: Vec<TestProjectExportColumn>,
    export_format: TestProjectExportFormat,
}

#[derive(Clone, Serialize)]
enum TestProjectExportColumn {
    Number,
    AnnoCorpus {
        anno_key: Option<(&'static str, &'static str)>,
    },
    AnnoDocument {
        anno_key: Option<(&'static str, &'static str)>,
    },
    AnnoMatch {
        anno_key: Option<(&'static str, &'static str)>,
        node_index: Option<u32>,
    },
    MatchInContext {
        segmentation: Option<&'static str>,
        context: TestProjectContext,
        primary_node_indices: &'static [u32],
    },
}

#[derive(Clone, Serialize)]
enum TestProjectContext {
    Symmetric(u32),
    Asymmetric { left: u32, right: u32 },
}

#[derive(Clone, Serialize)]
enum TestProjectExportFormat {
    Csv,
    Xlsx,
}

impl From<TestProject> for Project {
    fn from(test_project: TestProject) -> Self {
        Project {
            corpus_set: test_project.corpus_set.map(ToString::to_string),
            corpus_names: test_project
                .corpus_names
                .iter()
                .map(ToString::to_string)
                .collect(),
            aql_query: test_project.aql_query.to_string(),
            query_language: test_project.query_language,
            export_columns: test_project
                .export_columns
                .into_iter()
                .map(Into::into)
                .collect(),
            export_format: test_project.export_format.into(),
        }
    }
}

impl From<TestProjectExportColumn> for ProjectExportColumn {
    fn from(test_export_column: TestProjectExportColumn) -> Self {
        match test_export_column {
            TestProjectExportColumn::Number => ProjectExportColumn::Number,
            TestProjectExportColumn::AnnoCorpus { anno_key } => ProjectExportColumn::AnnoCorpus {
                anno_key: anno_key.map(|(ns, name)| AnnoKey {
                    ns: ns.into(),
                    name: name.into(),
                }),
            },
            TestProjectExportColumn::AnnoDocument { anno_key } => {
                ProjectExportColumn::AnnoDocument {
                    anno_key: anno_key.map(|(ns, name)| AnnoKey {
                        ns: ns.into(),
                        name: name.into(),
                    }),
                }
            }
            TestProjectExportColumn::AnnoMatch {
                anno_key,
                node_index,
            } => ProjectExportColumn::AnnoMatch {
                anno_key: anno_key.map(|(ns, name)| AnnoKey {
                    ns: ns.into(),
                    name: name.into(),
                }),
                node_index,
            },
            TestProjectExportColumn::MatchInContext {
                segmentation,
                context,
                primary_node_indices,
            } => ProjectExportColumn::MatchInContext {
                segmentation: segmentation.map(|s| s.to_string()),
                context: context.into(),
                primary_node_indices: primary_node_indices.into(),
            },
        }
    }
}

impl From<TestProjectContext> for ProjectContext {
    fn from(test_context: TestProjectContext) -> Self {
        match test_context {
            TestProjectContext::Symmetric(c) => ProjectContext::Symmetric(c),
            TestProjectContext::Asymmetric { left, right } => {
                ProjectContext::Asymmetric { left, right }
            }
        }
    }
}

impl From<TestProjectExportFormat> for ProjectExportFormat {
    fn from(test_export_format: TestProjectExportFormat) -> Self {
        match test_export_format {
            TestProjectExportFormat::Csv => ProjectExportFormat::Csv,
            TestProjectExportFormat::Xlsx => ProjectExportFormat::Xlsx,
        }
    }
}
