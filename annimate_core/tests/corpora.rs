use annimate_core::Storage;
use std::{
    fs::{self, File},
    path::Path,
};

const ANNIMATE_TOML: &str = r#"
metadata-version = 1

[corpus-sets."Test set"]
corpus-names = ["subtok.demo"]
"#;

#[test]
fn corpora() {
    let db_dir = Path::new(concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/corpora"));
    fs::create_dir_all(db_dir).unwrap();
    fs::write(db_dir.join("annimate.toml"), ANNIMATE_TOML).unwrap();

    let storage = Storage::from_db_dir(db_dir).unwrap();
    for corpus_path in ["subtok.demo_relANNIS.zip", "subtok.demo2_relANNIS.zip"] {
        storage
            .import_corpora_from_zip(
                File::open(
                    Path::new(concat!(env!("CARGO_MANIFEST_DIR"), "/tests/data")).join(corpus_path),
                )
                .unwrap(),
                |_| (),
            )
            .unwrap();
    }

    let corpora = storage.corpora().unwrap();

    insta::with_settings!(
        {
             omit_expression => true,
        },
        { insta::assert_debug_snapshot!(corpora) }
    );
}
