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
                    QueryAnalysisResult::Invalid(err) => Err((
                        err.message.as_str(),
                        err.location.as_ref().map(|range| (
                            (range.start.line_index, range.start.column_index),
                            range.end.as_ref().map(|end| (end.line_index, end.column_index)),
                        )),
                    )),
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

    // At the operator-count limit the complexity check passes, so graphANNIS runs and reports the
    // actual syntax error (here the dangling trailing operator) rather than "Query is too complex".
    invalid_max_operator_count: "a@".repeat(4096).as_str(), AQL =>
        Err(("Unexpected end of query.", Some(((0, 8191), None))))

    // One operator over the limit is rejected by the complexity check before graphANNIS runs.
    invalid_exceeding_max_operator_count: "a@".repeat(4097).as_str(), AQL =>
        Err(("Query is too complex", None))

    invalid_syntax: "foo=", AQL =>
        Err(("Unexpected end of query.", Some(((0, 3), None))))

    invalid_syntax_unexpected_token: "foo==", AQL =>
        Err(("Unexpected token in query.", Some(((0, 3), Some((0, 4))))))

    invalid_meta: "meta::doc=\"foo\"", AQL =>
        Err(("Legacy metadata search is no longer allowed. Use the @* operator and normal attribute search instead.", Some(((0, 0), Some((0, 5))))))

    invalid_unbound_variable: "foo1=\"foo2\" & bar1=\"bar2\"", AQL =>
        Err(("Variable \"#2\" not bound (use linguistic operators)", Some(((0, 14), Some((0, 25))))))
}
