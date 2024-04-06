use self::csv::CsvExporter;
use crate::{anno::AnnoKeyFormat, error::AnnisExportError, query::Match, ExportData, QueryNode};
use std::io::Write;

mod csv;

pub use csv::{CsvExportColumn, CsvExportConfig};

#[derive(Debug)]
pub enum ExportFormat {
    Csv(CsvExportConfig),
}

impl ExportFormat {
    pub(crate) fn get_export_data(&self) -> impl Iterator<Item = &ExportData> {
        match self {
            ExportFormat::Csv(config) => CsvExporter::get_export_data(config),
        }
    }
}

pub(crate) fn export<F, I, W>(
    export_format: ExportFormat,
    matches: I,
    query_nodes: &[Vec<QueryNode>],
    anno_key_format: &AnnoKeyFormat,
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
        ExportFormat::Csv(config) => CsvExporter::export(
            &config,
            matches,
            query_nodes,
            anno_key_format,
            out,
            on_progress,
        ),
    }
}

trait Exporter {
    type Config;

    fn get_export_data(config: &Self::Config) -> impl Iterator<Item = &ExportData>;

    fn export<F, I, W>(
        config: &Self::Config,
        matches: I,
        query_nodes: &[Vec<QueryNode>],
        anno_key_format: &AnnoKeyFormat,
        out: W,
        on_progress: F,
    ) -> Result<(), AnnisExportError>
    where
        F: FnMut(f32),
        I: IntoIterator<Item = Result<Match, AnnisExportError>> + Clone,
        I::IntoIter: ExactSizeIterator,
        W: Write;
}
