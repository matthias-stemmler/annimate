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
