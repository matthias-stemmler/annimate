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
        Ok(writeln!(out, "{}", m.index())?)
    }
}
