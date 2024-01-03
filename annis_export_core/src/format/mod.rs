use self::csv::CsvExporter;
use crate::{error::AnnisExportError, query::Match, ExportData};
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
        ExportFormat::Csv(config) => CsvExporter::export(&config, matches, out, on_progress),
    }
}

trait Exporter {
    type Config;

    fn get_export_data(config: &Self::Config) -> impl Iterator<Item = &ExportData>;

    fn export<F, I, W>(
        config: &Self::Config,
        matches: I,
        out: W,
        on_progress: F,
    ) -> Result<(), AnnisExportError>
    where
        F: FnMut(f32),
        I: IntoIterator<Item = Result<Match, AnnisExportError>> + Clone,
        I::IntoIter: ExactSizeIterator,
        W: Write;
}
