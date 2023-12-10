use self::csv::CsvExporter;
use crate::{error::AnnisExportError, query::Match};
use graphannis::{corpusstorage::QueryAttributeDescription, errors::GraphAnnisError};
use std::io::Write;

mod csv;

#[derive(Clone, Copy, Debug)]
pub enum ExportFormat {
    Csv,
}

pub(crate) fn export<I, W>(
    matches: I,
    node_descriptions: Vec<QueryAttributeDescription>,
    out: W,
    export_format: ExportFormat,
) -> Result<(), AnnisExportError>
where
    I: IntoIterator<Item = Result<Match, GraphAnnisError>>,
    W: Write,
{
    match export_format {
        ExportFormat::Csv => CsvExporter::export(matches, node_descriptions, out),
    }
}

trait Exporter {
    fn export<I, W>(
        matches: I,
        node_descriptions: Vec<QueryAttributeDescription>,
        writer: W,
    ) -> Result<(), AnnisExportError>
    where
        I: IntoIterator<Item = Result<Match, GraphAnnisError>>,
        W: Write;
}
