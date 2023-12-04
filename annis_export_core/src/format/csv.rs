use graphannis::errors::GraphAnnisError;

use super::Exporter;
use crate::{error::AnnisExportError, query::Match};
use std::io::Write;

#[derive(Debug)]
pub(super) struct CsvExporter;

impl Exporter for CsvExporter {
    fn export<I, W>(matches: I, mut out: W) -> Result<(), AnnisExportError>
    where
        I: IntoIterator<Item = Result<Match, GraphAnnisError>>,
        W: Write,
    {
        for m in matches {
            let m = m?;
            write!(out, "{}", m.index)?;

            for context_token in &m.context {
                write!(out, " <{:?}>", context_token)?;
            }

            writeln!(out)?;
        }

        Ok(())
    }
}
