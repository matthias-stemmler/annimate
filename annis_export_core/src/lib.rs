use error::AnnisExportError;
use format::write_match;
use graphannis::{
    corpusstorage::{CacheStrategy, CorpusInfo},
    errors::GraphAnnisError,
};
use query::{CorpusRef, MatchesPaginated, Query};
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
        let corpus_ref = CorpusRef::new(&self.0, corpus_name);
        let matches_paginated =
            MatchesPaginated::new(corpus_ref, Query::new(aql_query, query_config));
        let total_count = matches_paginated.total_count()?;
        on_status(StatusEvent::Found { count: total_count });

        let mut written_count: u64 = 0;

        for page in matches_paginated {
            let page = page?;
            let len = page.len();

            for m in page {
                write_match(&m?, &mut out, format)?;
            }

            written_count += u64::try_from(len).unwrap(); // page size fits in a u64
            on_status(StatusEvent::Written {
                total_count,
                written_count,
            });
        }

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

#[derive(Debug)]
pub enum StatusEvent {
    Found {
        count: u64,
    },
    Written {
        total_count: u64,
        written_count: u64,
    },
}
