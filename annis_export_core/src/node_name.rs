use graphannis::{errors::GraphAnnisError, AnnotationGraph};
use graphannis_core::types::NodeID;

pub(crate) fn get_corpus_name(node_name: &str) -> &str {
    match node_name.split_once('/') {
        Some((corpus_name, _)) => corpus_name,
        None => node_name,
    }
}

pub(crate) fn get_doc_name(node_name: &str) -> &str {
    match node_name.rsplit_once('#') {
        Some((doc_name, _)) => doc_name,
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
        .and_then(|node_id| node_id.ok_or(GraphAnnisError::NoSuchNodeID(node_name.into())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_corpus_name_no_slash() {
        assert_eq!(get_corpus_name("corpus"), "corpus");
    }

    #[test]
    fn get_corpus_name_single_slash() {
        assert_eq!(get_corpus_name("corpus/doc#node"), "corpus");
    }

    #[test]
    fn get_corpus_name_multiple_slashes() {
        assert_eq!(get_corpus_name("corpus/subcorpus/doc#node"), "corpus");
    }

    #[test]
    fn get_doc_name_no_hash() {
        assert_eq!(get_doc_name("corpus/doc"), "corpus/doc");
    }

    #[test]
    fn get_doc_name_single_hash() {
        assert_eq!(get_doc_name("corpus/doc#node"), "corpus/doc");
    }

    #[test]
    fn get_doc_name_multiple_hashes() {
        assert_eq!(get_doc_name("corpus/doc#node#subnode"), "corpus/doc#node");
    }
}
