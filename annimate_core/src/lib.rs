use anno::AnnoKeys;
use corpus::CorpusRef;
use format::export;
use graphannis::corpusstorage::CacheStrategy;
use itertools::Itertools;
use metadata::MetadataStorage;
use query::Query;
use serde::Serialize;
use std::{
    io::{Read, Seek, Write},
    path::Path,
};

mod anno;
mod aql;
mod corpus;
mod error;
mod format;
mod metadata;
mod node_name;
mod query;
mod util;
mod version;

pub use anno::{ExportableAnnoKey, ExportableAnnoKeys};
pub use aql::{QueryAnalysisResult, QueryNode, QueryNodes};
pub use error::AnnisExportError;
pub use format::{CsvExportColumn, CsvExportConfig, ExportFormat};
pub use graphannis::{corpusstorage::CorpusInfo, graph::AnnoKey};
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
                    .filter(|s| s.corpus_names.contains(&c.name))
                    .map(|s| s.name.clone())
                    .collect();

                Corpus {
                    name: c.name,
                    included_in_sets,
                }
            })
            .collect();

        Ok(Corpora {
            sets: sets.into_iter().map(|s| s.name).collect(),
            corpora,
        })
    }

    pub fn delete_corpus(&self, corpus_name: &str) -> Result<(), AnnisExportError> {
        self.corpus_storage.delete(corpus_name)?;
        self.metadata_storage.update_corpus_sets(|corpus_sets| {
            for corpus_set in corpus_sets {
                corpus_set.corpus_names.retain(|c| c != corpus_name);
            }
        })?;
        Ok(())
    }

    pub fn import_corpora_from_zip<F, R>(
        &self,
        zip: R,
        on_status: F,
    ) -> Result<Vec<String>, AnnisExportError>
    where
        F: Fn(&str),
        R: Read + Seek,
    {
        Ok(self
            .corpus_storage
            .import_all_from_zip(zip, false, false, on_status)?)
    }

    pub fn toggle_corpus_in_set(
        &self,
        corpus_set: &str,
        corpus_name: &str,
    ) -> Result<(), AnnisExportError> {
        self.metadata_storage.update_corpus_sets(|corpus_sets| {
            if let Some(corpus_set) = corpus_sets.iter_mut().find(|s| s.name == corpus_set) {
                if corpus_set.corpus_names.iter().any(|c| c == corpus_name) {
                    corpus_set.corpus_names.retain(|c| c != corpus_name);
                } else {
                    corpus_set.corpus_names.push(corpus_name.into());
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

    pub fn export_matches<F, S, W>(
        &self,
        corpus_names: &[S],
        aql_query: &str,
        query_language: QueryLanguage,
        format: ExportFormat,
        mut out: W,
        mut on_status: F,
    ) -> Result<(), AnnisExportError>
    where
        F: FnMut(StatusEvent),
        S: AsRef<str>,
        W: Write,
    {
        let anno_keys = AnnoKeys::new(self.corpus_ref(corpus_names))?;
        let query = Query::new(self.corpus_ref(corpus_names), aql_query, query_language)?;
        let matches = query.find(format.get_export_data().cloned())?;

        on_status(StatusEvent::Found {
            count: matches.total_count(),
        });

        export(
            format,
            matches,
            query.nodes(),
            anno_keys.format(),
            &mut out,
            |progress| on_status(StatusEvent::Exported { progress }),
        )?;

        out.flush()?;

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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Corpus {
    name: String,
    included_in_sets: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum StatusEvent {
    Found { count: usize },
    Exported { progress: f32 },
}
