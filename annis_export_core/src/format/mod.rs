use self::csv::CsvExporter;
use crate::{error::AnnisExportError, query::Match};
use std::io::Write;

mod csv;

#[derive(Clone, Copy, Debug)]
pub enum ExportFormat {
    Csv,
}

pub(crate) fn write_match<W>(
    m: &Match,
    out: W,
    export_format: ExportFormat,
) -> Result<(), AnnisExportError>
where
    W: Write,
{
    match export_format {
        ExportFormat::Csv => CsvExporter::write_match(m, out),
    }
}

trait Exporter {
    fn write_match<W>(m: &Match, writer: W) -> Result<(), AnnisExportError>
    where
        W: Write;
}
