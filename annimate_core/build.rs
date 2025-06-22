//! Build script for `annimate_core`.

use cargo_metadata::MetadataCommand;

fn main() {
    inject_graphannis_version();
}

fn inject_graphannis_version() {
    let metadata = MetadataCommand::new()
        .exec()
        .expect("`cargo metadata` should run successfully");

    let graphannis_version = metadata
        .packages
        .into_iter()
        .find(|p| p.name.as_str() == "graphannis")
        .expect("Cargo metadata should contain `graphannis` package")
        .version
        .to_string();

    println!("cargo::rustc-env=GRAPHANNIS_VERSION={graphannis_version}");
}
