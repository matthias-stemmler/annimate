use anno::AnnoKeys;
use corpus::CorpusRef;
use format::export;
use graphannis::corpusstorage::CacheStrategy;
use itertools::Itertools;
use query::Query;
use std::{
    io::{Read, Seek, Write},
    path::Path,
};

mod anno;
mod aql;
mod corpus;
mod error;
mod format;
mod node_name;
mod query;
mod util;

pub use anno::{ExportableAnnoKey, ExportableAnnoKeys};
pub use aql::{QueryNode, QueryValidationResult};
pub use error::AnnisExportError;
pub use format::{CsvExportColumn, CsvExportConfig, ExportFormat};
pub use graphannis::{corpusstorage::CorpusInfo, graph::AnnoKey};
pub use query::{ExportData, ExportDataAnno, ExportDataText, QueryLanguage};

pub struct CorpusStorage(graphannis::CorpusStorage);

impl CorpusStorage {
    pub fn from_db_dir<P>(db_dir: P) -> Result<Self, AnnisExportError>
    where
        P: AsRef<Path>,
    {
        Ok(Self(graphannis::CorpusStorage::with_cache_strategy(
            db_dir.as_ref(),
            CacheStrategy::PercentOfFreeMemory(25.0),
            true,
        )?))
    }

    pub fn corpus_infos(&self) -> Result<Vec<CorpusInfo>, AnnisExportError> {
        Ok(self
            .0
            .list()?
            .into_iter()
            .sorted_by(|a, b| a.name.cmp(&b.name))
            .collect())
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
        Ok(self.0.import_all_from_zip(zip, false, false, on_status)?)
    }

    pub fn validate_query<S>(
        &self,
        corpus_names: &[S],
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryValidationResult, AnnisExportError>
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
    ) -> Result<Vec<Vec<QueryNode>>, AnnisExportError> {
        Ok(aql::query_nodes(&self.0, aql_query, query_language)?)
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
        CorpusRef::new(&self.0, corpus_names)
    }
}

#[derive(Debug)]
#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(tag = "type"))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub enum StatusEvent {
    Found { count: usize },
    Exported { progress: f32 },
}
