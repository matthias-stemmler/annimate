#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod error;

use api::State;
use std::env;

fn main() {
    let db_dir = env::var("ANNIS_DB_DIR").expect("Environment variable `ANNIS_DB_DIR` is not set");

    tauri::Builder::default()
        .manage(State::from_db_dir(db_dir.into()))
        .invoke_handler(tauri::generate_handler![api::get_corpus_names])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
