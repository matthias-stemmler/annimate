#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod error;

use api::State;
use std::env;

fn main() {
    let db_dir = env::var("ANNIS_DB_DIR").expect("Environment variable `ANNIS_DB_DIR` is not set");

    tauri::Builder::default()
        .manage(State::from_db_dir(db_dir.into()))
        .invoke_handler(tauri::generate_handler![
            api::export_matches,
            api::get_corpora,
            api::get_exportable_anno_keys,
            api::get_query_nodes,
            api::get_segmentations,
            api::validate_query
        ])
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
