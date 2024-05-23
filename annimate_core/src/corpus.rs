//! Dealing with corpora.

/// Reference to a list of corpora in a given storage.
pub(crate) struct CorpusRef<'a, S> {
    /// The [`CorpusStorage`](graphannis::CorpusStorage).
    pub(crate) storage: &'a graphannis::CorpusStorage,

    /// Names of the corpora.
    pub(crate) names: &'a [S],
}

impl<S> Copy for CorpusRef<'_, S> {}

impl<S> Clone for CorpusRef<'_, S> {
    fn clone(&self) -> Self {
        *self
    }
}

impl<'a, S> CorpusRef<'a, S> {
    /// Creates a new [`CorpusRef`] from the given [`CorpusStorage`](graphannis::CorpusStorage) and
    /// corpus names.
    pub(crate) fn new(storage: &'a graphannis::CorpusStorage, names: &'a [S]) -> Self {
        Self { storage, names }
    }
}
