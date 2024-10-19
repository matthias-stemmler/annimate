//! This is a Tauri desktop UI for Annimate.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![deny(missing_docs)]

mod api;
mod error;
mod slot;
mod state;

use std::env;

use state::AppState;
use tauri::{AppHandle, Manager};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
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
            app.state::<AppState>().init(app.handle().clone());
            Ok(())
        })
        .on_page_load(|window, _| {
            window
                .eval(&format!(
                    "window.__ANNIMATE__=JSON.parse('{}')",
                    serde_json::json!({
                        "updateEnabled": is_update_enabled(window.app_handle()),
                        "versionInfo": annimate_core::VERSION_INFO,
                    })
                ))
                .expect("global __ANNIMATE__ should be injected successfully");
        })
        .run(tauri::generate_context!())
        .expect("Tauri application should run successfully");
}

// This is exactly the same logic as used by the auto-update mechanism before Tauri v2
// See https://github.com/tauri-apps/tauri/blob/tauri-v1.8.1/core/tauri/src/app.rs#L976

#[cfg(target_os = "linux")]
fn is_update_enabled(app_handle: &AppHandle) -> bool {
    cfg!(dev) || app_handle.state::<tauri::Env>().appimage.is_some()
}

#[cfg(not(target_os = "linux"))]
fn is_update_enabled(_: &AppHandle) -> bool {
    true
}
