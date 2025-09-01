//! This is a Tauri desktop UI for Annimate.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![deny(missing_docs)]

mod api;
mod delayed_queue;
mod error;
mod preload;
mod state;

use std::thread;

use state::AppState;
use tauri::{AppHandle, Manager};
use tauri_plugin_window_state::{StateFlags, WindowExt};

const THREAD_STACK_SIZE_MB: usize = 4;

fn main() {
    // Initialize global Rayon thread pool. This matches Rayon's default behavior except that
    // `num_threads` cannot be overridden by environment variables.
    rayon::ThreadPoolBuilder::default()
        .num_threads(
            thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(1),
        )
        .build_global()
        .expect("Rayon thread pool should build successfully");

    // Use custom tokio runtime with larger stack size (default is 2 MB) to avoid stack overflows
    // when validating queries. 4 MB is enough for worst-case queries of the maximal length of
    // 400 characters.
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .thread_stack_size(THREAD_STACK_SIZE_MB * 1024 * 1024)
        .enable_all()
        .build()
        .expect("runtime should build successfully");

    // Note that `runtime` must stay live until the end of `main`, which is not guaranteed by just
    // having an existing handle.
    tauri::async_runtime::set(runtime.handle().clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            // In case this instance is terminated because another instance is already running,
            // focus the main window of the running instance (ignoring errors, because this is not
            // critical)
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .skip_initial_state("main") // state will be restored manually, see below
                .build(),
        )
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            api::add_corpora_to_set,
            api::clear_cache,
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
            api::load_project,
            api::rename_corpus_set,
            api::save_project,
            api::set_corpus_names_to_preload,
            api::toggle_corpus_in_set,
            api::validate_query
        ])
        .setup(|app| {
            app.state::<AppState>().init(app.handle().clone());

            // The main window is initially invisible as defined in tauri.conf.json
            // We show it only after restoring its state in order to avoid a flashing effect on
            // Windows
            //
            // NOTES:
            // 1) We could instead make the plugin restore the state automatically and only show the
            //    window here in `setup`, but explicitly restoring the state here guarantees that
            //    this happens before the window is shown.
            // 2) Restoring the state includes restoring the visibility, but we show the window
            //    explicitly to cover for the first start (when there is no saved window state yet)
            //    and for the case that the restoration fails.
            let window = app
                .get_webview_window("main")
                .expect("main window should exist");
            let _ = window.restore_state(StateFlags::all());
            window.show().expect("main window should show successfully");

            Ok(())
        })
        .on_page_load(|window, _| {
            window
                .eval(format!(
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
