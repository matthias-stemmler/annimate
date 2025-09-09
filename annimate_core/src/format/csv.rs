use std::io::{Seek, Write};

use super::table::{self, TableWriter};
use super::{Exporter, QueryInfo};
use crate::TableExportColumn;
use crate::anno::AnnoKeyFormat;
use crate::error::AnnimateError;
use crate::query::{ExportData, Match};

#[derive(Debug)]
pub(super) struct CsvExporter;

/// Configuration of an export in the CSV format.
#[derive(Debug)]
pub struct CsvExportConfig {
    /// Columns to export.
    pub columns: Vec<TableExportColumn>,
}

impl Exporter for CsvExporter {
    type Config = CsvExportConfig;

    fn get_export_data(config: &CsvExportConfig) -> Vec<ExportData> {
        config
            .columns
            .iter()
            .filter_map(TableExportColumn::data)
            .cloned()
            .collect()
    }

    fn export<F, G, I, S, W>(
        config: &CsvExportConfig,
        matches_iter: I,
        query_info: QueryInfo<'_, S>,
        anno_key_format: &AnnoKeyFormat,
        out: W,
        on_matches_exported: F,
        cancel_requested: G,
    ) -> Result<(), AnnimateError>
    where
        F: Fn(usize),
        G: Fn() -> bool,
        I: ExactSizeIterator<Item = Result<Match, AnnimateError>>,
        S: AsRef<str>,
        W: Write + Seek + Send,
    {
        table::export(
            &config.columns,
            matches_iter,
            query_info.nodes,
            anno_key_format,
            &mut CsvTableWriter::new(out),
            on_matches_exported,
            cancel_requested,
        )
    }
}

struct CsvTableWriter<W>(csv::Writer<W>)
where
    W: Write;

impl<W> CsvTableWriter<W>
where
    W: Write,
{
    fn new(inner: W) -> CsvTableWriter<W> {
        CsvTableWriter(csv::Writer::from_writer(inner))
    }
}

impl<W> TableWriter for CsvTableWriter<W>
where
    W: Write,
{
    fn write_record<I>(&mut self, record: I) -> Result<(), AnnimateError>
    where
        I: IntoIterator<Item: AsRef<str>>,
    {
        Ok(self.0.write_record(record.into_iter().map(StrAsBytes))?)
    }
}

struct StrAsBytes<S>(S);

impl<S> AsRef<[u8]> for StrAsBytes<S>
where
    S: AsRef<str>,
{
    fn as_ref(&self) -> &[u8] {
        self.0.as_ref().as_bytes()
    }
}

impl From<csv::Error> for AnnimateError {
    fn from(err: csv::Error) -> AnnimateError {
        AnnimateError::Io(err.into())
    }
}
