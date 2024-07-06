use std::io::{Seek, Write};

use csv::CsvExporter;
use xlsx::XlsxExporter;

use crate::anno::AnnoKeyFormat;
use crate::error::AnnimateError;
use crate::query::Match;
use crate::{ExportData, QueryNode};

mod csv;
mod table;
mod xlsx;

pub use csv::CsvExportConfig;
pub use table::TableExportColumn;
pub use xlsx::XlsxExportConfig;

/// A format in which matches can be exported.
#[derive(Debug)]
pub enum ExportFormat {
    /// CSV (Comma-separated values)
    Csv(CsvExportConfig),

    /// XLSX (Excel)
    Xlsx(XlsxExportConfig),
}

impl ExportFormat {
    pub(crate) fn get_export_data(&self) -> Vec<ExportData> {
        match self {
            ExportFormat::Csv(config) => CsvExporter::get_export_data(config),
            ExportFormat::Xlsx(config) => XlsxExporter::get_export_data(config),
        }
    }
}

pub(crate) fn export<F, G, I, W>(
    export_format: ExportFormat,
    matches: I,
    query_nodes: &[Vec<QueryNode>],
    anno_key_format: &AnnoKeyFormat,
    out: W,
    on_progress: F,
    cancel_requested: G,
) -> Result<(), AnnimateError>
where
    F: FnMut(f32),
    G: Fn() -> bool,
    I: IntoIterator<Item = Result<Match, AnnimateError>> + Clone,
    I::IntoIter: ExactSizeIterator,
    W: Write + Seek + Send,
{
    match export_format {
        ExportFormat::Csv(config) => CsvExporter::export(
            &config,
            matches,
            query_nodes,
            anno_key_format,
            out,
            on_progress,
            cancel_requested,
        ),
        ExportFormat::Xlsx(config) => XlsxExporter::export(
            &config,
            matches,
            query_nodes,
            anno_key_format,
            out,
            on_progress,
            cancel_requested,
        ),
    }
}

trait Exporter {
    type Config;

    fn get_export_data(config: &Self::Config) -> Vec<ExportData>;

    fn export<F, G, I, W>(
        config: &Self::Config,
        matches: I,
        query_nodes: &[Vec<QueryNode>],
        anno_key_format: &AnnoKeyFormat,
        out: W,
        on_progress: F,
        cancel_requested: G,
    ) -> Result<(), AnnimateError>
    where
        F: FnMut(f32),
        G: Fn() -> bool,
        I: IntoIterator<Item = Result<Match, AnnimateError>> + Clone,
        I::IntoIter: ExactSizeIterator,
        W: Write + Seek + Send;
}
