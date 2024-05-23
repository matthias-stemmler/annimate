//! Build script for `annimate_core`.

use cargo_metadata::MetadataCommand;

fn main() {
    inject_graphannis_version();
}

fn inject_graphannis_version() {
    let metadata = MetadataCommand::new()
        .exec()
        .expect("Failed to run `cargo metadata`");

    let graphannis_version = metadata
        .packages
        .into_iter()
        .find(|p| p.name == "graphannis")
        .expect("`graphannis` package not found in Cargo metadata`")
        .version
        .to_string();

    println!("cargo::rustc-env=GRAPHANNIS_VERSION={graphannis_version}");
}
