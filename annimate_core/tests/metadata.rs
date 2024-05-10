use std::fs;
use std::path::Path;

use annimate_core::Storage;

const DATA_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/data");
const DB_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/corpora");
const METADATA_FILE: &str = "annimate.toml";

const INITIAL_METADATA: &str = r#"
metadata-version = 1

[corpus-sets."Test set"]
corpus-names = ["subtok.demo"]
"#;

macro_rules! snapshot_corpora {
    ($storage:expr) => {
        let corpora = $storage.corpora().unwrap();

        insta::with_settings!(
            {
                 omit_expression => true,
            },
            { insta::assert_debug_snapshot!(corpora) }
        );
    };
}

macro_rules! snapshot_metadata {
    ($name:expr) => {
        let metadata = fs::read_to_string(Path::new(DB_DIR).join(METADATA_FILE)).unwrap();

        insta::with_settings!(
            {
                 omit_expression => true,
            },
            { insta::assert_snapshot!($name, metadata) }
        );
    };
}

#[test]
fn metadata() {
    let _ = fs::remove_dir_all(DB_DIR);
    let storage = Storage::from_db_dir(DB_DIR).unwrap();
    storage
        .import_corpora(
            vec![
                Path::new(DATA_DIR).join("subtok.demo_relANNIS.zip"),
                Path::new(DATA_DIR).join("subtok.demo2_relANNIS.zip"),
            ],
            |_| (),
            || false,
        )
        .unwrap();

    snapshot_metadata!("default");

    drop(storage);
    fs::write(Path::new(DB_DIR).join(METADATA_FILE), INITIAL_METADATA).unwrap();
    let storage = Storage::from_db_dir(DB_DIR).unwrap();

    snapshot_metadata!("initial");
    snapshot_corpora!(storage);

    storage
        .toggle_corpus_in_set("Test set", "subtok.demo")
        .unwrap();

    snapshot_metadata!("toggle1");

    storage
        .toggle_corpus_in_set("Test set", "subtok.demo2")
        .unwrap();

    snapshot_metadata!("toggle2");

    storage.delete_corpus("subtok.demo2").unwrap();

    snapshot_metadata!("delete");

    storage
        .add_corpora_to_set("Test set".into(), &["subtok.demo", "subtok.demo2"])
        .unwrap();

    snapshot_metadata!("add_corpora_to_set_existing1");

    storage
        .add_corpora_to_set("Test set".into(), &["subtok.demo"])
        .unwrap();

    snapshot_metadata!("add_corpora_to_set_existing2");

    storage
        .add_corpora_to_set("Test set 2".into(), &[""; 0])
        .unwrap();

    snapshot_metadata!("add_corpora_to_set_new1");

    storage
        .add_corpora_to_set("Test set 2".into(), &["subtok.demo"])
        .unwrap();

    snapshot_metadata!("add_corpora_to_set_new2");

    storage.create_corpus_set("Test set 3".into()).unwrap();

    snapshot_metadata!("create_corpus_set");

    storage
        .rename_corpus_set("Test set 2", "Test set 2 new".into())
        .unwrap();

    snapshot_metadata!("rename_corpus_set");
}
