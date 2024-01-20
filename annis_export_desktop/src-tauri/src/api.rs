use crate::error::Error;
use annis_export_core::CorpusStorage;
use std::{path::PathBuf, sync::Mutex};

#[derive(Default)]
pub(crate) struct State {
    db_dir: PathBuf,
    storage: Mutex<Option<CorpusStorage>>,
}

impl State {
    pub(crate) fn from_db_dir(db_dir: PathBuf) -> Self {
        Self {
            db_dir,
            storage: Mutex::new(None),
        }
    }
}

#[tauri::command(async)]
pub(crate) fn get_corpus_names(state: tauri::State<State>) -> Result<Vec<String>, Error> {
    let mut storage = state.storage.lock().unwrap();
    let storage = match &mut *storage {
        Some(storage) => storage,
        None => storage.get_or_insert(CorpusStorage::from_db_dir(&state.db_dir)?),
    };

    Ok(storage
        .corpus_infos()?
        .into_iter()
        .map(|corpus_info| corpus_info.name)
        .collect())
}
