#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod error;

use api::State;

fn main() {
    tauri::Builder::default()
        .manage(State::default())
        .invoke_handler(tauri::generate_handler![api::get_corpus_names])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
