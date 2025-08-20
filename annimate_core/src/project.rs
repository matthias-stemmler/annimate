use std::fs;
use std::path::Path;
use std::str::FromStr;

use graphannis::corpusstorage::QueryLanguage;
use graphannis::graph::AnnoKey;
use serde::Deserialize;

use crate::AnnimateError;
use crate::error::AnnimateReadFileError;

const FILE_HEADER: &str =
    "# Annimate project file\n# https://github.com/matthias-stemmler/annimate\n\n";

/// Annimate project, to be saved to and loaded from a file.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Project {
    /// Currently selected corpus set.
    pub corpus_set: Option<String>,

    /// Names of currently selected corpora.
    #[serde(default, rename = "corpora")]
    pub corpus_names: Vec<String>,

    /// Currently entered AQL query.
    #[serde(default, rename = "query")]
    pub aql_query: String,

    /// Currently selected query language.
    #[serde(with = "query_language")]
    pub query_language: QueryLanguage,

    /// Currently configured columns to export.
    #[serde(default, rename = "columns")]
    pub export_columns: Vec<ProjectExportColumn>,

    /// Currently selected export format.
    pub export_format: ProjectExportFormat,
}

/// Column to export as configured in a project.
///
/// See [`crate::format::TableExportColumn`].
#[allow(missing_docs)]
#[derive(Debug, Deserialize)]
#[serde(rename_all_fields = "kebab-case", tag = "type")]
pub enum ProjectExportColumn {
    #[serde(rename = "number")]
    Number,
    #[serde(rename = "corpus-metadata")]
    AnnoCorpus {
        #[serde(rename = "annotation")]
        anno_key: Option<AnnoKey>,
    },
    #[serde(rename = "document-metadata")]
    AnnoDocument {
        #[serde(rename = "annotation")]
        anno_key: Option<AnnoKey>,
    },
    #[serde(rename = "match-annotation")]
    AnnoMatch {
        #[serde(rename = "annotation")]
        anno_key: Option<AnnoKey>,
        node_index: Option<u32>,
    },
    #[serde(rename = "match-in-context")]
    MatchInContext {
        segmentation: Option<String>,
        context: ProjectContext,
        #[serde(default)]
        primary_node_indices: Vec<u32>,
    },
}

/// Context configuration for a "match in context" column as configured in a project.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case", rename_all_fields = "kebab-case", untagged)]
pub enum ProjectContext {
    /// Same context size on both sides.
    Symmetric(u32),

    /// Different context sizes on both sides.
    Asymmetric {
        /// Context size on the left.
        left: u32,

        /// Context size on the right.
        right: u32,
    },
}

/// Export format as configured in a project.
///
/// See [`crate::format::ExportFormat`].
#[allow(missing_docs)]
#[derive(Debug, Deserialize)]
#[serde(rename_all = "kebab-case", rename_all_fields = "kebab-case")]
pub enum ProjectExportFormat {
    Csv,
    Xlsx,
}

#[derive(Deserialize)]
struct FormatVersion {
    #[serde(rename = "format-version")]
    value: u32,
}

impl FormatVersion {
    const CURRENT: Self = Self { value: 1 };

    fn validate(self) -> Result<(), AnnimateReadFileError> {
        if self.value == 0 || self.value > Self::CURRENT.value {
            Err(AnnimateReadFileError::UnsupportedVersion {
                version: self.value,
            })
        } else {
            Ok(())
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "kebab-case")]
struct ProjectFile {
    #[serde(flatten)]
    format_version: FormatVersion,
    project: Project,
}

impl FromStr for ProjectFile {
    type Err = AnnimateReadFileError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        toml::from_str::<FormatVersion>(s)?.validate()?;
        Ok(toml::from_str(s)?)
    }
}

/// Loads a project from a file.
pub fn load_project<P>(path: P) -> Result<Project, AnnimateError>
where
    P: AsRef<Path>,
{
    let path = path.as_ref();
    let project_file: ProjectFile = fs::read_to_string(path)?
        .parse()
        .map_err(AnnimateError::FailedToReadProject)?;
    Ok(project_file.project)
}

/// Saves a project to a file.
pub fn save_project<P>(project: Project, path: P) -> Result<(), AnnimateError>
where
    P: AsRef<Path>,
{
    let project_file = ProjectFile {
        format_version: FormatVersion::CURRENT,
        project,
    };
    fs::write(path, to_string_pretty(project_file))?;
    Ok(())
}

// We manually build a `toml_edit::DocumentMut` instead of using `toml::to_string_pretty`
// in order to make the formatting more stable, which produces smaller diffs when project files are
// checked into a VCS. We still don't have full control, e.g. we can't control the style of strings (https://toml.io/en/v1.0.0#string).
fn to_string_pretty(project_file: ProjectFile) -> String {
    let mut document = toml_edit::DocumentMut::new();

    document.decor_mut().set_prefix(FILE_HEADER);

    document["format-version"] = i64::from(project_file.format_version.value).into();

    document["project"] = {
        let mut table = toml_edit::Table::new();

        if let Some(corpus_set) = project_file.project.corpus_set {
            table["corpus-set"] = corpus_set.into();
        }

        if !project_file.project.corpus_names.is_empty() {
            let mut corpora_array = project_file
                .project
                .corpus_names
                .into_iter()
                .collect::<toml_edit::Array>();

            // Make multiline if it has more than one item
            if corpora_array.len() > 1 {
                for item in corpora_array.iter_mut() {
                    item.decor_mut().set_prefix("\n    ");
                }
                corpora_array.set_trailing("\n");
                corpora_array.set_trailing_comma(true);
            }

            table["corpora"] = corpora_array.into();
        }

        if !project_file.project.aql_query.is_empty() {
            table["query"] = project_file.project.aql_query.into();
        }

        table["query-language"] = match project_file.project.query_language {
            QueryLanguage::AQL => query_language::TAG_AQL,
            QueryLanguage::AQLQuirksV3 => query_language::TAG_AQL_QUIRKS_V3,
        }
        .into();

        table["columns"] = project_file
            .project
            .export_columns
            .into_iter()
            .map(|column| {
                let mut table = toml_edit::Table::new();

                match column {
                    ProjectExportColumn::Number => {
                        table["type"] = "number".into();
                    }
                    ProjectExportColumn::AnnoCorpus { anno_key } => {
                        table["type"] = "corpus-metadata".into();
                        if let Some(anno_key) = anno_key {
                            table["annotation"] = anno_key_to_item(anno_key);
                        }
                    }
                    ProjectExportColumn::AnnoDocument { anno_key } => {
                        table["type"] = "document-metadata".into();
                        if let Some(anno_key) = anno_key {
                            table["annotation"] = anno_key_to_item(anno_key);
                        }
                    }
                    ProjectExportColumn::AnnoMatch {
                        anno_key,
                        node_index,
                    } => {
                        table["type"] = "match-annotation".into();
                        if let Some(anno_key) = anno_key {
                            table["annotation"] = anno_key_to_item(anno_key);
                        }
                        if let Some(node_index) = node_index {
                            table["node-index"] = i64::from(node_index).into();
                        }
                    }
                    ProjectExportColumn::MatchInContext {
                        context,
                        primary_node_indices,
                        segmentation,
                    } => {
                        table["type"] = "match-in-context".into();

                        if let Some(segmentation) = segmentation {
                            table["segmentation"] = segmentation.into();
                        }

                        table["context"] = match context {
                            ProjectContext::Symmetric(size) => i64::from(size).into(),
                            ProjectContext::Asymmetric { left, right } => {
                                let mut table = toml_edit::InlineTable::new();
                                table.insert("left", i64::from(left).into());
                                table.insert("right", i64::from(right).into());
                                table.into()
                            }
                        };

                        if !primary_node_indices.is_empty() {
                            table["primary-node-indices"] = primary_node_indices
                                .into_iter()
                                .map(i64::from)
                                .collect::<toml_edit::Value>()
                                .into();
                        }
                    }
                };

                table
            })
            .collect::<toml_edit::ArrayOfTables>()
            .into();

        table["export-format"] = match project_file.project.export_format {
            ProjectExportFormat::Csv => "csv",
            ProjectExportFormat::Xlsx => "xlsx",
        }
        .into();

        table.into()
    };

    document.to_string()
}

fn anno_key_to_item(anno_key: AnnoKey) -> toml_edit::Item {
    let mut table = toml_edit::InlineTable::new();

    table.insert("ns", anno_key.ns.into());
    table.insert("name", anno_key.name.into());

    table.into()
}

mod query_language {
    use std::fmt;

    use graphannis::corpusstorage::QueryLanguage;
    use serde::Deserializer;
    use serde::de::{Unexpected, Visitor};

    pub(super) const TAG_AQL: &str = "aql";
    pub(super) const TAG_AQL_QUIRKS_V3: &str = "aql-compatibility";

    pub(super) fn deserialize<'de, D>(deserializer: D) -> Result<QueryLanguage, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_string(QueryLanguageVisitor)
    }

    struct QueryLanguageVisitor;

    impl Visitor<'_> for QueryLanguageVisitor {
        type Value = QueryLanguage;

        fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            write!(f, "{TAG_AQL} or {TAG_AQL_QUIRKS_V3}")
        }

        fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
        where
            E: serde::de::Error,
        {
            match v {
                v if v == TAG_AQL => Ok(QueryLanguage::AQL),
                v if v == TAG_AQL_QUIRKS_V3 => Ok(QueryLanguage::AQLQuirksV3),
                _ => Err(E::invalid_value(Unexpected::Str(v), &self)),
            }
        }
    }
}
