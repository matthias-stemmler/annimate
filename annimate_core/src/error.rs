use std::fmt::{self, Display, Formatter};
use std::io;
use std::path::PathBuf;

use graphannis::errors::GraphAnnisError;
use graphannis_core::errors::GraphAnnisCoreError;
use thiserror::Error;
use zip::result::ZipError;

/// Error during an operation provided by Annimate.
#[derive(Debug, Error)]
pub enum AnnimateError {
    #[error("Cancelled")]
    Cancelled,

    #[error("Corpus name decodes to invalid UTF-8: {0}")]
    CorpusNameDecodesToInvalidUtf8(String),

    #[error("Corpus set already exists")]
    CorpusSetAlreadyExists,

    #[error("Failed to delete corpora: {0}")]
    FailedToDeleteCorpora(AnnisExportCorpusNames),

    #[error("Failed to order chains")]
    FailedToOrderChains,

    #[error("Failed to read metadata from {path}: {err}")]
    FailedToReadMetadata {
        path: PathBuf,
        err: AnnisExportMetadataError,
    },

    #[error("Match node index {index} out of bounds, may be at most {max_index}")]
    MatchNodeIndexOutOfBounds { index: usize, max_index: usize },

    #[error("Match has no nodes")]
    MatchWithoutNodes,

    #[error("Annotation corresponding to segmentation {0} not found")]
    MissingAnnotationForSegmentation(String),

    #[error("Query produced too many results: {0}")]
    TooManyResults(u64),

    #[error(transparent)]
    Annis(#[from] GraphAnnisError),

    #[error(transparent)]
    Io(#[from] io::Error),
}

#[derive(Debug)]
pub struct AnnisExportCorpusNames(Vec<String>);

impl Display for AnnisExportCorpusNames {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0.join(", "))
    }
}

impl From<Vec<String>> for AnnisExportCorpusNames {
    fn from(corpus_names: Vec<String>) -> Self {
        Self(corpus_names)
    }
}

#[derive(Debug, Error)]
pub enum AnnisExportMetadataError {
    #[error("Invalid format: {0}")]
    InvalidFormat(#[from] toml::de::Error),

    #[error("Unsupported version: {version}")]
    UnsupportedVersion { version: usize },
}

impl AnnimateError {
    pub fn cancelled(&self) -> bool {
        matches!(self, AnnimateError::Cancelled)
    }
}

impl From<GraphAnnisCoreError> for AnnimateError {
    fn from(err: GraphAnnisCoreError) -> Self {
        GraphAnnisError::Core(err).into()
    }
}

impl From<ZipError> for AnnimateError {
    fn from(err: ZipError) -> Self {
        Self::Io(err.into())
    }
}

pub(crate) fn cancel_if<F>(cancel_requested: F) -> Result<(), AnnimateError>
where
    F: Fn() -> bool,
{
    if cancel_requested() {
        Err(AnnimateError::Cancelled)
    } else {
        Ok(())
    }
}
