//! Build script for `annimate_core`.

use cargo_metadata::{Metadata, MetadataCommand};

fn main() {
    let metadata = MetadataCommand::new()
        .exec()
        .expect("`cargo metadata` should run successfully");

    assert_single_rayon_version(&metadata);
    inject_graphannis_version(&metadata);
}

fn assert_single_rayon_version(metadata: &Metadata) {
    let rayon_versions: Vec<_> = metadata
        .packages
        .iter()
        .filter(|p| p.name.as_str() == "rayon")
        .collect();

    assert_eq!(
        rayon_versions.len(),
        1,
        "there should be exactly one version of `rayon` in the dependency tree"
    );
}

fn inject_graphannis_version(metadata: &Metadata) {
    let graphannis_version = metadata
        .packages
        .iter()
        .find(|p| p.name.as_str() == "graphannis")
        .expect("Cargo metadata should contain `graphannis` package")
        .version
        .to_string();

    println!("cargo::rustc-env=GRAPHANNIS_VERSION={graphannis_version}");
}
