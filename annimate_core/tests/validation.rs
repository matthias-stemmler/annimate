use std::fs;
use std::path::Path;

use annimate_core::QueryLanguage::*;
use annimate_core::{QueryAnalysisResult, Storage};

const DB_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/validation/db");

macro_rules! validation_test {
    ($(
        $name:ident: $query:expr, $query_language:expr => $expected:expr
    )*) => {
        $(
            #[test]
            fn $name() {
                let db_dir = Path::new(DB_DIR).join(stringify!($name));

                let _ = fs::remove_dir_all(&db_dir);
                let storage = Storage::from_db_dir(db_dir).unwrap();

                let result = storage.validate_query($query, $query_language).unwrap();

                let actual = match &result {
                    QueryAnalysisResult::Valid(_) => Ok(()),
                    QueryAnalysisResult::Invalid(err) => Err(err.desc.as_str()),
                };

                assert_eq!(actual, $expected);
            }
        )*
    };
}

validation_test! {
    valid_empty: "", AQL => Ok(())

    valid_nonempty: "foo1=\"foo2\"", AQL => Ok(())

    valid_meta_quirks: "meta::doc=\"foo\"", AQLQuirksV3 => Ok(())

    valid_max_length: "a".repeat(400).as_str(), AQL => Ok(())

    invalid_exceeding_max_length: "a".repeat(401).as_str(), AQL => Err("Query is too long (401 characters), must be at most 400 characters.")

    invalid_syntax: "foo=", AQL => Err("Unexpected end of query.")

    invalid_syntax_unexpected_token: "foo==", AQL => Err("Unexpected token in query.")

    invalid_meta: "meta::doc=\"foo\"", AQL => Err("Legacy metadata search is no longer allowed. Use the @* operator and normal attribute search instead.")

    invalid_unbound_variable: "foo1=\"foo2\" & bar1=\"bar2\"", AQL => Err("Variable \"#2\" not bound (use linguistic operators)")
}
