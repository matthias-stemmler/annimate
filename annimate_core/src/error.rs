use std::io;
use std::path::PathBuf;

use graphannis::errors::GraphAnnisError;
use graphannis_core::errors::GraphAnnisCoreError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AnnisExportError {
    #[error("Corpus name decodes to invalid UTF-8: {0}")]
    CorpusNameDecodesToInvalidUtf8(String),

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

#[derive(Debug, Error)]
pub enum AnnisExportMetadataError {
    #[error("Invalid format: {0}")]
    InvalidFormat(#[from] toml::de::Error),

    #[error("Unsupported version: {version}")]
    UnsupportedVersion { version: usize },
}

impl From<GraphAnnisCoreError> for AnnisExportError {
    fn from(err: GraphAnnisCoreError) -> Self {
        GraphAnnisError::Core(err).into()
    }
}
