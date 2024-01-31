use crate::error::Error;
use annis_export_core::{CorpusStorage, QueryValidationResult};
use std::{path::PathBuf, sync::Mutex};

pub(crate) struct State {
    storage: Mutex<CorpusStorage>,
}

impl State {
    pub(crate) fn from_db_dir(db_dir: PathBuf) -> Self {
        Self {
            storage: Mutex::new(
                CorpusStorage::from_db_dir(&db_dir).expect("Failed to create corpus storage"),
            ),
        }
    }
}

#[tauri::command(async)]
pub(crate) fn get_corpus_names(state: tauri::State<State>) -> Result<Vec<String>, Error> {
    Ok(state
        .storage
        .lock()
        .unwrap()
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
) -> Result<QueryValidationResult, Error> {
    Ok(state.storage.lock().unwrap().validate_query(
        &corpus_names,
        &aql_query,
        annis_export_core::QueryLanguage::AQL,
    )?)
}
