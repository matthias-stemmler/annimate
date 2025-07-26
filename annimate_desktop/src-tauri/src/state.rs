use std::env;
use std::path::PathBuf;
use std::sync::Arc;

use annimate_core::Storage;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tokio::sync::SetOnce;

use crate::error::Error;
use crate::preload::Preloader;

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) db_dir: Arc<SetOnce<Result<PathBuf, Error>>>,
    pub(crate) preloader: Arc<SetOnce<Result<Arc<Preloader>, Error>>>,
    pub(crate) storage: Arc<SetOnce<Result<Arc<Storage>, Error>>>,
}

impl AppState {
    pub(crate) fn init(&self, app_handle: AppHandle) {
        let db_dir_slot = Arc::clone(&self.db_dir);
        let preloader_slot = Arc::clone(&self.preloader);
        let storage_slot = Arc::clone(&self.storage);

        tauri::async_runtime::spawn_blocking(move || {
            let db_dir = get_db_dir(&app_handle);
            db_dir_slot.set(db_dir.clone()).unwrap();

            let storage = db_dir.and_then(create_storage).map(Arc::new);
            storage_slot.set(storage.clone()).map_err(|_| ()).unwrap();

            let preloader = storage.map(Preloader::new).map(Arc::new);
            preloader_slot.set(preloader).map_err(|_| ()).unwrap();
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
