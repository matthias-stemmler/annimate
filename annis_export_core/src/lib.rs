use corpus::CorpusRef;
use error::AnnisExportError;
use format::export;
use graphannis::{corpusstorage::CacheStrategy, errors::GraphAnnisError};
use itertools::Itertools;
use query::{Match, MatchesPage, MatchesPaginated, MatchesPaginatedIter};
use std::{
    collections::HashSet,
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

pub use aql::{QueryNode, QueryValidationResult};
pub use format::{CsvExportColumn, CsvExportConfig, ExportFormat};
pub use graphannis::graph::AnnoKey;
pub use query::{ExportData, ExportDataAnno, ExportDataText, QueryLanguage};

pub struct CorpusStorage(graphannis::CorpusStorage);

impl CorpusStorage {
    pub fn from_db_dir<P>(db_dir: P) -> Result<Self, GraphAnnisError>
    where
        P: AsRef<Path>,
    {
        Ok(Self(graphannis::CorpusStorage::with_cache_strategy(
            db_dir.as_ref(),
            CacheStrategy::PercentOfFreeMemory(25.0),
            true,
        )?))
    }

    pub fn corpus_names(&self) -> Result<Vec<String>, GraphAnnisError> {
        Ok(self
            .0
            .list()?
            .into_iter()
            .map(|c| c.name)
            .sorted()
            .collect())
    }

    pub fn import_corpora_from_zip<F, R>(
        &self,
        zip: R,
        on_status: F,
    ) -> Result<Vec<String>, GraphAnnisError>
    where
        F: Fn(&str),
        R: Read + Seek,
    {
        self.0.import_all_from_zip(zip, false, false, on_status)
    }

    pub fn validate_query<S>(
        &self,
        corpus_names: &[S],
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryValidationResult, GraphAnnisError>
    where
        S: AsRef<str>,
    {
        aql::validate_query(self.corpus_ref(corpus_names), aql_query, query_language)
    }

    pub fn query_nodes(
        &self,
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<Vec<Vec<QueryNode>>, GraphAnnisError> {
        aql::query_nodes(&self.0, aql_query, query_language)
    }

    pub fn segmentations<S>(&self, corpus_names: &[S]) -> Result<Vec<String>, GraphAnnisError>
    where
        S: AsRef<str>,
    {
        anno::segmentations(self.corpus_ref(corpus_names))
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
        let query_nodes = aql::query_nodes(&self.0, aql_query, query_language)?;

        let matches = ExportableMatches::new(
            self.corpus_ref(corpus_names),
            aql_query,
            query_language,
            format.get_export_data().cloned().collect(),
        )?;

        on_status(StatusEvent::Found {
            count: matches.total_count,
        });

        export(format, matches, &query_nodes, &mut out, |progress| {
            on_status(StatusEvent::Exported { progress })
        })?;

        out.flush()?;

        Ok(())
    }

    fn corpus_ref<'a, S>(&'a self, corpus_names: &'a [S]) -> CorpusRef<'a, S> {
        CorpusRef::new(&self.0, corpus_names)
    }
}

struct ExportableMatches<'a, S> {
    matches_paginated: MatchesPaginated<'a, S>,
    total_count: usize,
}

impl<S> Clone for ExportableMatches<'_, S> {
    fn clone(&self) -> Self {
        Self {
            matches_paginated: self.matches_paginated.clone(),
            total_count: self.total_count,
        }
    }
}

impl<'a, S> ExportableMatches<'a, S>
where
    S: AsRef<str>,
{
    fn new(
        corpus_ref: CorpusRef<'a, S>,
        aql_query: &'a str,
        query_language: QueryLanguage,
        export_data: HashSet<ExportData>,
    ) -> Result<Self, AnnisExportError> {
        let matches_paginated =
            MatchesPaginated::new(corpus_ref, aql_query, query_language, export_data)?;

        let total_count = {
            let total_count = matches_paginated.total_count()?;
            total_count
                .try_into()
                .map_err(|_| AnnisExportError::TooManyResults(total_count))?
        };

        Ok(Self {
            matches_paginated,
            total_count,
        })
    }
}

impl<'a, S> IntoIterator for ExportableMatches<'a, S>
where
    S: AsRef<str>,
{
    type Item = Result<Match, AnnisExportError>;
    type IntoIter = ExportableMatchesIter<'a, S>;

    fn into_iter(self) -> Self::IntoIter {
        ExportableMatchesIter {
            matches_paginated_iter: self.matches_paginated.into_iter(),
            matches_page: None,
            total_count: self.total_count,
        }
    }
}

struct ExportableMatchesIter<'a, S> {
    matches_paginated_iter: MatchesPaginatedIter<'a, S>,
    matches_page: Option<MatchesPage<'a, S>>,
    total_count: usize,
}

impl<S> Iterator for ExportableMatchesIter<'_, S>
where
    S: AsRef<str>,
{
    type Item = Result<Match, AnnisExportError>;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if self.matches_page.is_none() {
                self.matches_page = match self.matches_paginated_iter.next()? {
                    Ok(page) => Some(page),
                    Err(err) => return Some(Err(err.into())),
                };
            }

            if let Some(ref mut page) = &mut self.matches_page {
                match page.next() {
                    Some(m) => return Some(m),
                    None => self.matches_page = None,
                }
            }
        }
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        (self.total_count, Some(self.total_count))
    }
}

impl<S> ExactSizeIterator for ExportableMatchesIter<'_, S> where S: AsRef<str> {}

#[derive(Debug)]
pub enum StatusEvent {
    Found { count: usize },
    Exported { progress: f32 },
}
