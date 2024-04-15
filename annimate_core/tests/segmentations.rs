use annimate_core::Storage;
use serde::Serialize;
use std::fs::{self, File};
use std::path::Path;

macro_rules! segmentations_test {
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

                let db_dir = (concat!(
                    env!("CARGO_TARGET_TMPDIR"),
                    "/tests/segmentations/",
                    stringify!($name)
                ));

                fs::remove_dir_all(db_dir).unwrap();
                let storage = Storage::from_db_dir(db_dir).unwrap();

                for corpus_path in test_data.corpus_paths {
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

                let segmentations = storage.segmentations(test_data.corpus_names).unwrap();

                insta::with_settings!(
                    {
                         info => &test_data,
                         omit_expression => true,
                    },
                    { insta::assert_debug_snapshot!(segmentations) }
                );
            }
        )*
    };
}

segmentations_test! {
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
