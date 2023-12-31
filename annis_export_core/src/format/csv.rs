use super::Exporter;
use crate::{
    error::AnnisExportError,
    query::{Match, MatchPart, Query},
};
use std::{io::Write, iter::Peekable, ops::Range, vec};

#[derive(Debug)]
pub(super) struct CsvExporter;

impl Exporter for CsvExporter {
    fn export<F, I, W>(
        query: Query,
        matches: I,
        out: W,
        mut on_progress: F,
    ) -> Result<(), AnnisExportError>
    where
        F: FnMut(f32),
        I: IntoIterator<Item = Result<Match, AnnisExportError>> + Clone,
        I::IntoIter: ExactSizeIterator,
        W: Write,
    {
        let max_match_part_count = {
            let matches = matches.clone().into_iter();
            let count = matches.len();

            let mut max_match_part_count = 0;
            for (i, m) in matches.into_iter().enumerate() {
                let match_part_count = m?.parts.into_iter().filter(|p| p.is_match()).count();
                if match_part_count > max_match_part_count {
                    max_match_part_count = match_part_count;
                }
                on_progress(0.5 * (i + 1) as f32 / count as f32)
            }
            max_match_part_count
        };

        let has_left_context = query.config.left_context > 0;
        let has_right_context = query.config.right_context > 0;

        let column_types =
            ColumnTypes::new(max_match_part_count, has_left_context, has_right_context);

        let mut csv_writer = csv::Writer::from_writer(out);

        csv_writer.write_record(["Number".into(), "Document".into()].into_iter().chain(
            column_types.into_iter().map(|c| match c {
                (ColumnType::Match, _) if max_match_part_count <= 1 => "Match".into(),
                (ColumnType::Match, i) => format!("Match {}", i + 1),
                (ColumnType::Context, 0) if max_match_part_count <= 1 && has_left_context => {
                    "Left context".into()
                }
                (ColumnType::Context, _) if max_match_part_count <= 1 => "Right context".into(),
                (ColumnType::Context, i) => format!("Context {}", i + 1),
            }),
        ))?;

        let matches = matches.into_iter();
        let count = matches.len();

        for (i, m) in matches.enumerate() {
            let Match { doc_name, parts } = m?;

            csv_writer.write_record(
                [(i + 1).to_string(), doc_name]
                    .into_iter()
                    .chain(TextColumnsAligned::new(parts, column_types)),
            )?;

            on_progress(0.5 + 0.5 * (i + 1) as f32 / count as f32)
        }

        Ok(())
    }
}

#[derive(Debug)]
struct TextColumnsAligned {
    text_columns: Peekable<TextColumns>,
    column_types: ColumnTypesIter,
}

impl TextColumnsAligned {
    fn new(parts: Vec<MatchPart>, column_types: ColumnTypes) -> Self {
        Self {
            text_columns: TextColumns::new(parts).peekable(),
            column_types: column_types.into_iter(),
        }
    }
}

impl Iterator for TextColumnsAligned {
    type Item = String;

    fn next(&mut self) -> Option<Self::Item> {
        use ColumnType::*;

        let (column_type, _) = self.column_types.next()?;

        loop {
            match (column_type, self.text_columns.peek().map(|(c, _)| *c)) {
                (Match, Some(Match)) | (Context, Some(Context)) => {
                    return self.text_columns.next().map(|(_, f)| f);
                }
                (_, None) | (Context, Some(Match)) => return Some("".into()),
                (Match, Some(Context)) => {
                    self.text_columns.next();
                }
            }
        }
    }
}

#[derive(Debug)]
struct TextColumns {
    parts: Peekable<vec::IntoIter<MatchPart>>,
}

impl TextColumns {
    fn new(parts: Vec<MatchPart>) -> Self {
        Self {
            parts: parts.into_iter().peekable(),
        }
    }
}

impl Iterator for TextColumns {
    type Item = (ColumnType, String);

    fn next(&mut self) -> Option<(ColumnType, String)> {
        let mut context_col: Option<String> = None;

        while self.parts.peek().map(|p| !p.is_match()).unwrap_or(false) {
            let serialized_part = match self.parts.next() {
                Some(MatchPart::Context { fragments }) => fragments.join(" "),
                Some(MatchPart::Gap) => "...".into(),
                // TODO use itertools?
                _ => unreachable!(),
            };

            context_col = Some(match context_col.take() {
                None => serialized_part,
                Some(mut c) => {
                    c.push(' ');
                    c.push_str(&serialized_part);
                    c
                }
            });
        }

        if let Some(context_col) = context_col {
            return Some((ColumnType::Context, context_col));
        }

        let MatchPart::Match { fragments, .. } = self.parts.next()? else {
            unreachable!();
        };

        Some((ColumnType::Match, fragments.join(" ")))
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ColumnType {
    Match,
    Context,
}

#[derive(Clone, Copy, Debug)]
struct ColumnTypes {
    column_count: usize,
    has_left_context: bool,
    has_right_context: bool,
}

impl ColumnTypes {
    fn new(match_count: usize, has_left_context: bool, has_right_context: bool) -> Self {
        let column_count = match (match_count, has_left_context, has_right_context) {
            (0, _, _) => 0,
            (n, false, false) => n,
            (n, true, false) | (n, false, true) => 2 * n,
            (n, true, true) => 2 * n + 1,
        };

        Self {
            column_count,
            has_left_context,
            has_right_context,
        }
    }
}

impl IntoIterator for ColumnTypes {
    type Item = (ColumnType, usize);
    type IntoIter = ColumnTypesIter;

    fn into_iter(self) -> Self::IntoIter {
        ColumnTypesIter {
            column_indices: 0..self.column_count,
            has_left_context: self.has_left_context,
            has_right_context: self.has_right_context,
        }
    }
}

#[derive(Debug)]
struct ColumnTypesIter {
    column_indices: Range<usize>,
    has_left_context: bool,
    has_right_context: bool,
}

impl Iterator for ColumnTypesIter {
    type Item = (ColumnType, usize);

    fn next(&mut self) -> Option<Self::Item> {
        let column_index = self.column_indices.next()?;

        Some(
            match (
                self.has_left_context,
                self.has_right_context,
                column_index % 2,
            ) {
                (false, false, _) => (ColumnType::Match, column_index),
                (false, _, 0) | (true, _, 1) => (ColumnType::Match, column_index / 2),
                _ => (ColumnType::Context, column_index / 2),
            },
        )
    }
}

impl From<csv::Error> for AnnisExportError {
    fn from(err: csv::Error) -> Self {
        AnnisExportError::Io(err.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::array;

    macro_rules! csv_exporter_test {
        ($(
            $name:ident: context = ($left_context:expr, $right_context:expr), matches = [
                $({doc_name = $doc_name:expr, parts = [$($part:tt)*]})*
            ] => $expected:expr
        )*) => { $(
            #[test]
            fn $name() {
                let mut result = Vec::new();

                CsvExporter::export(
                    Query::new("", crate::QueryConfig {
                        left_context: $left_context,
                        right_context: $right_context,
                        ..Default::default()
                    }),
                    TestMatches([
                        $(Match {
                            doc_name: $doc_name.into(),
                            parts: [ $(csv_exporter_test!(@expand_part $part)),* ].into_iter().collect(),
                        }),*
                    ]),
                    &mut result,
                    |_| (),
                ).unwrap();

                assert_eq!(
                    String::from_utf8(result).unwrap(),
                    indoc::indoc!($expected),
                );
            }
        )* };

        (@expand_part (C $($t:expr)*)) => { MatchPart::Context { fragments: vec![$($t.into()),*] } };
        (@expand_part (M $($t:expr)*)) => { MatchPart::Match { index: 0, fragments: vec![$($t.into()),*] } };
        (@expand_part (G)) => { MatchPart::Gap };
    }

    csv_exporter_test! {
        no_match_both_contexts: context=(1, 1), matches = [] => "
            Number,Document
        "

        no_match_node_both_contexts_no_parts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = []}
        ] => "
            Number,Document
            1,doc1
        "

        no_match_node_both_contexts_some_parts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222")]}
        ] => "
            Number,Document
            1,doc1
        "

        one_match_node_no_context: context=(0, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Match
            1,doc1,abc
        "

        one_match_node_left_context: context=(1, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Left context,Match
            1,doc1,111 ... 222,abc
        "

        one_match_node_right_context: context=(0, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Match,Right context
            1,doc1,abc,333 ... 444
        "

        one_match_node_both_contexts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Left context,Match,Right context
            1,doc1,111 ... 222,abc,333 ... 444
        "

        one_match_node_multiple_fragments: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111" "222") (G) (C "333" "444") (M "abc" "def") (C "555" "666") (G) (C "777" "888")]}
        ] => "
            Number,Document,Left context,Match,Right context
            1,doc1,111 222 ... 333 444,abc def,555 666 ... 777 888
        "

        multiple_match_nodes_no_context: context=(0, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Match 1,Match 2
            1,doc1,abc,def
        "

        multiple_match_nodes_left_context: context=(1, 0), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Context 1,Match 1,Context 2,Match 2
            1,doc1,111 ... 222,abc,333 ... 444,def
        "

        multiple_match_nodes_right_context: context=(0, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Match 1,Context 1,Match 2,Context 2
            1,doc1,abc,333 ... 444,def,555 ... 666
        "

        multiple_match_nodes_both_contexts: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Context 1,Match 1,Context 2,Match 2,Context 3
            1,doc1,111 ... 222,abc,333 ... 444,def,555 ... 666
        "

        multiple_matches_same_number_of_match_nodes: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(M "abc")]}
            {doc_name = "doc2", parts = [(C "111") (G) (C "222") (M "def") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Left context,Match,Right context
            1,doc1,,abc,
            2,doc2,111 ... 222,def,333 ... 444
        "

        multiple_matches_different_number_of_match_nodes: context=(1, 1), matches = [
            {doc_name = "doc1", parts = [(M "abc")]}
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "def") (C "333") (G) (C "444")]}
            {doc_name = "doc2", parts = [(M "ghi") (M "jkl")]}
            {doc_name = "doc2", parts = [(C "555") (G) (C "666") (M "mno") (C "777") (G) (C "888") (M "pqr") (C "999") (G) (C "000")]}
        ] => "
            Number,Document,Context 1,Match 1,Context 2,Match 2,Context 3
            1,doc1,,abc,,,
            2,doc1,111 ... 222,def,333 ... 444,,
            3,doc2,,ghi,,jkl,
            4,doc2,555 ... 666,mno,777 ... 888,pqr,999 ... 000
        "
    }

    #[derive(Debug, Clone)]
    struct TestMatches<const N: usize>([Match; N]);

    impl<const N: usize> IntoIterator for TestMatches<N> {
        type Item = Result<Match, AnnisExportError>;
        type IntoIter = array::IntoIter<Self::Item, N>;

        fn into_iter(self) -> Self::IntoIter {
            self.0.map(Ok).into_iter()
        }
    }
}
