pub(crate) struct CorpusRef<'a, S> {
    pub(crate) storage: &'a graphannis::CorpusStorage,
    pub(crate) names: &'a [S],
}

impl<S> Copy for CorpusRef<'_, S> {}

impl<S> Clone for CorpusRef<'_, S> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<'a, S> CorpusRef<'a, S> {
    pub(crate) fn new(storage: &'a graphannis::CorpusStorage, names: &'a [S]) -> Self {
        Self { storage, names }
    }
}
