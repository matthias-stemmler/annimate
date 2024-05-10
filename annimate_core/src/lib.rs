use std::collections::btree_map::Entry;
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
pub use error::AnnisExportError;
pub use format::{CsvExportColumn, CsvExportConfig, ExportFormat};
pub use graphannis::corpusstorage::CorpusInfo;
pub use graphannis::graph::AnnoKey;
pub use import::ImportedCorpus;
pub use query::{ExportData, ExportDataAnno, ExportDataText, QueryLanguage};
pub use version::{VersionInfo, VERSION_INFO};

pub struct Storage {
    corpus_storage: graphannis::CorpusStorage,
    metadata_storage: MetadataStorage,
}

impl Storage {
    pub fn from_db_dir<P>(db_dir: P) -> Result<Self, AnnisExportError>
    where
        P: AsRef<Path>,
    {
        let corpus_storage = graphannis::CorpusStorage::with_cache_strategy(
            db_dir.as_ref(),
            CacheStrategy::PercentOfFreeMemory(25.0),
            true,
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

    pub fn corpora(&self) -> Result<Corpora, AnnisExportError> {
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

    pub fn delete_corpus(&self, corpus_name: &str) -> Result<(), AnnisExportError> {
        self.corpus_storage.delete(corpus_name)?;
        self.metadata_storage.update_corpus_sets(|corpus_sets| {
            for CorpusSet { corpus_names } in corpus_sets.values_mut() {
                corpus_names.remove(corpus_name);
            }
        })?;
        Ok(())
    }

    pub fn import_corpora<F, G>(
        &self,
        paths: Vec<PathBuf>,
        on_status: F,
        cancel_requested: G,
    ) -> Result<Vec<String>, AnnisExportError>
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
                corpus,
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
                Ok(imported_corpus) => {
                    imported_corpus_names.push(imported_corpus.imported_name.clone());

                    on_status(ImportStatusEvent::CorpusImportFinished {
                        index,
                        result: ImportCorpusResult::Imported {
                            corpus: imported_corpus,
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

    pub fn create_corpus_set(&self, corpus_set_name: String) -> Result<(), AnnisExportError> {
        self.metadata_storage.try_update_corpus_sets(|corpus_sets| {
            match corpus_sets.entry(corpus_set_name) {
                Entry::Vacant(entry) => {
                    entry.insert(Default::default());
                    Ok(())
                }
                Entry::Occupied(_) => Err(AnnisExportError::CorpusSetAlreadyExists),
            }
        })
    }

    pub fn rename_corpus_set(
        &self,
        corpus_set_name: &str,
        new_corpus_set_name: String,
    ) -> Result<(), AnnisExportError> {
        self.metadata_storage.try_update_corpus_sets(|corpus_sets| {
            match corpus_sets.remove(corpus_set_name) {
                Some(corpus_set) => match corpus_sets.entry(new_corpus_set_name) {
                    Entry::Vacant(entry) => {
                        entry.insert(corpus_set);
                        Ok(())
                    }
                    Entry::Occupied(_) => Err(AnnisExportError::CorpusSetAlreadyExists),
                },
                None => Ok(()),
            }
        })
    }

    pub fn add_corpora_to_set<S>(
        &self,
        corpus_set_name: String,
        corpus_names: &[S],
    ) -> Result<(), AnnisExportError>
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

    pub fn toggle_corpus_in_set(
        &self,
        corpus_set_name: &str,
        corpus_name: &str,
    ) -> Result<(), AnnisExportError> {
        self.metadata_storage.update_corpus_sets(|corpus_sets| {
            if let Some(CorpusSet { corpus_names }) = corpus_sets.get_mut(corpus_set_name) {
                if !corpus_names.remove(corpus_name) {
                    corpus_names.insert(corpus_name.into());
                }
            }
        })?;

        Ok(())
    }

    pub fn validate_query<S>(
        &self,
        corpus_names: &[S],
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryAnalysisResult<()>, AnnisExportError>
    where
        S: AsRef<str>,
    {
        Ok(aql::validate_query(
            self.corpus_ref(corpus_names),
            aql_query,
            query_language,
        )?)
    }

    pub fn query_nodes(
        &self,
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryAnalysisResult<QueryNodes>, AnnisExportError> {
        Ok(aql::query_nodes(
            &self.corpus_storage,
            aql_query,
            query_language,
        )?)
    }

    pub fn exportable_anno_keys<S>(
        &self,
        corpus_names: &[S],
    ) -> Result<ExportableAnnoKeys, AnnisExportError>
    where
        S: AsRef<str>,
    {
        Ok(AnnoKeys::new(self.corpus_ref(corpus_names)).map(AnnoKeys::into_exportable)?)
    }

    pub fn segmentations<S>(&self, corpus_names: &[S]) -> Result<Vec<String>, AnnisExportError>
    where
        S: AsRef<str>,
    {
        Ok(anno::segmentations(self.corpus_ref(corpus_names))?)
    }

    pub fn export_matches<F, G, P, S>(
        &self,
        config: ExportConfig<S>,
        output_file: P,
        on_status: F,
        cancel_requested: G,
    ) -> Result<(), AnnisExportError>
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
        let matches = query.find(config.format.get_export_data().cloned())?;

        cancel_if(&cancel_requested)?;

        on_status(ExportStatusEvent::Found {
            count: matches.total_count(),
        });

        let mut out = tempfile::Builder::new()
            .prefix(".annimate_")
            .suffix(".csv")
            .tempfile()?;

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
        out.persist(output_file).map_err(io::Error::from)?;

        Ok(())
    }

    fn corpus_ref<'a, S>(&'a self, corpus_names: &'a [S]) -> CorpusRef<'a, S> {
        CorpusRef::new(&self.corpus_storage, corpus_names)
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Corpora {
    corpora: Vec<Corpus>,
    sets: Vec<String>,
}

impl Corpora {
    pub fn corpus_count(&self) -> usize {
        self.corpora.len()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Corpus {
    name: String,
    included_in_sets: Vec<String>,
}

pub struct ExportConfig<'a, S> {
    pub corpus_names: &'a [S],
    pub aql_query: &'a str,
    pub query_language: QueryLanguage,
    pub format: ExportFormat,
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ExportStatusEvent {
    Found { count: usize },
    Exported { progress: f32 },
}

#[derive(Clone, Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum ImportStatusEvent {
    CorporaFound {
        corpora: Vec<ImportCorpus>,
    },
    CorpusImportStarted {
        index: usize,
    },
    CorpusImportFinished {
        index: usize,
        result: ImportCorpusResult,
    },
    Message {
        index: Option<usize>,
        message: String,
    },
}

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

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
#[serde(rename_all_fields = "camelCase")]
pub enum ImportCorpusResult {
    Imported { corpus: ImportedCorpus },
    Failed { message: String, cancelled: bool },
}
