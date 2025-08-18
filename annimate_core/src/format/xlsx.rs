use std::io::{Seek, Write};

use graphannis::corpusstorage::QueryLanguage;
use itertools::Itertools;
use rust_xlsxwriter::{DocProperties, Table, Workbook, Worksheet};

use super::table::{self, TableWriter};
use super::{Exporter, QueryInfo};
use crate::anno::AnnoKeyFormat;
use crate::error::AnnimateError;
use crate::query::{ExportData, Match};
use crate::{TableExportColumn, VERSION_INFO};

#[derive(Debug)]
pub(super) struct XlsxExporter;

/// Configuration of an export in the XLSX (Excel) format.
#[derive(Debug)]
pub struct XlsxExportConfig {
    /// Columns to export.
    pub columns: Vec<TableExportColumn>,
}

impl Exporter for XlsxExporter {
    type Config = XlsxExportConfig;

    fn get_export_data(config: &XlsxExportConfig) -> Vec<ExportData> {
        config
            .columns
            .iter()
            .filter_map(TableExportColumn::data)
            .cloned()
            .collect()
    }

    fn export<F, G, I, S, W>(
        config: &XlsxExportConfig,
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
        let mut workbook = Workbook::new();

        workbook.set_properties(&DocProperties::new().set_comment(format!(
            "Created with Annimate v{}",
            VERSION_INFO.annimate_version
        )));

        let info_worksheet = {
            let mut worksheet = Worksheet::new();
            worksheet
                .set_name("Information")?
                .write_string(0, 0, "Query")?
                .write_string(0, 1, query_info.aql_query)?
                .write_string(1, 0, "Query Language")?
                .write_string(
                    1,
                    1,
                    match query_info.query_language {
                        QueryLanguage::AQL => "AQL (latest)",
                        QueryLanguage::AQLQuirksV3 => "AQL (compatibility mode)",
                    },
                )?
                .write_string(2, 0, "Corpora")?
                .write_string(
                    2,
                    1,
                    query_info.corpus_names.iter().map(|s| s.as_ref()).join(","),
                )?
                .write_string(3, 0, "Annimate version")?
                .write_string(3, 1, VERSION_INFO.annimate_version)?
                .autofit()
                .add_table(0, 0, 3, 1, &Table::new().set_header_row(false))?;
            worksheet
        };

        let data_worksheet = {
            let mut xlsx_table_writer = XlsxTableWriter::new("Data")?;

            table::export(
                &config.columns,
                matches_iter,
                query_info.nodes,
                anno_key_format,
                &mut xlsx_table_writer,
                on_matches_exported,
                cancel_requested,
            )?;

            xlsx_table_writer.into_worksheet()?
        };

        workbook.push_worksheet(data_worksheet);
        workbook.push_worksheet(info_worksheet);
        workbook.save_to_writer(out)?;

        Ok(())
    }
}

struct XlsxTableWriter {
    worksheet: Worksheet,
    rows: u32,
    cols: u16,
}

impl XlsxTableWriter {
    fn new<S>(name: S) -> Result<XlsxTableWriter, AnnimateError>
    where
        S: Into<String>,
    {
        let mut worksheet = Worksheet::new();
        worksheet.set_name(name)?;
        Ok(XlsxTableWriter {
            worksheet,
            rows: 0,
            cols: 0,
        })
    }

    fn into_worksheet(mut self) -> Result<Worksheet, AnnimateError> {
        self.worksheet.autofit().add_table(
            0,
            0,
            self.rows - 1,
            self.cols - 1,
            // Treat the first row as a header row iff there are more rows than just the header
            // because Excel disallows tables consisting only of a header row
            &Table::new().set_header_row(self.rows > 1),
        )?;
        Ok(self.worksheet)
    }
}

impl TableWriter for XlsxTableWriter {
    fn write_record<I>(&mut self, record: I) -> Result<(), AnnimateError>
    where
        I: IntoIterator<Item: AsRef<str>>,
    {
        let row = self.rows;
        let mut col = 0;

        for data in record {
            self.worksheet.write_string(row, col, data.as_ref())?;
            col += 1;

            if col > self.cols {
                self.cols = col;
            }
        }

        self.rows += 1;

        Ok(())
    }
}
