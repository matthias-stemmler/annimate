use crate::error::Error;
use annis_export_core::{
    CorpusStorage, CsvExportColumn, CsvExportConfig, ExportFormat, QueryLanguage,
    QueryValidationResult,
};
use std::{
    io::{self, Write},
    path::PathBuf,
};
use tauri::Window;

pub(crate) struct State {
    storage: CorpusStorage,
}

impl State {
    pub(crate) fn from_db_dir(db_dir: PathBuf) -> Self {
        Self {
            storage: CorpusStorage::from_db_dir(db_dir).expect("Failed to create corpus storage"),
        }
    }
}

#[tauri::command(async)]
pub(crate) fn export_matches(
    state: tauri::State<State>,
    window: Window,
    corpus_names: Vec<String>,
    aql_query: String,
    query_language: QueryLanguage,
    output_file: PathBuf,
) -> Result<(), Error> {
    let mut out = tempfile::Builder::new()
        .prefix(".annis_export_")
        .suffix(".csv")
        .tempfile()?;

    state.storage.export_matches(
        &corpus_names,
        &aql_query,
        query_language,
        ExportFormat::Csv(CsvExportConfig {
            columns: vec![
                CsvExportColumn::Number,
                CsvExportColumn::Data(annis_export_core::ExportData::Anno(
                    annis_export_core::ExportDataAnno::MatchNode {
                        anno_key: annis_export_core::AnnoKey {
                            name: "tok".into(),
                            ns: "annis".into(),
                        },
                        index: 0,
                    },
                )),
            ],
        }),
        &mut out,
        |status_event| {
            window
                .emit("export_status", &status_event)
                .expect("Failed to emit export_status event")
        },
    )?;

    out.flush()?;
    out.persist(output_file).map_err(io::Error::from)?;

    Ok(())
}

#[tauri::command(async)]
pub(crate) fn get_corpus_names(state: tauri::State<State>) -> Result<Vec<String>, Error> {
    Ok(state
        .storage
        .corpus_infos()?
        .into_iter()
        .map(|corpus_info| corpus_info.name)
        .collect())
}

#[tauri::command(async)]
pub(crate) fn validate_query(
    state: tauri::State<State>,
    corpus_names: Vec<String>,
    aql_query: String,
    query_language: QueryLanguage,
) -> Result<QueryValidationResult, Error> {
    Ok(state
        .storage
        .validate_query(&corpus_names, &aql_query, query_language)?)
}
