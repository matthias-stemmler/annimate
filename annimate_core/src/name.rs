use std::borrow::Cow;
use std::path::{Path, PathBuf};

use graphannis::AnnotationGraph;
use graphannis::errors::GraphAnnisError;
use graphannis_core::types::NodeID;
use percent_encoding::{AsciiSet, CONTROLS};

use crate::AnnimateError;

pub(crate) fn get_corpus_path(db_dir: &Path, corpus_name: &str) -> PathBuf {
    db_dir.join::<&str>(
        Cow::from(percent_encoding::utf8_percent_encode(
            corpus_name,
            PATH_ENCODE_SET,
        ))
        .as_ref(),
    )
}

/// Returns the name of the corpus node (root node) for a given node name.
///
/// This turns
/// ```plain
/// corpus/doc#node
/// ```
/// into
/// ```plain
/// corpus
/// ```
///
/// Note that the corpus node name is URL-encoded when it occurs as part of another node name,
/// but *not* as the name of the corpus root node itself.
pub(crate) fn get_corpus_node_name(node_name: &str) -> Result<Cow<'_, str>, AnnimateError> {
    match node_name.split_once('/') {
        Some((encoded, _)) => percent_encoding::percent_decode_str(encoded)
            .decode_utf8()
            .map_err(|_| AnnimateError::CorpusNodeNameDecodesToInvalidUtf8(encoded.into())),
        None => Ok(node_name.into()),
    }
}

/// Returns the name of the document node for a given node name.
///
/// This turns
/// ```plain
/// corpus/doc#node
/// ```
/// into
/// ```plain
/// corpus/doc
/// ```
///
/// Note that document node names are URL-encoded both when they occur as part of another node name
/// and as a document node name itself.
pub(crate) fn get_doc_node_name(node_name: &str) -> &str {
    match node_name.rsplit_once('#') {
        Some((doc_node_name, _)) => doc_node_name,
        None => node_name,
    }
}

pub(crate) fn node_name_to_node_id(
    graph: &AnnotationGraph,
    node_name: &str,
) -> Result<NodeID, GraphAnnisError> {
    graph
        .get_node_annos()
        .get_node_id_from_name(node_name)
        .map_err(GraphAnnisError::from)
        .and_then(|node_id| node_id.ok_or_else(|| GraphAnnisError::NoSuchNodeID(node_name.into())))
}

// From https://github.com/korpling/graphANNIS/blob/2c656d5c79e15b7c29809132c467681fa473464f/graphannis/src/annis/db/corpusstorage.rs#L301
const PATH_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'<')
    .add(b'>')
    .add(b'`')
    .add(b'?')
    .add(b'{')
    .add(b'}')
    .add(b'%')
    .add(b'/')
    .add(b':')
    .add(b'"')
    .add(b'|')
    .add(b'*')
    .add(b'\\');

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_corpus_path_no_special_characters() {
        assert_eq!(
            get_corpus_path(Path::new("data"), "corpus"),
            Path::new("data/corpus")
        );
    }

    #[test]
    fn get_corpus_path_special_characters() {
        assert_eq!(
            get_corpus_path(Path::new("data"), "cörpüs"),
            Path::new("data/c%C3%B6rp%C3%BCs")
        );
    }

    #[test]
    fn get_corpus_node_name_no_slash() {
        assert_eq!(get_corpus_node_name("corpus").unwrap(), "corpus");
    }

    #[test]
    fn get_corpus_node_name_single_slash() {
        assert_eq!(get_corpus_node_name("corpus/doc#node").unwrap(), "corpus");
    }

    #[test]
    fn get_corpus_node_name_multiple_slashes() {
        assert_eq!(
            get_corpus_node_name("corpus/subcorpus/doc#node").unwrap(),
            "corpus"
        );
    }

    #[test]
    fn get_corpus_node_name_encoded_no_slash() {
        assert_eq!(
            get_corpus_node_name("c%C3%B6rp%C3%BCs").unwrap(),
            "c%C3%B6rp%C3%BCs"
        );
    }

    #[test]
    fn get_corpus_node_name_encoded_slash() {
        assert_eq!(
            get_corpus_node_name("c%C3%B6rp%C3%BCs/doc#node").unwrap(),
            "cörpüs"
        );
    }

    #[test]
    fn get_doc_node_name_no_hash() {
        assert_eq!(get_doc_node_name("corpus/doc"), "corpus/doc");
    }

    #[test]
    fn get_doc_node_name_single_hash() {
        assert_eq!(get_doc_node_name("corpus/doc#node"), "corpus/doc");
    }

    #[test]
    fn get_doc_node_name_multiple_hashes() {
        assert_eq!(
            get_doc_node_name("corpus/doc#node#subnode"),
            "corpus/doc#node"
        );
    }

    #[test]
    fn get_doc_node_name_encoded() {
        assert_eq!(
            get_doc_node_name("c%C3%B6rp%C3%BCs/d%C3%B6c"),
            "c%C3%B6rp%C3%BCs/d%C3%B6c"
        );
    }
}
