//! Providing export formats.

use std::io::Write;

use self::csv::CsvExporter;
use crate::anno::AnnoKeyFormat;
use crate::error::AnnimateError;
use crate::query::Match;
use crate::{ExportData, QueryNode};

mod csv;

pub use csv::{CsvExportColumn, CsvExportConfig};

/// A format in which matches can be exported.
#[derive(Debug)]
pub enum ExportFormat {
    /// CSV (Comma-separated values)
    Csv(
        /// Configuration of the CSV export.
        CsvExportConfig,
    ),
}

impl ExportFormat {
    /// Returns an iterator over the [ExportData] configured for this format.
    pub(crate) fn get_export_data(&self) -> impl Iterator<Item = &ExportData> {
        match self {
            ExportFormat::Csv(config) => CsvExporter::get_export_data(config),
        }
    }
}

/// Exports matches in the specified format.
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
            cancel_requested,
        ),
    }
}

/// Abstraction over exporting matches in different formats.
trait Exporter {
    /// The type of configuration for the exporter.
    type Config;

    /// Returns an iterator over the [ExportData] configured for this exporter.
    fn get_export_data(config: &Self::Config) -> impl Iterator<Item = &ExportData>;

    /// Exports matches in this exporter's format.
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
        W: Write;
}
