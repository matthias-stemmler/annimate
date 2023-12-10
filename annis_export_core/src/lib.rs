use error::AnnisExportError;
use format::export;
use graphannis::{
    corpusstorage::{CacheStrategy, CorpusInfo, QueryLanguage},
    errors::GraphAnnisError,
};
use query::{CorpusRef, Match, MatchesPage, MatchesPaginated, Query};
use std::{io::Write, path::Path, vec};

mod error;
mod format;
mod query;

pub use format::ExportFormat;
pub use query::QueryConfig;

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
        let node_descriptions = self.0.node_descriptions(aql_query, QueryLanguage::AQL)?;

        let corpus_ref = CorpusRef::new(&self.0, corpus_name);
        let matches_paginated =
            MatchesPaginated::new(corpus_ref, Query::new(aql_query, query_config));
        let total_count = matches_paginated.total_count()?;
        on_status(StatusEvent::Found { count: total_count });

        let exportable_matches = ExportableMatches {
            matches_paginated,
            matches_page: None,
            on_status,
            total_count,
            fetched_count: 0,
        };

        export(exportable_matches, node_descriptions, &mut out, format)?;
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

struct ExportableMatches<'a, F> {
    matches_paginated: MatchesPaginated<'a>,
    matches_page: Option<MatchesPage<'a>>,
    on_status: F,
    total_count: u64,
    fetched_count: u64,
}

impl<'a, F> Iterator for ExportableMatches<'a, F>
where
    F: FnMut(StatusEvent),
{
    type Item = Result<Match, GraphAnnisError>;

    fn next(&mut self) -> Option<Self::Item> {
        loop {
            if self.matches_page.is_none() {
                self.matches_page = match self.matches_paginated.next()? {
                    Ok(page) => {
                        self.fetched_count += u64::try_from(page.len()).unwrap(); // page size fits in a u64

                        (self.on_status)(StatusEvent::Fetched {
                            total_count: self.total_count,
                            fetched_count: self.fetched_count,
                        });

                        Some(page)
                    }
                    Err(err) => return Some(Err(err)),
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
}

#[derive(Debug)]
pub enum StatusEvent {
    Found {
        count: u64,
    },
    Fetched {
        total_count: u64,
        fetched_count: u64,
    },
}
