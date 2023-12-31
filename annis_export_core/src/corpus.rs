#[derive(Clone, Copy)]
pub(crate) struct CorpusRef<'a> {
    pub(crate) storage: &'a graphannis::CorpusStorage,
    pub(crate) name: &'a str,
}

impl<'a> CorpusRef<'a> {
    pub(crate) fn new(storage: &'a graphannis::CorpusStorage, name: &'a str) -> Self {
        Self { storage, name }
    }
}
