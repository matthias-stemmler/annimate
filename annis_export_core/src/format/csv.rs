use super::Exporter;
use crate::{
    error::AnnisExportError,
    query::{Match, MatchPart},
};
use graphannis::{corpusstorage::QueryAttributeDescription, errors::GraphAnnisError};
use std::{io::Write, iter, vec};

// TODO add metadata, see https://docs.rs/graphannis/latest/src/graphannis/annis/db/corpusstorage.rs.html#1521-1570

#[derive(Debug)]
pub(super) struct CsvExporter;

impl Exporter for CsvExporter {
    fn export<I, W>(
        matches: I,
        node_descriptions: Vec<QueryAttributeDescription>,
        out: W,
    ) -> Result<(), AnnisExportError>
    where
        I: IntoIterator<Item = Result<Match, GraphAnnisError>>,
        W: Write,
    {
        let mut csv_writer = csv::Writer::from_writer(out);

        csv_writer.write_record(iter::once("Number".into()).chain({
            let n = node_descriptions.len();
            (0..=2 * n).map(move |k| match (n, k % 2, k / 2) {
                (0, 0, 0) => "Context".into(),
                (1, 0, 0) => "Left context".into(),
                (1, 0, 1) => "Right context".into(),
                (1, 1, 0) => "Match".into(),
                (2, 0, 0) => "Left context".into(),
                (2, 0, 1) => "Middle context".into(),
                (2, 0, 2) => "Right context".into(),
                (_, 0, i) => format!("Context {}", i + 1),
                (_, _, i) => format!("Match {}", i + 1),
            })
        }))?;

        for (i, m) in matches.into_iter().enumerate() {
            csv_writer
                .write_record(iter::once((i + 1).to_string()).chain(TokenColumns::new(m?)))?;
        }

        Ok(())
    }
}

#[derive(Debug)]
struct TokenColumns {
    parts: vec::IntoIter<MatchPart>,
    pending_column: Option<Option<String>>,
}

impl TokenColumns {
    fn new(m: Match) -> Self {
        Self {
            parts: m.parts.into_iter(),
            pending_column: None,
        }
    }
}

impl Iterator for TokenColumns {
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
            MatchPart::MatchToken(token) => SerializedPart::Match(token),
            MatchPart::ContextToken(token) => SerializedPart::Context(token),
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
    use super::*;

    macro_rules! csv_exporter_test {
        ($($name:ident: match_token_count=$match_token_count:expr, matches = [$([$($part:tt)*])*] => $expected:expr)*) => {
            $(
                #[test]
                fn $name() {
                    let mut result = Vec::new();

                    CsvExporter::export(
                        [
                            $(Ok(Match::from_parts([
                                $(csv_exporter_test!(@expand_part $part)),*
                            ].into_iter().collect()))),*
                        ],
                        (0..$match_token_count).map(|_| QueryAttributeDescription {
                            alternative: 0,
                            query_fragment: "".into(),
                            variable: "".into(),
                            anno_name: None,
                            optional: false,
                        }).collect(),
                        &mut result,
                    ).unwrap();

                    assert_eq!(
                        String::from_utf8(result).unwrap(),
                        indoc::indoc!($expected),
                    );
                }
            )*
        };

        (@expand_part (C $t:expr)) => { MatchPart::ContextToken($t.into()) };
        (@expand_part (M $t:expr)) => { MatchPart::MatchToken($t.into()) };
        (@expand_part (G)) => { MatchPart::Gap };
    }

    csv_exporter_test! {
        no_match: match_token_count = 1, matches = [] => "
            Number,Left context,Match,Right context
        "

        no_match_token_without_context: match_token_count = 0, matches = [
            []
        ] => "
            Number,Context
            1,
        "

        no_match_token_with_context: match_token_count = 0, matches = [
            [(C "111") (G) (C "222")]
        ] => "
            Number,Context
            1,111 ... 222
        "

        one_match_token_without_context: match_token_count = 1, matches = [
            [(M "abc")]
        ] => "
            Number,Left context,Match,Right context
            1,,abc,
        "

        one_match_token_with_context: match_token_count = 1, matches = [
            [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444")]
        ] => "
            Number,Left context,Match,Right context
            1,111 ... 222,abc,333 ... 444
        "

        two_match_tokens_without_context: match_token_count = 2, matches = [
            [(M "abc") (M "def")]
        ] => "
            Number,Left context,Match 1,Middle context,Match 2,Right context
            1,,abc,,def,
        "

        two_match_tokens_with_context: match_token_count = 2, matches = [
            [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666")]
        ] => "
            Number,Left context,Match 1,Middle context,Match 2,Right context
            1,111 ... 222,abc,333 ... 444,def,555 ... 666
        "

        many_match_tokens_without_context: match_token_count = 3, matches = [
            [(M "abc") (M "def") (M "ghi")]
        ] => "
            Number,Context 1,Match 1,Context 2,Match 2,Context 3,Match 3,Context 4
            1,,abc,,def,,ghi,
        "

        many_match_tokens_with_context: match_token_count = 3, matches = [
            [(C "111") (G) (C "222") (M "abc") (C "333") (G) (C "444") (M "def") (C "555") (G) (C "666") (M "ghi") (C "777") (G) (C "888")]
        ] => "
            Number,Context 1,Match 1,Context 2,Match 2,Context 3,Match 3,Context 4
            1,111 ... 222,abc,333 ... 444,def,555 ... 666,ghi,777 ... 888
        "

        multiple_matches: match_token_count = 1, matches = [
            [(M "abc")]
            [(C "111") (G) (C "222") (M "def")]
            [(M "ghi") (C "333") (G) (C "444")]
            [(C "555") (G) (C "666") (M "jkl") (C "777") (G) (C "888")]
        ] => "
            Number,Left context,Match,Right context
            1,,abc,
            2,111 ... 222,def,
            3,,ghi,333 ... 444
            4,555 ... 666,jkl,777 ... 888
        "
    }
}
