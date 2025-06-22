use std::fs;
use std::path::Path;

use annimate_core::Storage;
use serde::Serialize;

const DATA_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/data");
const DB_DIR: &str = concat!(
    env!("CARGO_TARGET_TMPDIR"),
    "/tests/exportable_anno_keys/db"
);

macro_rules! exportable_anno_keys_test {
    ($(
        $name:ident: {
            corpus_paths: $corpus_paths:expr,
            corpus_names: $corpus_names:expr,
        }
    )*) => {
        $(
            #[test]
            fn $name() {
                let test_data = TestData {
                    corpus_paths: &$corpus_paths,
                    corpus_names: &$corpus_names,
                };

                let db_dir = Path::new(DB_DIR).join(stringify!($name));

                let _ = fs::remove_dir_all(&db_dir);
                let storage = Storage::from_db_dir(db_dir).unwrap();

                storage
                    .import_corpora(
                        test_data
                            .corpus_paths
                            .into_iter()
                            .map(|p| Path::new(DATA_DIR).join(p))
                            .collect(),
                        |_| (),
                        || false,
                    )
                    .unwrap();

                let exportable_anno_keys = storage
                    .exportable_anno_keys(test_data.corpus_names)
                    .unwrap();

                insta::with_settings!(
                    {
                         info => &test_data,
                         omit_expression => true,
                    },
                    { insta::assert_debug_snapshot!(exportable_anno_keys) }
                );
            }
        )*
    };
}

exportable_anno_keys_test! {
    empty: {
        corpus_paths: ["empty_graphml.zip"],
        corpus_names: ["empty"],
    }
    subtok: {
        corpus_paths: ["subtok.demo_relANNIS.zip"],
        corpus_names: ["subtok.demo"],
    }
    pcc2: {
        corpus_paths: ["pcc2_v7_relANNIS.zip"],
        corpus_names: ["pcc2"],
    }
}

#[derive(Serialize)]
struct TestData {
    corpus_paths: &'static [&'static str],
    corpus_names: &'static [&'static str],
}
