use std::fs;
use std::path::Path;

use annimate_core::QueryLanguage::*;
use annimate_core::{QueryAnalysisResult, Storage};

const DB_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/validation/db");

macro_rules! validation_test {
    ($(
        $name:ident: $query:expr, $query_language:expr => $expected_valid:expr
    )*) => {
        $(
            #[test]
            fn $name() {
                let db_dir = Path::new(DB_DIR).join(stringify!($name));

                let _ = fs::remove_dir_all(&db_dir);
                let storage = Storage::from_db_dir(db_dir).unwrap();

                let result = storage.validate_query($query, $query_language).unwrap();

                assert_eq!(matches!(result, QueryAnalysisResult::Valid(_)), $expected_valid);
            }
        )*
    };
}

validation_test! {
    valid_empty: "", AQL => true

    valid_nonempty: "foo1=\"foo2\"", AQL => true

    valid_meta_quirks: "meta::doc=\"foo\"", AQLQuirksV3 => true

    valid_max_length: "a".repeat(400).as_str(), AQL => true

    invalid_exceeding_max_length: "a".repeat(401).as_str(), AQL => false

    invalid_meta: "meta::doc=\"foo\"", AQL => false

    invalid_syntax: "foo1=", AQL => false

    invalid_unbound_variable: "foo1=\"foo2\" & bar1=\"bar2\"", AQL => false
}
