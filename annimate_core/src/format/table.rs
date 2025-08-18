use std::collections::{BTreeSet, HashMap};
use std::ops::Range;
use std::vec;

use itertools::{Itertools, PutBack};

use crate::anno::{self, AnnoKeyFormat};
use crate::aql::QueryNode;
use crate::error::{self, AnnimateError};
use crate::query::{ExportData, ExportDataAnno, ExportDataText, Match, TextPart};

#[derive(Clone, Copy, Debug)]
enum ColumnType {
    Match,
    Context,
}

use ColumnType::*;

/// Configuration of what to export in a single table column.
#[derive(Clone, Debug)]
pub enum TableExportColumn {
    /// Number of the match, numbered sequentially starting from 1.
    Number,

    /// Data of the match.
    Data(ExportData),
}

impl TableExportColumn {
    pub(super) fn data(&self) -> Option<&ExportData> {
        match self {
            TableExportColumn::Data(data) => Some(data),
            _ => None,
        }
    }
}

pub(super) trait TableWriter {
    fn write_record<I>(&mut self, record: I) -> Result<(), AnnimateError>
    where
        I: IntoIterator<Item: AsRef<str>>;
}

pub(super) fn export<F, G, I, W>(
    columns: &[TableExportColumn],
    matches_iter: I,
    query_nodes: &[Vec<QueryNode>],
    anno_key_format: &AnnoKeyFormat,
    out: &mut W,
    mut on_matches_exported: F,
    cancel_requested: G,
) -> Result<(), AnnimateError>
where
    F: FnMut(usize),
    G: Fn() -> bool,
    I: Iterator<Item = Result<Match, AnnimateError>> + ExactSizeIterator,
    W: TableWriter,
{
    let count = matches_iter.len();
    let mut matches = Vec::with_capacity(count);

    let max_match_parts_by_text = {
        let mut max_match_parts_by_text = HashMap::new();

        for (i, m) in matches_iter.enumerate() {
            error::cancel_if(&cancel_requested)?;
            on_matches_exported(i);

            let m = m?;

            for (text, parts) in &m.texts {
                let match_parts = parts.iter().filter(|p| p.is_match()).count();
                let max_match_parts = max_match_parts_by_text.entry(text.clone()).or_insert(0);
                if match_parts > *max_match_parts {
                    *max_match_parts = match_parts;
                }
            }

            matches.push(m);
        }

        error::cancel_if(&cancel_requested)?;
        on_matches_exported(count);

        max_match_parts_by_text
    };

    error::cancel_if(&cancel_requested)?;

    out.write_record(columns.iter().flat_map(|c| match c {
        TableExportColumn::Number => vec!["Number".into()],
        TableExportColumn::Data(ExportData::Anno(ExportDataAnno::Corpus { anno_key })) => {
            vec![format!("Corpus {}", anno_key_format.display(anno_key))]
        }
        TableExportColumn::Data(ExportData::Anno(ExportDataAnno::Document { anno_key })) => {
            if anno::is_doc_anno_key(anno_key) {
                vec!["Document".into()]
            } else {
                vec![format!("Document {}", anno_key_format.display(anno_key))]
            }
        }
        TableExportColumn::Data(ExportData::Anno(ExportDataAnno::MatchNode {
            anno_key,
            index,
        })) => {
            vec![format!(
                "{} {}",
                query_nodes
                    .get(*index)
                    .expect("query node index should be valid")
                    .iter()
                    .map(|n| &n.variable)
                    .collect::<BTreeSet<_>>()
                    .into_iter()
                    .format_with("|", |elt, f| f(&format_args!("#{elt}"))),
                anno_key_format.display(anno_key)
            )]
        }
        TableExportColumn::Data(ExportData::Text(text)) => {
            let max_match_parts = *max_match_parts_by_text.get(text).unwrap_or(&0);
            let column_types = ColumnTypes::new(max_match_parts, query_nodes.len(), text);

            column_types
                .into_iter()
                .map(|c| {
                    format!(
                        "{} ({})",
                        match c {
                            (Match, _) if max_match_parts <= 1 => "Match".into(),
                            (Match, i) => format!("Match {}", i + 1),
                            (Context, 0) if max_match_parts == 0 => "Context".into(),
                            (Context, 0)
                                if max_match_parts == 1 && column_types.has_left_context() =>
                            {
                                "Left context".into()
                            }
                            (Context, _) if max_match_parts == 1 => "Right context".into(),
                            (Context, i) => format!("Context {}", i + 1),
                        },
                        text.segmentation.as_deref().unwrap_or("tokens")
                    )
                })
                .collect()
        }
    }))?;

    for (i, Match { annos, texts }) in matches.into_iter().enumerate() {
        error::cancel_if(&cancel_requested)?;

        out.write_record(columns.iter().flat_map(|c| match c {
            TableExportColumn::Number => vec![(i + 1).to_string()],
            TableExportColumn::Data(ExportData::Anno(anno)) => {
                vec![
                    annos
                        .get(anno)
                        .map(|s| s.trim().to_string())
                        .unwrap_or_default(),
                ]
            }
            TableExportColumn::Data(ExportData::Text(text)) => {
                let max_match_parts = *max_match_parts_by_text.get(text).unwrap();
                let parts = texts.get(text).unwrap().clone();
                let column_types = ColumnTypes::new(max_match_parts, query_nodes.len(), text);
                TextColumnsAligned::new(parts, column_types).collect()
            }
        }))?;
    }

    Ok(())
}

#[derive(Debug)]
struct TextColumnsAligned {
    text_columns: PutBack<TextColumns>,
    column_types: ColumnTypesIter,
}

impl TextColumnsAligned {
    fn new(parts: Vec<TextPart>, column_types: ColumnTypes) -> Self {
        Self {
            text_columns: itertools::put_back(TextColumns::new(parts)),
            column_types: column_types.into_iter(),
        }
    }
}

impl Iterator for TextColumnsAligned {
    type Item = String;

    fn next(&mut self) -> Option<Self::Item> {
        let (required_column_type, _) = self.column_types.next()?;

        loop {
            return match (required_column_type, self.text_columns.next()) {
                (Match, Some((Context, _))) => continue,
                (Match, Some((Match, f))) | (Context, Some((Context, f))) => Some(f),
                (Context, Some((Match, f))) => {
                    self.text_columns.put_back((Match, f));
                    Some("".into())
                }
                (Match | Context, None) => Some("".into()),
            };
        }
    }
}

#[derive(Debug)]
struct TextColumns {
    parts: vec::IntoIter<TextPart>,
    pending_column: Option<(ColumnType, String)>,
}

impl TextColumns {
    fn new(parts: Vec<TextPart>) -> Self {
        Self {
            parts: parts.into_iter(),
            pending_column: None,
        }
    }
}

impl Iterator for TextColumns {
    type Item = (ColumnType, String);

    fn next(&mut self) -> Option<(ColumnType, String)> {
        if let Some(column) = self.pending_column.take() {
            return Some(column);
        }

        let mut context_column: Option<String> = None;

        let match_column = loop {
            let serialized_part = match self.parts.next() {
                Some(TextPart::Match { segments, .. }) => break Some(segments.join(" ")),
                Some(TextPart::Context { segments }) => segments.join(" "),
                Some(TextPart::Gap) => "(...)".into(),
                None => break None,
            };

            context_column = Some(match context_column.take() {
                None => serialized_part,
                Some(mut c) => {
                    c.push(' ');
                    c.push_str(&serialized_part);
                    c
                }
            });
        };

        let context_column = context_column.map(|c| (Context, c));
        let match_column = match_column.map(|c| (Match, c));

        if let Some(context_column) = context_column {
            self.pending_column = match_column;
            Some(context_column)
        } else {
            match_column
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct ColumnTypes {
    column_count: usize,
    has_match: bool,
    has_left_context: bool,
    has_right_context: bool,
}

impl ColumnTypes {
    fn new(match_count: usize, query_node_count: usize, data: &ExportDataText) -> Self {
        let has_match = match_count > 0;
        let has_secondary_nodes = match &data.primary_node_indices {
            Some(indices) => (0..query_node_count).any(|i| !indices.contains(&i)),
            None => false,
        };

        // Reserve a column for left/right context if the left/right context size is non-zero *or*
        // there are secondary nodes. In the latter case there may be context even if the context
        // size is zero because context refers to all nodes but only primary nodes count as
        // a match.
        let has_left_context = data.left_context > 0 || has_secondary_nodes;
        let has_right_context = data.right_context > 0 || has_secondary_nodes;

        let column_count = match (match_count, has_left_context, has_right_context) {
            (0, false, false) => 0,
            (0, _, _) => 1,
            (n, false, false) => n,
            (n, true, false) | (n, false, true) => 2 * n,
            (n, true, true) => 2 * n + 1,
        };

        Self {
            column_count,
            has_match,
            has_left_context,
            has_right_context,
        }
    }

    fn has_left_context(&self) -> bool {
        self.has_left_context
    }
}

impl IntoIterator for ColumnTypes {
    type Item = (ColumnType, usize);
    type IntoIter = ColumnTypesIter;

    fn into_iter(self) -> Self::IntoIter {
        ColumnTypesIter {
            column_indices: 0..self.column_count,
            has_match: self.has_match,
            has_left_context: self.has_left_context,
            has_right_context: self.has_right_context,
        }
    }
}

#[derive(Debug)]
struct ColumnTypesIter {
    column_indices: Range<usize>,
    has_match: bool,
    has_left_context: bool,
    has_right_context: bool,
}

impl Iterator for ColumnTypesIter {
    type Item = (ColumnType, usize);

    fn next(&mut self) -> Option<Self::Item> {
        let column_index = self.column_indices.next()?;

        Some(
            match (
                self.has_match,
                self.has_left_context,
                self.has_right_context,
                column_index % 2,
            ) {
                (false, _, _, _) => (Context, column_index),
                (_, false, false, _) => (Match, column_index),
                (_, false, _, 0) | (_, true, _, 1) => (Match, column_index / 2),
                _ => (Context, column_index / 2),
            },
        )
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use graphannis_core::graph::ANNIS_NS;
    use graphannis_core::types::AnnoKey;

    use super::*;

    macro_rules! export_test {
        ($(
            $name:ident: context = ($left_context:expr, $right_context:expr), matches = [
                $({doc_name = $doc_name:expr, parts = [$($part:tt)*]})*
            ] => $expected:expr
        )*) => { $(
            #[test]
            fn $name() {
                let mut writer = TestTableWriter::default();

                let text = ExportDataText {
                    left_context: $left_context,
                    right_context: $right_context,
                    segmentation: None,
                    primary_node_indices: None,
                };

                let export_data_anno_doc = ExportDataAnno::Document {
                    anno_key: AnnoKey {
                        ns: ANNIS_NS.into(),
                        name: "doc".into(),
                    },
                };

                export(
                    &[
                        TableExportColumn::Number,
                        TableExportColumn::Data(ExportData::Anno(export_data_anno_doc.clone())),
                        TableExportColumn::Data(ExportData::Text(text.clone())),
                    ],
                    [
                        $(Match {
                            annos: [(export_data_anno_doc.clone(), $doc_name.into())].into(),
                            texts: [(text.clone(), [ $(export_test!(@expand_part $part)),* ].into())].into(),
                        }),*
                    ].into_iter().map(Ok),
                    &[vec![]],
                    &AnnoKeyFormat::new(&HashSet::new()),
                    &mut writer,
                    |_| (),
                    || false,
                ).unwrap();

                assert_eq!(writer.into_records(), $expected);
            }
        )* };

        (@expand_part (C $($t:expr)*)) => { TextPart::Context { segments: vec![$($t.into()),*] } };
        (@expand_part (M $($t:expr)*)) => { TextPart::Match { index: 0, segments: vec![$($t.into()),*] } };
        (@expand_part (G)) => { TextPart::Gap };
    }

    export_test! {
        no_match_no_context: context=(0, 0), matches = [] => [
            ["Number", "Document"],
        ]

        no_match_only_left_context: context=(1, 0), matches = [] => [
            ["Number", "Document", "Context (tokens)"],
        ]

        no_match_only_right_context: context=(0, 1), matches = [] => [
            ["Number", "Document", "Context (tokens)"],
        ]

        no_match_both_contexts: context=(1, 1), matches = [] => [
            ["Number", "Document", "Context (tokens)"],
        ]

        no_match_node_both_contexts_no_parts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = []}
        ] => [
            ["Number", "Document", "Context (tokens)"],
            ["1"     , "doc1"    , ""                ],
        ]

        no_match_node_both_contexts_some_parts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222")]}
        ] => [
            ["Number", "Document", "Context (tokens)"],
            ["1"     , "doc1"    , "111 (...) 222"   ],
        ]

        one_match_node_no_context: context=(0, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => [
            ["Number", "Document", "Match (tokens)"],
            ["1"     , "doc1"    , "abc"           ],
        ]

        one_match_node_left_context: context=(1, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => [
            ["Number", "Document", "Left context (tokens)", "Match (tokens)"],
            ["1"     , "doc1"    , "111 (...) 222"        , "abc"           ],
        ]

        one_match_node_right_context: context=(0, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => [
            ["Number", "Document", "Match (tokens)", "Right context (tokens)"],
            ["1"     , "doc1"    , "abc"           , "333 (...) 444"         ],
        ]

        one_match_node_both_contexts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => [
            ["Number", "Document", "Left context (tokens)", "Match (tokens)", "Right context (tokens)"],
            ["1"     , "doc1"    , "111 (...) 222"        , "abc"           , "333 (...) 444"         ],
        ]

        one_match_node_multiple_segments: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111" "222") (G) (C "333" "444") (M "abc" "def") (C "555" "666") (G) (C "777" "888")]}
        ] => [
            ["Number", "Document", "Left context (tokens)", "Match (tokens)", "Right context (tokens)"],
            ["1"     , "doc1"    , "111 222 (...) 333 444", "abc def"       , "555 666 (...) 777 888" ],
        ]

        multiple_match_nodes_no_context: context=(0, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => [
            ["Number", "Document", "Match 1 (tokens)", "Match 2 (tokens)"],
            ["1"     , "doc1"    , "abc"             , "def"             ],
        ]

        multiple_match_nodes_left_context: context=(1, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => [
            ["Number", "Document", "Context 1 (tokens)", "Match 1 (tokens)", "Context 2 (tokens)", "Match 2 (tokens)"],
            ["1"     , "doc1"    , "111 (...) 222"     , "abc"             , "333 (...) 444"     , "def"             ],
        ]

        multiple_match_nodes_right_context: context=(0, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => [
            ["Number", "Document", "Match 1 (tokens)", "Context 1 (tokens)", "Match 2 (tokens)", "Context 2 (tokens)"],
            ["1"     , "doc1"    , "abc"             , "333 (...) 444"     , "def"             , "555 (...) 666"     ],
        ]

        multiple_match_nodes_both_contexts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => [
            ["Number", "Document", "Context 1 (tokens)", "Match 1 (tokens)", "Context 2 (tokens)", "Match 2 (tokens)", "Context 3 (tokens)"],
            ["1"     , "doc1"    , "111 (...) 222"     , "abc"             , "333 (...) 444"     , "def"             , "555 (...) 666"     ],
        ]

        multiple_matches_same_number_of_match_nodes: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(M "abc")]}
            {doc_name = "doc2", parts = [(C "111") (G) (C "222") (M "def") (C "333") (G) (C "444")]}
        ] => [
            ["Number", "Document", "Left context (tokens)", "Match (tokens)", "Right context (tokens)"],
            ["1"     , "doc1"    , ""                     , "abc"           , ""                      ],
            ["2"     , "doc2"    , "111 (...) 222"        , "def"           , "333 (...) 444"         ],
        ]

        multiple_matches_different_number_of_match_nodes: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(M "abc")]}
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "def") (C "333") (G) (C "444")]}
            {doc_name = "doc2", parts = [(M "ghi") (M "jkl")]}
            {doc_name = "doc2", parts = [(C "555") (G) (C "666") (M "mno") (C "777") (G) (C "888") (M "pqr") (C "999") (G) (C "000")]}
        ] => [
            ["Number", "Document", "Context 1 (tokens)", "Match 1 (tokens)", "Context 2 (tokens)", "Match 2 (tokens)", "Context 3 (tokens)"],
            ["1"     ,"doc1"     , ""                  , "abc"             , ""                  , ""                , ""                  ],
            ["2"     ,"doc1"     , "111 (...) 222"     , "def"             , "333 (...) 444"     , ""                , ""                  ],
            ["3"     ,"doc2"     , ""                  , "ghi"             , ""                  , "jkl"             , ""                  ],
            ["4"     ,"doc2"     ,"555 (...) 666"      , "mno"             , "777 (...) 888"     , "pqr"             , "999 (...) 000"     ],
        ]
    }

    #[derive(Default)]
    struct TestTableWriter(Vec<Vec<String>>);

    impl TestTableWriter {
        fn into_records(self) -> Vec<Vec<String>> {
            self.0
        }
    }

    impl TableWriter for TestTableWriter {
        fn write_record<I>(&mut self, record: I) -> Result<(), AnnimateError>
        where
            I: IntoIterator<Item: AsRef<str>>,
        {
            self.0
                .push(record.into_iter().map(|s| s.as_ref().into()).collect());

            Ok(())
        }
    }
}
