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

macro_rules! snapshot {
    ($name:expr, $storage:expr) => {
        let corpora = $storage.corpora().unwrap();
        let metadata = fs::read_to_string(Path::new(DB_DIR).join(METADATA_FILE)).unwrap();
        let snapshot = format!("{corpora:#?}\n\n--\n\n{metadata}");

        insta::with_settings!(
            {
                 omit_expression => true,
            },
            { insta::assert_snapshot!($name, snapshot) }
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

    snapshot!("00-default", storage);

    drop(storage);
    fs::write(Path::new(DB_DIR).join(METADATA_FILE), INITIAL_METADATA).unwrap();
    let storage = Storage::from_db_dir(DB_DIR).unwrap();

    snapshot!("01_initial", storage);

    storage
        .toggle_corpus_in_set("Test set", "subtok.demo")
        .unwrap();

    snapshot!("02_toggle1", storage);

    storage
        .toggle_corpus_in_set("Test set", "subtok.demo2")
        .unwrap();

    snapshot!("03_toggle2", storage);

    storage
        .add_corpora_to_set("Test set".into(), &["subtok.demo", "subtok.demo2"])
        .unwrap();

    snapshot!("04_add_corpora_to_set_existing1", storage);

    storage
        .add_corpora_to_set("Test set".into(), &["subtok.demo"])
        .unwrap();

    snapshot!("05_add_corpora_to_set_existing2", storage);

    storage
        .add_corpora_to_set("Test set 2".into(), &[""; 0])
        .unwrap();

    snapshot!("06_add_corpora_to_set_new1", storage);

    storage
        .add_corpora_to_set("Test set 2".into(), &["subtok.demo"])
        .unwrap();

    snapshot!("07_add_corpora_to_set_new2", storage);

    storage.create_corpus_set("Test set 3".into()).unwrap();

    snapshot!("08_create_corpus_set", storage);

    storage
        .rename_corpus_set("Test set 2", "Test set 2 new".into())
        .unwrap();

    snapshot!("09_rename_corpus_set", storage);

    storage.delete_corpus("subtok.demo2").unwrap();

    snapshot!("10_delete_corpus", storage);

    storage
        .delete_corpus_set("Test set 2 new".into(), false)
        .unwrap();

    snapshot!("11_delete_corpus_set_only", storage);

    storage.delete_corpus_set("Test set".into(), true).unwrap();

    snapshot!("11_delete_corpus_set_with_corpora", storage);
}
