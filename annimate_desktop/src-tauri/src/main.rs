//! This is a Tauri desktop UI for Annimate.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![deny(missing_docs)]

mod api;
mod delayed_queue;
mod error;
mod preload;
mod state;

use serde::Serialize;
use serialize_to_javascript::{DefaultTemplate, Options, Template, default_template};
use state::AppState;
use tauri::webview::PageLoadEvent;
use tauri::{Manager, Webview};
use tauri_plugin_window_state::{StateFlags, WindowExt};

const THREAD_STACK_SIZE_MB: usize = 64;

#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

fn main() {
    // Use custom tokio runtime with larger stack size (default is 2 MB) to avoid stack overflows
    // when validating queries. 64 MB is enough for worst-case queries of the maximal complexity
    // (operator count) of 4096.
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .thread_stack_size(THREAD_STACK_SIZE_MB * 1024 * 1024)
        .enable_all()
        .build()
        .expect("runtime should build");

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
            api::get_exportable_edge_types,
            api::get_exportable_node_anno_keys,
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
            window.show().expect("main window should show");

            Ok(())
        })
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Started {
                inject_static_data(webview);
            }
        })
        .run(tauri::generate_context!())
        .expect("Tauri application should run");
}

fn inject_static_data(webview: &Webview) {
    #[derive(Template)]
    #[default_template("static_data.js")]
    struct StaticData {
        value: StaticDataValue,
    }

    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct StaticDataValue {
        version_info: annimate_core::VersionInfo,
    }

    let static_data = StaticData {
        value: StaticDataValue {
            version_info: annimate_core::VERSION_INFO,
        },
    };

    let static_data_js = static_data
        .render_default(&Options::default())
        .expect("static data should render as JavaScript")
        .to_string();

    webview
        .eval(static_data_js)
        .expect("static data should be injected");
}
