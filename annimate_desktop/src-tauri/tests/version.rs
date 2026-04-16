#[test]
fn versions_from_different_sources_are_identical() {
    let core_version = annimate_core::VERSION_INFO.annimate_version;
    let desktop_cargo_version = env!("CARGO_PKG_VERSION");
    let desktop_tauri_version = {
        let context: tauri::Context<tauri::Wry> = tauri::generate_context!();
        context.package_info().version.to_string()
    };

    assert_eq!(desktop_cargo_version, core_version);
    assert_eq!(desktop_tauri_version, core_version);
}
