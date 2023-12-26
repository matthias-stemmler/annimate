use self::csv::CsvExporter;
use crate::{error::AnnisExportError, query::Match};
use std::io::Write;

mod csv;

#[derive(Clone, Copy, Debug)]
pub enum ExportFormat {
    Csv,
}

pub(crate) fn export<F, I, W>(
    export_format: ExportFormat,
    matches: I,
    out: W,
    on_progress: F,
) -> Result<(), AnnisExportError>
where
    F: FnMut(f32),
    I: IntoIterator<Item = Result<Match, AnnisExportError>> + Clone,
    I::IntoIter: ExactSizeIterator,
    W: Write,
{
    match export_format {
        ExportFormat::Csv => CsvExporter::export(matches, out, on_progress),
    }
}

trait Exporter {
    fn export<F, I, W>(matches: I, out: W, on_progress: F) -> Result<(), AnnisExportError>
    where
        F: FnMut(f32),
        I: IntoIterator<Item = Result<Match, AnnisExportError>> + Clone,
        I::IntoIter: ExactSizeIterator,
        W: Write;
}
