use crate::error::Error;
use annis_export_core::{AnnisExportError, CorpusStorage};
use std::{env, sync::Mutex};

#[derive(Default)]
pub(crate) struct State {
    storage: Mutex<Option<CorpusStorage>>,
}

#[tauri::command(async)]
pub(crate) fn get_corpus_names(state: tauri::State<State>) -> Result<Vec<String>, Error> {
    let mut storage = state.storage.lock().unwrap();
    let storage = match &mut *storage {
        Some(storage) => storage,
        None => storage.get_or_insert(init_storage()?),
    };

    Ok(storage
        .corpus_infos()?
        .into_iter()
        .map(|corpus_info| corpus_info.name)
        .collect())
}

fn init_storage() -> Result<CorpusStorage, AnnisExportError> {
    let db_dir = env::var("ANNIS_DB_DIR").expect("Environment variable `ANNIS_DB_DIR` is not set");
    CorpusStorage::from_db_dir(db_dir)
}
