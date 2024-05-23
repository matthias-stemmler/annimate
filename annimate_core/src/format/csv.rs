//! The CSV export format.

use std::collections::{BTreeSet, HashMap};
use std::io::Write;
use std::ops::Range;
use std::vec;

use itertools::{put_back, Itertools, PutBack};

use super::Exporter;
use crate::anno::{is_doc_anno_key, AnnoKeyFormat};
use crate::error::{cancel_if, AnnimateError};
use crate::query::{ExportData, ExportDataAnno, ExportDataText, Match, TextPart};
use crate::QueryNode;

/// A type of column (match/context).
#[derive(Clone, Copy, Debug)]
enum ColumnType {
    /// Match column.
    Match,

    /// Context column.
    Context,
}

use ColumnType::*;

/// Implementation of [Exporter] for the CSV format.
#[derive(Debug)]
pub(super) struct CsvExporter;

/// Configuration of an export in the CSV format.
#[derive(Debug)]
pub struct CsvExportConfig {
    /// Columns to export.
    pub columns: Vec<CsvExportColumn>,
}

/// Configuration of what to export in a single CSV column.
#[derive(Clone, Debug)]
pub enum CsvExportColumn {
    /// Number of the match, numbered sequentially starting from 1.
    Number,

    /// Data of the match.
    Data(ExportData),
}

impl CsvExportColumn {
    /// Returns the [`ExportData`] for this column, if any.
    fn unwrap_data(&self) -> Option<&ExportData> {
        match self {
            CsvExportColumn::Data(data) => Some(data),
            _ => None,
        }
    }
}

impl Exporter for CsvExporter {
    type Config = CsvExportConfig;

    fn get_export_data(config: &CsvExportConfig) -> impl Iterator<Item = &ExportData> {
        config
            .columns
            .iter()
            .filter_map(CsvExportColumn::unwrap_data)
    }

    fn export<F, G, I, W>(
        config: &CsvExportConfig,
        matches: I,
        query_nodes: &[Vec<QueryNode>],
        anno_key_format: &AnnoKeyFormat,
        out: W,
        mut on_progress: F,
        cancel_requested: G,
    ) -> Result<(), AnnimateError>
    where
        F: FnMut(f32),
        G: Fn() -> bool,
        I: IntoIterator<Item = Result<Match, AnnimateError>> + Clone,
        I::IntoIter: ExactSizeIterator,
        W: Write,
    {
        let matches_iter = matches.into_iter();
        let count = matches_iter.len();
        let mut matches = Vec::with_capacity(count);

        let max_match_parts_by_text = {
            let mut max_match_parts_by_text = HashMap::new();

            for (i, m) in matches_iter.enumerate() {
                cancel_if(&cancel_requested)?;

                let m = m?;

                for (text, parts) in &m.texts {
                    let match_parts = parts.iter().filter(|p| p.is_match()).count();
                    let max_match_parts = max_match_parts_by_text.entry(text.clone()).or_insert(0);
                    if match_parts > *max_match_parts {
                        *max_match_parts = match_parts;
                    }
                }

                matches.push(m);
                on_progress((i + 1) as f32 / count as f32);
            }

            max_match_parts_by_text
        };

        let mut csv_writer = csv::Writer::from_writer(out);

        cancel_if(&cancel_requested)?;

        csv_writer.write_record(config.columns.iter().flat_map(|c| match c {
            CsvExportColumn::Number => vec!["Number".into()],
            CsvExportColumn::Data(ExportData::Anno(ExportDataAnno::Corpus { anno_key })) => {
                vec![format!("Corpus {}", anno_key_format.display(anno_key))]
            }
            CsvExportColumn::Data(ExportData::Anno(ExportDataAnno::Document { anno_key })) => {
                if is_doc_anno_key(anno_key) {
                    vec!["Document".into()]
                } else {
                    vec![format!("Document {}", anno_key_format.display(anno_key))]
                }
            }
            CsvExportColumn::Data(ExportData::Anno(ExportDataAnno::MatchNode {
                anno_key,
                index,
            })) => {
                vec![format!(
                    "{} {}",
                    query_nodes
                        .get(*index)
                        .expect("Query node index is assumed to be valid")
                        .iter()
                        .map(|n| &n.variable)
                        .collect::<BTreeSet<_>>()
                        .into_iter()
                        .format_with("|", |elt, f| f(&format_args!("#{elt}"))),
                    anno_key_format.display(anno_key)
                )]
            }
            CsvExportColumn::Data(ExportData::Text(text)) => {
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
            cancel_if(&cancel_requested)?;

            csv_writer.write_record(config.columns.iter().flat_map(|c| match c {
                CsvExportColumn::Number => vec![(i + 1).to_string()],
                CsvExportColumn::Data(ExportData::Anno(anno)) => {
                    vec![annos
                        .get(anno)
                        .map(|s| s.trim().to_string())
                        .unwrap_or_default()]
                }
                CsvExportColumn::Data(ExportData::Text(text)) => {
                    let max_match_parts = *max_match_parts_by_text.get(text).unwrap();
                    let parts = texts.get(text).unwrap().clone();
                    let column_types = ColumnTypes::new(max_match_parts, query_nodes.len(), text);
                    TextColumnsAligned::new(parts, column_types).collect()
                }
            }))?;
        }

        Ok(())
    }
}

/// Iterator over strings that aligns [`TextPart`]s to [`ColumnTypes`].
#[derive(Debug)]
struct TextColumnsAligned {
    text_columns: PutBack<TextColumns>,
    column_types: ColumnTypesIter,
}

impl TextColumnsAligned {
    /// Creates a new [`TextColumnsAligned`] for the given [`TextPart`]s and [`ColumnTypes`].
    fn new(parts: Vec<TextPart>, column_types: ColumnTypes) -> Self {
        Self {
            text_columns: put_back(TextColumns::new(parts)),
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

/// Iterator over columns for given [`TextPart`]s.
///
/// This is an iterator over pairs of [`ColumnType`] and [`String`].
#[derive(Debug)]
struct TextColumns {
    parts: vec::IntoIter<TextPart>,
    pending_column: Option<(ColumnType, String)>,
}

impl TextColumns {
    /// Creates [`TextColumns`] for the given [`TextPart`]s.
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
                Some(TextPart::Match { fragments, .. }) => break Some(fragments.join(" ")),
                Some(TextPart::Context { fragments }) => fragments.join(" "),
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

/// Holds information about match/context column types.
///
/// This can be turned into an iterator over pairs of [`ColumnType`] and [`usize`], telling whether
/// the respective column is a match or context column and its index among all match resp. context
/// columns.
#[derive(Clone, Copy, Debug)]
struct ColumnTypes {
    /// Number of columns
    column_count: usize,

    /// Whether there is at least one match
    has_match: bool,

    /// Whether there can be any left context (depending only on configuration, not on the actual
    /// matches)
    has_left_context: bool,

    /// Whether there can be any right context (depending only on configuration, not on the actual
    /// matches)
    has_right_context: bool,
}

impl ColumnTypes {
    /// Creates new [`ColumnTypes`] for the given number of matches, number of query nodes and
    /// export data.
    fn new(match_count: usize, query_node_count: usize, data: &ExportDataText) -> Self {
        let has_match = match_count > 0;
        let has_secondary_nodes = match &data.primary_node_indices {
            Some(indices) => (0..query_node_count).any(|i| !indices.contains(&i)),
            None => false,
        };
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

/// Iterator that [`ColumnTypes`] can be turned into.
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

impl From<csv::Error> for AnnimateError {
    fn from(err: csv::Error) -> Self {
        AnnimateError::Io(err.into())
    }
}

#[cfg(test)]
mod tests {
    use std::array;

    use graphannis_core::graph::ANNIS_NS;
    use graphannis_core::types::AnnoKey;

    use super::*;

    macro_rules! csv_exporter_test {
        ($(
            $name:ident: context = ($left_context:expr, $right_context:expr), matches = [
                $({doc_name = $doc_name:expr, parts = [$($part:tt)*]})*
            ] => $expected:expr
        )*) => { $(
            #[test]
            fn $name() {
                let mut result = Vec::new();

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

                CsvExporter::export(
                    &CsvExportConfig {
                        columns: vec![
                            CsvExportColumn::Number,
                            CsvExportColumn::Data(ExportData::Anno(export_data_anno_doc.clone())),
                            CsvExportColumn::Data(ExportData::Text(text.clone())),
                        ],
                    },
                    TestMatches([
                        $(Match {
                            annos: [(export_data_anno_doc.clone(), $doc_name.into())].into(),
                            texts: [(text.clone(), [ $(csv_exporter_test!(@expand_part $part)),* ].into())].into(),
                        }),*
                    ]),
                    &[vec![]],
                    &AnnoKeyFormat::new([]),
                    &mut result,
                    |_| (),
                    || false,
                ).unwrap();

                assert_eq!(
                    String::from_utf8(result).unwrap(),
                    indoc::indoc!($expected),
                );
            }
        )* };

        (@expand_part (C $($t:expr)*)) => { TextPart::Context { fragments: vec![$($t.into()),*] } };
        (@expand_part (M $($t:expr)*)) => { TextPart::Match { index: 0, fragments: vec![$($t.into()),*] } };
        (@expand_part (G)) => { TextPart::Gap };
    }

    csv_exporter_test! {
        no_match_no_context: context=(0, 0), matches = [] => "
            Number,Document
        "

        no_match_only_left_context: context=(1, 0), matches = [] => "
            Number,Document,Context (tokens)
        "

        no_match_only_right_context: context=(0, 1), matches = [] => "
            Number,Document,Context (tokens)
        "

        no_match_both_contexts: context=(1, 1), matches = [] => "
            Number,Document,Context (tokens)
        "

        no_match_node_both_contexts_no_parts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = []}
        ] => "
            Number,Document,Context (tokens)
            1,doc1,
        "

        no_match_node_both_contexts_some_parts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222")]}
        ] => "
            Number,Document,Context (tokens)
            1,doc1,111 (...) 222
        "

        one_match_node_no_context: context=(0, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Match (tokens)
            1,doc1,abc
        "

        one_match_node_left_context: context=(1, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Left context (tokens),Match (tokens)
            1,doc1,111 (...) 222,abc
        "

        one_match_node_right_context: context=(0, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Match (tokens),Right context (tokens)
            1,doc1,abc,333 (...) 444
        "

        one_match_node_both_contexts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Left context (tokens),Match (tokens),Right context (tokens)
            1,doc1,111 (...) 222,abc,333 (...) 444
        "

        one_match_node_multiple_fragments: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111" "222") (G) (C "333" "444") (M "abc" "def") (C "555" "666") (G) (C "777" "888")]}
        ] => "
            Number,Document,Left context (tokens),Match (tokens),Right context (tokens)
            1,doc1,111 222 (...) 333 444,abc def,555 666 (...) 777 888
        "

        multiple_match_nodes_no_context: context=(0, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Match 1 (tokens),Match 2 (tokens)
            1,doc1,abc,def
        "

        multiple_match_nodes_left_context: context=(1, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Context 1 (tokens),Match 1 (tokens),Context 2 (tokens),Match 2 (tokens)
            1,doc1,111 (...) 222,abc,333 (...) 444,def
        "

        multiple_match_nodes_right_context: context=(0, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Match 1 (tokens),Context 1 (tokens),Match 2 (tokens),Context 2 (tokens)
            1,doc1,abc,333 (...) 444,def,555 (...) 666
        "

        multiple_match_nodes_both_contexts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Context 1 (tokens),Match 1 (tokens),Context 2 (tokens),Match 2 (tokens),Context 3 (tokens)
            1,doc1,111 (...) 222,abc,333 (...) 444,def,555 (...) 666
        "

        multiple_matches_same_number_of_match_nodes: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(M "abc")]}
            {doc_name = "doc2", parts = [(C "111") (G) (C "222") (M "def") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Left context (tokens),Match (tokens),Right context (tokens)
            1,doc1,,abc,
            2,doc2,111 (...) 222,def,333 (...) 444
        "

        multiple_matches_different_number_of_match_nodes: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(M "abc")]}
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "def") (C "333") (G) (C "444")]}
            {doc_name = "doc2", parts = [(M "ghi") (M "jkl")]}
            {doc_name = "doc2", parts = [(C "555") (G) (C "666") (M "mno") (C "777") (G) (C "888") (M "pqr") (C "999") (G) (C "000")]}
        ] => "
            Number,Document,Context 1 (tokens),Match 1 (tokens),Context 2 (tokens),Match 2 (tokens),Context 3 (tokens)
            1,doc1,,abc,,,
            2,doc1,111 (...) 222,def,333 (...) 444,,
            3,doc2,,ghi,,jkl,
            4,doc2,555 (...) 666,mno,777 (...) 888,pqr,999 (...) 000
        "
    }

    #[derive(Debug, Clone)]
    struct TestMatches<const N: usize>([Match; N]);

    impl<const N: usize> IntoIterator for TestMatches<N> {
        type Item = Result<Match, AnnimateError>;
        type IntoIter = array::IntoIter<Self::Item, N>;

        fn into_iter(self) -> Self::IntoIter {
            self.0.map(Ok).into_iter()
        }
    }
}
