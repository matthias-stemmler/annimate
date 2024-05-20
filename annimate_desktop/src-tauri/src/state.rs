use std::path::PathBuf;
use std::sync::Arc;
use std::{env, io};

use annimate_core::Storage;
use tauri::AppHandle;

use crate::error::Error;
use crate::slot::Slot;

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) db_dir_slot: Arc<Slot<Result<PathBuf, Error>>>,
    pub(crate) storage_slot: Arc<Slot<Result<Arc<Storage>, Error>>>,
}

impl AppState {
    pub(crate) fn init(&self, app_handle: AppHandle) {
        let db_dir_slot = Arc::clone(&self.db_dir_slot);
        let storage_slot = Arc::clone(&self.storage_slot);

        tauri::async_runtime::spawn_blocking(move || {
            let db_dir = get_db_dir(app_handle);
            db_dir_slot.set(db_dir.clone());
            storage_slot.set(db_dir.and_then(create_storage).map(Arc::new));
        });
    }
}

fn get_db_dir(app_handle: AppHandle) -> Result<PathBuf, Error> {
    if let Some(db_dir) = env::var_os("ANNIMATE_DB_DIR") {
        return Ok(db_dir.into());
    }

    match app_handle.path_resolver().app_data_dir() {
        Some(data_dir) => Ok(data_dir.join("data")),
        None => Ok(env::current_exe()?
            .parent()
            .ok_or(io::Error::other("failed to determine data folder"))?
            .join("annimate_data")),
    }
}

fn create_storage(db_dir: PathBuf) -> Result<Storage, Error> {
    let storage = Storage::from_db_dir(db_dir)?;
    Ok(storage)
}
