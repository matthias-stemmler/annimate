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
fn corpora() {
    let _ = fs::remove_dir_all(DB_DIR);
    let storage = Storage::from_db_dir(DB_DIR).unwrap();
    for corpus_path in ["subtok.demo_relANNIS.zip", "subtok.demo2_relANNIS.zip"] {
        storage
            .import_corpora(vec![Path::new(DATA_DIR).join(corpus_path)], |_| ())
            .unwrap();
    }

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
}
