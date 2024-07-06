//! This library provides the Annimate core functionality.

use std::collections::btree_map::Entry;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use anno::AnnoKeys;
use corpus::CorpusRef;
use error::cancel_if;
use format::export;
use graphannis::corpusstorage::CacheStrategy;
use import::{FilesystemEntity, ImportFormat, ImportableCorpus};
use itertools::Itertools;
use metadata::{CorpusSet, MetadataStorage};
use query::Query;
use serde::Serialize;

mod anno;
mod aql;
mod corpus;
mod error;
mod format;
mod import;
mod metadata;
mod node_name;
mod query;
mod util;
mod version;

pub use anno::{ExportableAnnoKey, ExportableAnnoKeys};
pub use aql::{QueryAnalysisResult, QueryNode, QueryNodes};
pub use error::AnnimateError;
pub use format::{CsvExportConfig, ExportFormat, TableExportColumn, XlsxExportConfig};
pub use graphannis::corpusstorage::CorpusInfo;
pub use graphannis::graph::AnnoKey;
pub use query::{ExportData, ExportDataAnno, ExportDataText, QueryLanguage};
use tempfile::PersistError;
pub use version::{VersionInfo, VERSION_INFO};

/// Storage of corpora and metadata.
pub struct Storage {
    corpus_storage: graphannis::CorpusStorage,
    metadata_storage: MetadataStorage,
}

impl Storage {
    /// Creates a [Storage] from a database directory.
    pub fn from_db_dir<P>(db_dir: P) -> Result<Self, AnnimateError>
    where
        P: AsRef<Path>,
    {
        let corpus_storage = graphannis::CorpusStorage::with_cache_strategy(
            db_dir.as_ref(),
            CacheStrategy::PercentOfFreeMemory(25.0),
            true, /* use_parallel_joins */
        )?;

        let metadata_storage = MetadataStorage::from_db_dir(
            &db_dir,
            &corpus_storage
                .list()?
                .into_iter()
                .map(|c| c.name)
                .collect_vec(),
        )?;

        Ok(Self {
            corpus_storage,
            metadata_storage,
        })
    }

    /// Returns information about stored corpora.
    pub fn corpora(&self) -> Result<Corpora, AnnimateError> {
        let sets = self.metadata_storage.corpus_sets();

        let corpora = self
            .corpus_storage
            .list()?
            .into_iter()
            .sorted_by(|a, b| a.name.cmp(&b.name))
            .map(|c| {
                let included_in_sets = sets
                    .iter()
                    .filter(|(_, CorpusSet { corpus_names })| corpus_names.contains(&c.name))
                    .map(|(name, _)| name.clone())
                    .collect();

                Corpus {
                    name: c.name,
                    included_in_sets,
                }
            })
            .collect();

        Ok(Corpora {
            sets: sets.keys().cloned().collect(),
            corpora,
        })
    }

    /// Deletes a corpus.
    pub fn delete_corpus(&self, corpus_name: &str) -> Result<(), AnnimateError> {
        self.corpus_storage.delete(corpus_name)?;
        self.metadata_storage.update_corpus_sets(|corpus_sets| {
            for CorpusSet { corpus_names } in corpus_sets.values_mut() {
                corpus_names.remove(corpus_name);
            }
        })?;

        Ok(())
    }

    /// Imports corpora.
    pub fn import_corpora<F, G>(
        &self,
        paths: Vec<PathBuf>,
        on_status: F,
        cancel_requested: G,
    ) -> Result<Vec<String>, AnnimateError>
    where
        F: Fn(ImportStatusEvent),
        G: Fn() -> bool,
    {
        let mut imported_corpus_names = Vec::new();

        let importable_corpora = import::find_importable_corpora(
            paths,
            |message| {
                on_status(ImportStatusEvent::Message {
                    index: None,
                    message: message.into(),
                });
            },
            &cancel_requested,
        )?;

        on_status(ImportStatusEvent::CorporaFound {
            corpora: importable_corpora.iter().map_into().collect(),
        });

        for (index, corpus) in importable_corpora.into_iter().enumerate() {
            let result = import::import_corpus(
                &self.corpus_storage,
                &corpus,
                || on_status(ImportStatusEvent::CorpusImportStarted { index }),
                |message| {
                    on_status(ImportStatusEvent::Message {
                        index: Some(index),
                        message: message.into(),
                    });
                },
                &cancel_requested,
            );

            match result {
                Ok(imported_corpus_name) => {
                    imported_corpus_names.push(imported_corpus_name.clone());

                    on_status(ImportStatusEvent::CorpusImportFinished {
                        index,
                        result: ImportCorpusResult::Imported {
                            name: imported_corpus_name,
                        },
                    });
                }
                Err(err) => {
                    on_status(ImportStatusEvent::CorpusImportFinished {
                        index,
                        result: ImportCorpusResult::Failed {
                            message: err.to_string(),
                            cancelled: err.cancelled(),
                        },
                    });
                }
            }
        }

        Ok(imported_corpus_names)
    }

    /// Creates a new corpus set.
    pub fn create_corpus_set(&self, corpus_set_name: String) -> Result<(), AnnimateError> {
        self.metadata_storage.try_update_corpus_sets(|corpus_sets| {
            match corpus_sets.entry(corpus_set_name) {
                Entry::Vacant(entry) => {
                    entry.insert(CorpusSet::default());
                    Ok(())
                }
                Entry::Occupied(_) => Err(AnnimateError::CorpusSetAlreadyExists),
            }
        })
    }

    /// Deletes a corpus set.
    pub fn delete_corpus_set(
        &self,
        corpus_set_name: String,
        delete_corpora: bool,
    ) -> Result<(), AnnimateError> {
        let mut failed_corpus_names = Vec::new();

        self.metadata_storage.update_corpus_sets(|corpus_sets| {
            let Entry::Occupied(mut entry) = corpus_sets.entry(corpus_set_name) else {
                return;
            };

            let mut deleted_corpus_names = Vec::new();
            let corpus_names = &mut entry.get_mut().corpus_names;

            if delete_corpora {
                while let Some(corpus_name) = corpus_names.pop_first() {
                    match self.corpus_storage.delete(&corpus_name) {
                        Ok(_) => deleted_corpus_names.push(corpus_name),
                        Err(_) => {
                            failed_corpus_names.push(corpus_name);
                        }
                    }
                }
            }

            if failed_corpus_names.is_empty() {
                entry.remove();
            } else {
                corpus_names.extend(failed_corpus_names.clone());
            }

            for corpus_name in deleted_corpus_names {
                for CorpusSet { corpus_names } in corpus_sets.values_mut() {
                    corpus_names.remove(&corpus_name);
                }
            }
        })?;

        if failed_corpus_names.is_empty() {
            Ok(())
        } else {
            Err(AnnimateError::FailedToDeleteCorpora(
                failed_corpus_names.into(),
            ))
        }
    }

    /// Renames a corpus set.
    pub fn rename_corpus_set(
        &self,
        corpus_set_name: &str,
        new_corpus_set_name: String,
    ) -> Result<(), AnnimateError> {
        self.metadata_storage.try_update_corpus_sets(|corpus_sets| {
            match corpus_sets.remove(corpus_set_name) {
                Some(corpus_set) => match corpus_sets.entry(new_corpus_set_name) {
                    Entry::Vacant(entry) => {
                        entry.insert(corpus_set);
                        Ok(())
                    }
                    Entry::Occupied(_) => Err(AnnimateError::CorpusSetAlreadyExists),
                },
                None => Ok(()),
            }
        })
    }

    /// Adds corpora to a set.
    pub fn add_corpora_to_set<S>(
        &self,
        corpus_set_name: String,
        corpus_names: &[S],
    ) -> Result<(), AnnimateError>
    where
        S: AsRef<str>,
    {
        if corpus_names.is_empty() {
            return Ok(());
        }

        self.metadata_storage.update_corpus_sets(|corpus_sets| {
            corpus_sets
                .entry(corpus_set_name)
                .or_default()
                .corpus_names
                .extend(corpus_names.iter().map(|c| c.as_ref().into()));
        })?;

        Ok(())
    }

    /// Adds or removes a corpus to/from a set.
    pub fn toggle_corpus_in_set(
        &self,
        corpus_set_name: &str,
        corpus_name: &str,
    ) -> Result<(), AnnimateError> {
        self.metadata_storage.update_corpus_sets(|corpus_sets| {
            if let Some(CorpusSet { corpus_names }) = corpus_sets.get_mut(corpus_set_name) {
                if !corpus_names.remove(corpus_name) {
                    corpus_names.insert(corpus_name.into());
                }
            }
        })?;

        Ok(())
    }

    /// Validates an AQL query.
    pub fn validate_query<S>(
        &self,
        corpus_names: &[S],
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryAnalysisResult<()>, AnnimateError>
    where
        S: AsRef<str>,
    {
        let analysis_result =
            aql::validate_query(self.corpus_ref(corpus_names), aql_query, query_language)?;

        Ok(analysis_result)
    }

    /// Returns the nodes of an AQL query.
    pub fn query_nodes(
        &self,
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryAnalysisResult<QueryNodes>, AnnimateError> {
        let query_nodes = aql::query_nodes(&self.corpus_storage, aql_query, query_language)?;

        Ok(query_nodes)
    }

    /// Returns all exportable annotation keys for the given corpora.
    ///
    /// This collects all exportable annotation keys for corpora, documents and general nodes that
    /// appear in *at least one* of the given corpora.
    pub fn exportable_anno_keys<S>(
        &self,
        corpus_names: &[S],
    ) -> Result<ExportableAnnoKeys, AnnimateError>
    where
        S: AsRef<str>,
    {
        let exportable_anno_keys = AnnoKeys::new(self.corpus_ref(corpus_names))?.into_exportable();

        Ok(exportable_anno_keys)
    }

    /// Returns all segmentations for the given corpora.
    ///
    /// This collects the segmentations (i.e. names of
    /// [`Ordering`](https://docs.rs/graphannis/latest/graphannis/model/enum.AnnotationComponentType.html#variant.Ordering)
    /// components in the `default_ns` namespace) that appear in *all* of the given corpora.
    pub fn segmentations<S>(&self, corpus_names: &[S]) -> Result<Vec<String>, AnnimateError>
    where
        S: AsRef<str>,
    {
        let segmentations = anno::segmentations(self.corpus_ref(corpus_names))?;

        Ok(segmentations)
    }

    /// Exports matches for a query.
    pub fn export_matches<F, G, P, S>(
        &self,
        config: ExportConfig<'_, S>,
        output_file: P,
        on_status: F,
        cancel_requested: G,
    ) -> Result<(), AnnimateError>
    where
        F: Fn(ExportStatusEvent),
        G: Fn() -> bool,
        P: AsRef<Path>,
        S: AsRef<str>,
    {
        cancel_if(&cancel_requested)?;

        let anno_keys = AnnoKeys::new(self.corpus_ref(config.corpus_names))?;
        let query = Query::new(
            self.corpus_ref(config.corpus_names),
            config.aql_query,
            config.query_language,
        )?;
        let matches = query.find(config.format.get_export_data())?;

        cancel_if(&cancel_requested)?;

        on_status(ExportStatusEvent::Found {
            count: matches.total_count(),
        });

        let mut out = tempfile::Builder::new().prefix(".annimate_").tempfile()?;

        export(
            config.format,
            matches,
            query.nodes(),
            anno_keys.format(),
            &mut out,
            |progress| on_status(ExportStatusEvent::Exported { progress }),
            &cancel_requested,
        )?;

        cancel_if(cancel_requested)?;

        out.flush()?;

        match out.persist(&output_file) {
            Err(PersistError { file, .. }) => {
                // In case the file cannot be persisted, most likely because persisting would cross
                // file systems, copy the file as a workaround
                // Once io::ErrorKind::CrossesDevices is stable, we can match on it and only apply
                // the workaround in that case
                fs::copy(file.path(), output_file)?;
            }
            result => {
                result.map_err(io::Error::from)?;
            }
        };

        Ok(())
    }

    fn corpus_ref<'a, S>(&'a self, corpus_names: &'a [S]) -> CorpusRef<'a, S> {
        CorpusRef::new(&self.corpus_storage, corpus_names)
    }
}

/// Information about the corpora stored in a [Storage].
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Corpora {
    /// All corpora.
    pub corpora: Vec<Corpus>,

    /// Names of all corpus sets.
    pub sets: Vec<String>,
}

impl Corpora {
    /// Returns the number of corpora.
    pub fn corpus_count(&self) -> usize {
        self.corpora.len()
    }
}

/// Information about a corpus.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Corpus {
    /// Name of the corpus.
    pub name: String,

    /// Names of sets that include the corpus.
    pub included_in_sets: Vec<String>,
}

/// Configuration of a request to export matches.
pub struct ExportConfig<'a, S> {
    /// Names of the corpora to run a query on.
    pub corpus_names: &'a [S],

    /// AQL query to run.
    pub aql_query: &'a str,

    /// Language of the query to run.
    pub query_language: QueryLanguage,

    /// Format in which to export matches.
    pub format: ExportFormat,
}

/// Event describing the status of an ongoing export.
#[derive(Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ExportStatusEvent {
    /// Corpora were found.
    Found {
        /// Number of corpora found.
        count: usize,
    },
    /// Corpora were exported.
    Exported {
        /// Progress of the export, in `0..=1`.
        progress: f32,
    },
}
/// Event describing the status of an ongoing import.
#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ImportStatusEvent {
    /// Corpora were found
    CorporaFound {
        /// Found corpora.
        corpora: Vec<ImportCorpus>,
    },
    /// Import of a corpus was started.
    CorpusImportStarted {
        /// Index of the corpus within the list of corpora.
        index: usize,
    },
    /// Import of a corpus was finished.
    CorpusImportFinished {
        /// Index of the corpus within the list of corpora.
        index: usize,
        /// Result of the import.
        result: ImportCorpusResult,
    },
    /// Message was emitted.
    Message {
        /// Index of the corpus the message refers to, or [None] if the message was emitted while
        /// corpora were being
        index: Option<usize>,
        /// The emitted message.
        message: String,
    },
}

/// A corpus being imported.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCorpus {
    file_name: String,
    format: ImportFormat,
    trace: Vec<FilesystemEntity<String>>,
}

impl From<&ImportableCorpus> for ImportCorpus {
    fn from(importable_corpus: &ImportableCorpus) -> ImportCorpus {
        ImportCorpus {
            file_name: importable_corpus.file_name.clone(),
            format: importable_corpus.format,
            trace: importable_corpus.trace.clone(),
        }
    }
}

/// Result of importing a corpus.
#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
#[serde(rename_all_fields = "camelCase")]
pub enum ImportCorpusResult {
    /// The corpus was imported successfully.
    Imported {
        /// Name of the imported corpus.
        name: String,
    },
    /// The corpus failed to import.
    Failed {
        /// Error message.
        message: String,
        /// Whether the import was cancelled.
        cancelled: bool,
    },
}
