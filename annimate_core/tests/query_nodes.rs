use std::fs;
use std::path::Path;

use annimate_core::QueryLanguage::*;
use annimate_core::{QueryNode, Storage};

const DB_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/query_nodes");

macro_rules! query_nodes_test {
    ($(
        $name:ident: $query:expr, $query_language:expr => [$([$($expected_var:expr => $expected_frag:expr),*$(,)?]),*$(,)?]
    )*) => { $(
        #[test]
        fn $name() {
            let db_dir = Path::new(DB_DIR).join(stringify!($name));

            let _ = fs::remove_dir_all(&db_dir);
            let storage = Storage::from_db_dir(db_dir).unwrap();

            let actual: Vec<_> = storage
                .query_nodes($query, $query_language)
                .unwrap()
                .valid()
                .unwrap()
                .into_iter()
                .collect();

            let expected: Vec<Vec<QueryNode>> = vec![$(
                vec![$(
                    QueryNode {
                        query_fragment: $expected_frag.into(),
                        variable: $expected_var.into(),
                    }
                ),*]
            ),*];

            assert_eq!(actual, expected);
        }
    )* };
}

query_nodes_test! {
    simple: "foo1=\"foo2\"", AQL => [
        ["1" => "foo1=\"foo2\""],
    ]
    with_named_variables: "var#foo1=\"foo2\"", AQL => [
        ["var" => "foo1=\"foo2\""],
    ]
    conjunction: "foo1=\"foo2\" & bar1=\"bar2\"", AQL => [
        ["1" => "foo1=\"foo2\""],
        ["2" => "bar1=\"bar2\""],
    ]
    disjunction: "foo1=\"foo2\" | bar1=\"bar2\"", AQL => [
        ["1" => "foo1=\"foo2\"", "2" => "bar1=\"bar2\""],
    ]
    cnf: "(foo1=\"foo2\" | bar1=\"bar2\") & (baz1=\"baz2\" | qux1=\"qux2\")", AQL => [
        ["1" => "foo1=\"foo2\"", "3" => "foo1=\"foo2\"", "5" => "bar1=\"bar2\"", "7" => "bar1=\"bar2\""],
        ["2" => "baz1=\"baz2\"", "4" => "qux1=\"qux2\"", "6" => "baz1=\"baz2\"", "8" => "qux1=\"qux2\""],
    ]
    dnf: "(foo1=\"foo2\" & bar1=\"bar2\") | (baz1=\"baz2\" & qux1=\"qux2\")", AQL => [
        ["1" => "foo1=\"foo2\"", "3" => "baz1=\"baz2\""],
        ["2" => "bar1=\"bar2\"", "4" => "qux1=\"qux2\""],
    ]
    optional_node_at_end: "foo1=\"foo2\" & bar1=\"bar2\" & baz?", AQL => [
        ["1" => "foo1=\"foo2\""],
        ["2" => "bar1=\"bar2\""],
    ]
    optional_node_in_between: "foo1=\"foo2\" & bar? & baz1=\"baz2\"", AQL => [
        ["1" => "foo1=\"foo2\""],
        ["3" => "baz1=\"baz2\""],
    ]
    optional_node_multiple: "foo? & bar & baz? & quux?", AQL => [
        ["2" => "bar"],
    ]
    meta_only_single: "meta::doc=\"foo\"", AQLQuirksV3 => []
    meta_only_multiple: "meta::doc=\"foo\" & meta::foo1=\"foo2\"", AQLQuirksV3 => []
    meta_single: "meta::doc=\"foo\" & bar1=\"bar2\"", AQLQuirksV3 => [
        ["1" => "bar1=\"bar2\""],
    ]
    meta_multiple: "meta::doc=\"foo\" & bar1=\"bar2\" & meta::foo1=\"foo2\"", AQLQuirksV3 => [
        ["1" => "bar1=\"bar2\""],
    ]
    meta_with_doc: "meta::doc=\"foo\" & doc=\"foo\" & annis:doc", AQLQuirksV3 => [
        ["1" => "doc=\"foo\""],
        ["2" => "annis:doc"],
    ]
    meta_with_optional: "meta::doc=\"foo\" & bar? & baz1=\"baz2\"", AQLQuirksV3 => [
        ["2" => "baz1=\"baz2\""],
    ]
}
