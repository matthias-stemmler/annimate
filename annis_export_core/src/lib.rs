use error::AnnisExportError;
use format::export;
use graphannis::{
    corpusstorage::{CacheStrategy, CorpusInfo},
    errors::GraphAnnisError,
};
use query::{CorpusRef, Match, MatchesPage, MatchesPaginated, MatchesPaginatedIter, Query};
use std::{io::Write, path::Path, vec};

mod aql;
mod error;
mod format;
mod query;
mod util;

pub use aql::QueryNode;
pub use aql::QueryValidationResult;
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

    pub fn validate_query(
        &self,
        corpus_name: &str,
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<QueryValidationResult, GraphAnnisError> {
        aql::validate_query(&self.0, corpus_name, aql_query, query_language)
    }

    pub fn query_nodes(
        &self,
        aql_query: &str,
        query_language: QueryLanguage,
    ) -> Result<Vec<Vec<QueryNode>>, GraphAnnisError> {
        aql::query_nodes(&self.0, aql_query, query_language)
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
        let query = Query::new(aql_query, query_config);
        let matches = ExportableMatches::new(CorpusRef::new(&self.0, corpus_name), query)?;

        on_status(StatusEvent::Found {
            count: matches.total_count,
        });

        export(format, query, matches, &mut out, |progress| {
            on_status(StatusEvent::Exported { progress })
        })?;

        out.flush()?;

        Ok(())
    }
}

pub struct CorpusNames(vec::IntoIter<CorpusInfo>);

impl Iterator for CorpusNames {
    type Item = String;

    fn next(&mut self) -> Option<Self::Item> {
        Some(self.0.next()?.name)
    }
}

#[derive(Clone, Copy)]
struct ExportableMatches<'a> {
    matches_paginated: MatchesPaginated<'a>,
    total_count: usize,
}

impl<'a> ExportableMatches<'a> {
    fn new(corpus_ref: CorpusRef<'a>, query: Query<'a>) -> Result<Self, AnnisExportError> {
        let matches_paginated = MatchesPaginated::new(corpus_ref, query);

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

impl<'a> IntoIterator for ExportableMatches<'a> {
    type Item = Result<Match, AnnisExportError>;
    type IntoIter = ExportableMatchesIter<'a>;

    fn into_iter(self) -> Self::IntoIter {
        ExportableMatchesIter {
            matches_paginated_iter: self.matches_paginated.into_iter(),
            matches_page: None,
            total_count: self.total_count,
        }
    }
}

struct ExportableMatchesIter<'a> {
    matches_paginated_iter: MatchesPaginatedIter<'a>,
    matches_page: Option<MatchesPage<'a>>,
    total_count: usize,
}

impl Iterator for ExportableMatchesIter<'_> {
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

impl ExactSizeIterator for ExportableMatchesIter<'_> {}

#[derive(Debug)]
pub enum StatusEvent {
    Found { count: usize },
    Exported { progress: f32 },
}
