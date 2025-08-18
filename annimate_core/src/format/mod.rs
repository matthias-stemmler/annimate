use std::io::{Seek, Write};

use csv::CsvExporter;
use graphannis::corpusstorage::QueryLanguage;
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

#[derive(Clone, Copy)]
pub(crate) struct QueryInfo<'a, S> {
    pub(crate) corpus_names: &'a [S],
    pub(crate) aql_query: &'a str,
    pub(crate) query_language: QueryLanguage,
    pub(crate) nodes: &'a [Vec<QueryNode>],
}

pub(crate) fn export<F, G, I, S, W>(
    export_format: ExportFormat,
    matches_iter: I,
    query_info: QueryInfo<'_, S>,
    anno_key_format: &AnnoKeyFormat,
    out: W,
    on_matches_exported: F,
    cancel_requested: G,
) -> Result<(), AnnimateError>
where
    F: FnMut(usize),
    G: Fn() -> bool,
    I: Iterator<Item = Result<Match, AnnimateError>> + ExactSizeIterator,
    S: AsRef<str>,
    W: Write + Seek + Send,
{
    match export_format {
        ExportFormat::Csv(config) => CsvExporter::export(
            &config,
            matches_iter,
            query_info,
            anno_key_format,
            out,
            on_matches_exported,
            cancel_requested,
        ),
        ExportFormat::Xlsx(config) => XlsxExporter::export(
            &config,
            matches_iter,
            query_info,
            anno_key_format,
            out,
            on_matches_exported,
            cancel_requested,
        ),
    }
}

trait Exporter {
    type Config;

    fn get_export_data(config: &Self::Config) -> Vec<ExportData>;

    fn export<F, G, I, S, W>(
        config: &Self::Config,
        matches_iter: I,
        query_info: QueryInfo<'_, S>,
        anno_key_format: &AnnoKeyFormat,
        out: W,
        on_matches_exported: F,
        cancel_requested: G,
    ) -> Result<(), AnnimateError>
    where
        F: FnMut(usize),
        G: Fn() -> bool,
        I: Iterator<Item = Result<Match, AnnimateError>> + ExactSizeIterator,
        S: AsRef<str>,
        W: Write + Seek + Send;
}
