use self::csv::CsvExporter;
use crate::{error::AnnisExportError, query::Match};
use graphannis::corpusstorage::QueryAttributeDescription;
use std::io::Write;

mod csv;

#[derive(Clone, Copy, Debug)]
pub enum ExportFormat {
    Csv,
}

pub(crate) fn export<F, I, W>(
    export_format: ExportFormat,
    matches: I,
    node_descriptions: Vec<QueryAttributeDescription>,
    out: W,
    on_progress: F,
) -> Result<(), AnnisExportError>
where
    F: FnMut(f32),
    I: IntoIterator<Item = Result<Match, AnnisExportError>>,
    I::IntoIter: ExactSizeIterator,
    W: Write,
{
    match export_format {
        ExportFormat::Csv => CsvExporter::export(matches, node_descriptions, out, on_progress),
    }
}

trait Exporter {
    fn export<F, I, W>(
        matches: I,
        node_descriptions: Vec<QueryAttributeDescription>,
        out: W,
        on_progress: F,
    ) -> Result<(), AnnisExportError>
    where
        F: FnMut(f32),
        I: IntoIterator<Item = Result<Match, AnnisExportError>>,
        I::IntoIter: ExactSizeIterator,
        W: Write;
}
