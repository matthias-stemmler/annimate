//! This is a Tauri desktop UI for Annimate.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod error;
mod slot;
mod state;

use std::env;

use state::AppState;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            api::add_corpora_to_set,
            api::create_corpus_set,
            api::delete_corpus,
            api::delete_corpus_set,
            api::export_matches,
            api::get_corpora,
            api::get_db_dir,
            api::get_exportable_anno_keys,
            api::get_query_nodes,
            api::get_segmentations,
            api::import_corpora,
            api::rename_corpus_set,
            api::toggle_corpus_in_set,
            api::validate_query
        ])
        .setup(|app| {
            app.state::<AppState>().init(app.handle());
            Ok(())
        })
        .on_page_load(|window, _| {
            window
                .eval(&format!(
                    "window.__ANNIMATE__=JSON.parse('{}')",
                    serde_json::json!({
                        "versionInfo": annimate_core::VERSION_INFO
                    })
                ))
                .expect("error while injecting global __ANNIMATE__");
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
