use super::Exporter;
use crate::{
    error::AnnisExportError,
    query::{Match, MatchPart},
};
use std::{io::Write, vec};

#[derive(Debug)]
pub(super) struct CsvExporter;

impl Exporter for CsvExporter {
    fn export<F, I, W>(matches: I, out: W, mut on_progress: F) -> Result<(), AnnisExportError>
    where
        F: FnMut(f32),
        I: IntoIterator<Item = Result<Match, AnnisExportError>> + Clone,
        I::IntoIter: ExactSizeIterator,
        W: Write,
    {
        let max_match_parts = {
            let matches = matches.clone().into_iter();
            let count = matches.len();

            let mut max_match_parts = 0;
            for (i, m) in matches.into_iter().enumerate() {
                let match_parts = m?.parts.into_iter().filter(|p| p.is_match()).count();
                if match_parts > max_match_parts {
                    max_match_parts = match_parts;
                }
                on_progress(0.5 * (i + 1) as f32 / count as f32)
            }
            max_match_parts
        };

        let mut csv_writer = csv::Writer::from_writer(out);

        csv_writer.write_record(["Number".into(), "Document".into()].into_iter().chain({
            let n = max_match_parts;
            (0..=2 * n).map(move |k| match (n, k % 2, k / 2) {
                (0, 0, 0) => "Context".into(),
                (1, 0, 0) => "Left context".into(),
                (1, 0, 1) => "Right context".into(),
                (1, 1, 0) => "Match".into(),
                (_, 0, i) => format!("Context {}", i + 1),
                (_, _, i) => format!("Match {}", i + 1),
            })
        }))?;

        let matches = matches.into_iter();
        let count = matches.len();

        for (i, m) in matches.enumerate() {
            let Match { doc_name, parts } = m?;

            csv_writer.write_record(
                [(i + 1).to_string(), doc_name]
                    .into_iter()
                    .chain(TextColumns::new(parts)),
            )?;

            on_progress(0.5 + 0.5 * (i + 1) as f32 / count as f32)
        }

        Ok(())
    }
}

#[derive(Debug)]
struct TextColumns {
    parts: vec::IntoIter<MatchPart>,
    pending_column: Option<Option<String>>,
}

impl TextColumns {
    fn new(parts: Vec<MatchPart>) -> Self {
        Self {
            parts: parts.into_iter(),
            pending_column: None,
        }
    }
}

impl Iterator for TextColumns {
    type Item = String;

    fn next(&mut self) -> Option<String> {
        if let Some(s) = self.pending_column.take() {
            return s;
        }

        let mut context = String::new();

        loop {
            match self.parts.next().map(Into::into) {
                Some(SerializedPart::Context(s)) => {
                    if context.is_empty() {
                        context = s;
                    } else {
                        context.push(' ');
                        context.push_str(&s);
                    }
                }
                part => {
                    self.pending_column = Some(part.map(SerializedPart::into_inner));
                    return Some(context);
                }
            }
        }
    }
}

#[derive(Debug)]
enum SerializedPart {
    Match(String),
    Context(String),
}

impl SerializedPart {
    fn into_inner(self) -> String {
        match self {
            SerializedPart::Match(s) => s,
            SerializedPart::Context(s) => s,
        }
    }
}

impl From<MatchPart> for SerializedPart {
    fn from(part: MatchPart) -> Self {
        match part {
            MatchPart::Match { fragments, .. } => SerializedPart::Match(fragments.join(" ")),
            MatchPart::Context { fragments, .. } => SerializedPart::Context(fragments.join(" ")),
            MatchPart::Gap => SerializedPart::Context("...".into()),
        }
    }
}

impl From<csv::Error> for AnnisExportError {
    fn from(err: csv::Error) -> Self {
        AnnisExportError::Io(err.into())
    }
}

#[cfg(test)]
mod tests {
    use std::array;

    use super::*;

    macro_rules! csv_exporter_test {
        ($(
            $name:ident: matches = [
                $({doc_name = $doc_name:expr, parts = [$($part:tt)*]})*
            ] => $expected:expr
        )*) => { $(
            #[test]
            fn $name() {
                let mut result = Vec::new();

                CsvExporter::export(
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

        (@expand_part (C $($t:expr)*)) => { MatchPart::Context {fragments: vec![$($t.into()),*] } };
        (@expand_part (M $($t:expr)*)) => { MatchPart::Match { index: 0, fragments: vec![$($t.into()),*] } };
        (@expand_part (G)) => { MatchPart::Gap };
    }

    csv_exporter_test! {
        no_match: matches = [] => "
            Number,Document,Context
        "

        no_match_node_without_context: matches = [
            {doc_name = "doc1", parts = []}
        ] => "
            Number,Document,Context
            1,doc1,
        "

        no_match_node_with_context: matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222")]}
        ] => "
            Number,Document,Context
            1,doc1,111 ... 222
        "

        one_match_node_without_context: matches = [
            {doc_name = "doc1", parts = [(M "abc")]}
        ] => "
            Number,Document,Left context,Match,Right context
            1,doc1,,abc,
        "

        one_match_node_with_context: matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]}
        ] => "
            Number,Document,Left context,Match,Right context
            1,doc1,111 ... 222,abc,333 ... 444
        "

        one_match_node_with_context_and_multiple_fragments: matches = [
            {doc_name = "doc1", parts = [(C "111" "222") (G) (C "333" "444") (M "abc" "def") (C "555" "666") (G) (C "777" "888")]}
        ] => "
            Number,Document,Left context,Match,Right context
            1,doc1,111 222 ... 333 444,abc def,555 666 ... 777 888
        "

        two_match_nodes_without_context: matches = [
            {doc_name = "doc1", parts = [(M "abc") (M "def")]}
        ] => "
            Number,Document,Context 1,Match 1,Context 2,Match 2,Context 3
            1,doc1,,abc,,def,
        "

        two_match_nodes_with_context: matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]}
        ] => "
            Number,Document,Context 1,Match 1,Context 2,Match 2,Context 3
            1,doc1,111 ... 222,abc,333 ... 444,def,555 ... 666
        "

        many_match_nodes_without_context: matches = [
            {doc_name = "doc1", parts = [(M "abc") (M "def") (M "ghi")]}
        ] => "
            Number,Document,Context 1,Match 1,Context 2,Match 2,Context 3,Match 3,Context 4
            1,doc1,,abc,,def,,ghi,
        "

        many_match_nodes_with_context: matches = [
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666") (M "ghi") (C "777") (G) (C "888")]}
        ] => "
            Number,Document,Context 1,Match 1,Context 2,Match 2,Context 3,Match 3,Context 4
            1,doc1,111 ... 222,abc,333 ... 444,def,555 ... 666,ghi,777 ... 888
        "

        multiple_matches: matches = [
            {doc_name = "doc1", parts = [(M "abc")]}
            {doc_name = "doc1", parts = [(C "111") (G) (C "222") (M "def")]}
            {doc_name = "doc2", parts = [(M "ghi") (C "333") (G) (C "444")]}
            {doc_name = "doc2", parts = [(C "555") (G) (C "666") (M "jkl") (C "777") (G) (C "888")]}
        ] => "
            Number,Document,Left context,Match,Right context
            1,doc1,,abc,
            2,doc1,111 ... 222,def,
            3,doc2,,ghi,333 ... 444
            4,doc2,555 ... 666,jkl,777 ... 888
        "
    }

    struct TestMatches<const N: usize>([Match; N]);

    impl<const N: usize> IntoIterator for TestMatches<N> {
        type Item = Result<Match, AnnisExportError>;
        type IntoIter = array::IntoIter<Self::Item, N>;

        fn into_iter(self) -> Self::IntoIter {
            self.0.map(Ok).into_iter()
        }
    }

    impl<const N: usize> Clone for TestMatches<N> {
        fn clone(&self) -> Self {
            Self(array::from_fn(|i| {
                let m = &self.0[i];
                Match {
                    doc_name: m.doc_name.clone(),
                    parts: m
                        .parts
                        .iter()
                        .map(|part| match part {
                            MatchPart::Match { index, fragments } => MatchPart::Match {
                                index: *index,
                                fragments: fragments.clone(),
                            },
                            MatchPart::Context { fragments } => MatchPart::Context {
                                fragments: fragments.clone(),
                            },
                            MatchPart::Gap => MatchPart::Gap,
                        })
                        .collect(),
                }
            }))
        }
    }
}
