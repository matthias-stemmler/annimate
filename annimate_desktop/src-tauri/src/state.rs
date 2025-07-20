use std::env;
use std::path::PathBuf;
use std::sync::Arc;

use annimate_core::Storage;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

use crate::async_util::Slot;
use crate::error::Error;
use crate::preload::Preloader;

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) db_dir_slot: Arc<Slot<Result<PathBuf, Error>>>,
    pub(crate) preloader_slot: Arc<Slot<Result<Arc<Preloader>, Error>>>,
    pub(crate) storage_slot: Arc<Slot<Result<Arc<Storage>, Error>>>,
}

impl AppState {
    pub(crate) fn init(&self, app_handle: AppHandle) {
        let db_dir_slot = Arc::clone(&self.db_dir_slot);
        let preloader_slot = Arc::clone(&self.preloader_slot);
        let storage_slot = Arc::clone(&self.storage_slot);

        tauri::async_runtime::spawn_blocking(move || {
            let db_dir = get_db_dir(&app_handle);
            db_dir_slot.set(db_dir.clone());

            let storage = db_dir.and_then(create_storage).map(Arc::new);
            storage_slot.set(storage.clone());

            let preloader = storage.map(Preloader::new).map(Arc::new);
            preloader_slot.set(preloader);
        });
    }
}

fn get_db_dir(app_handle: &AppHandle) -> Result<PathBuf, Error> {
    let db_dir = match env::var_os("ANNIMATE_DB_DIR") {
        Some(db_dir) => db_dir.into(),
        None => app_handle.path().resolve("data", BaseDirectory::AppData)?,
    };

    Ok(db_dir)
}

fn create_storage(db_dir: PathBuf) -> Result<Storage, Error> {
    let storage = Storage::from_db_dir(db_dir)?;
    Ok(storage)
}
