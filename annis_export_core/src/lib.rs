use error::AnnisExportError;
use format::export;
use graphannis::{
    corpusstorage::{CacheStrategy, CorpusInfo},
    errors::{AQLError, GraphAnnisError},
};
use query::{CorpusRef, Match, MatchesPage, MatchesPaginated, Query};
use std::{io::Write, path::Path, vec};

mod error;
mod format;
mod query;
mod util;

pub use format::ExportFormat;
pub use query::QueryConfig;
pub use query::QueryLanguage;

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

    pub fn corpus_names(&self) -> Result<CorpusNames, GraphAnnisError> {
        Ok(CorpusNames(self.0.list()?.into_iter()))
    }

    pub fn export_matches<F, W>(
        &self,
        corpus_name: &str,
        aql_query: &str,
        query_config: QueryConfig,
        format: ExportFormat,
        mut out: W,
        mut on_status: F,
    ) -> Result<(), AnnisExportError>
    where
        F: FnMut(StatusEvent),
        W: Write,
    {
        // TEMP
        let node_descriptions = self
            .0
            .node_descriptions(aql_query, query_config.query_language)?
            .into_iter()
            .take(2)
            .collect();

        let corpus_ref = CorpusRef::new(&self.0, corpus_name);
        let matches_paginated =
            MatchesPaginated::new(corpus_ref, Query::new(aql_query, query_config));
        let total_count = matches_paginated.total_count()?;
        let total_count = total_count
            .try_into()
            .map_err(|_| AnnisExportError::TooManyResults(total_count))?;
        on_status(StatusEvent::Found { count: total_count });

        let exportable_matches = ExportableMatches {
            matches_paginated,
            matches_page: None,
            total_count,
        };

        export(
            format,
            exportable_matches,
            node_descriptions,
            &mut out,
            |progress| on_status(StatusEvent::Exported { progress }),
        )?;
        out.flush()?;

        Ok(())
    }

    pub fn validate_query(
        &self,
        corpus_name: &str,
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryValidationResult, GraphAnnisError> {
        match self
            .0
            .validate_query(&[corpus_name], aql_query, query_language)
        {
            Ok(true) => Ok(QueryValidationResult::Valid),
            Ok(false) => unreachable!("Cannot occur according to docs"),
            Err(GraphAnnisError::AQLSyntaxError(err) | GraphAnnisError::AQLSemanticError(err)) => {
                Ok(QueryValidationResult::Invalid(err))
            }
            Err(err) => Err(err),
        }
    }
}

pub struct CorpusNames(vec::IntoIter<CorpusInfo>);

impl Iterator for CorpusNames {
    type Item = String;

    fn next(&mut self) -> Option<Self::Item> {
        Some(self.0.next()?.name)
    }
}

struct ExportableMatches<'a> {
    matches_paginated: MatchesPaginated<'a>,
    matches_page: Option<MatchesPage<'a>>,
    total_count: usize,
}

impl Iterator for ExportableMatches<'_> {
    type Item = Result<Match, AnnisExportError>;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if self.matches_page.is_none() {
                self.matches_page = match self.matches_paginated.next()? {
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

impl ExactSizeIterator for ExportableMatches<'_> {}

#[derive(Debug)]
pub enum StatusEvent {
    Found { count: usize },
    Exported { progress: f32 },
}

#[derive(Debug)]
pub enum QueryValidationResult {
    Valid,
    Invalid(AQLError),
}
