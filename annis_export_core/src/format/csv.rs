use super::Exporter;
use crate::{error::AnnisExportError, query::Match};
use std::io::Write;

#[derive(Debug)]
pub(super) struct CsvExporter;

impl Exporter for CsvExporter {
    fn write_match<W>(m: &Match, mut out: W) -> Result<(), AnnisExportError>
    where
        W: Write,
    {
        write!(out, "{}", m.index)?;

        for context_token in &m.context {
            write!(out, " <{:?}>", context_token)?;
        }

        writeln!(out)?;

        Ok(())
    }
}
