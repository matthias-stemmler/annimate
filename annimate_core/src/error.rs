use std::fmt::{self, Display, Formatter};
use std::io;
use std::path::PathBuf;

use graphannis::errors::GraphAnnisError;
use graphannis_core::errors::GraphAnnisCoreError;
use rust_xlsxwriter::XlsxError;
use thiserror::Error;
use zip::result::ZipError;

/// Error during an operation provided by Annimate.
#[derive(Debug, Error)]
pub enum AnnimateError {
    /// Operation was cancelled.
    #[error("Cancelled")]
    Cancelled,

    /// Corpus name decodes to invalid UTF-8.
    #[error("Corpus name decodes to invalid UTF-8: {0}")]
    CorpusNameDecodesToInvalidUtf8(String),

    /// Corpus set already exists.
    #[error("Corpus set already exists")]
    CorpusSetAlreadyExists,

    /// Failed to clear cache.
    #[error("Failed to clear cache")]
    FailedToClearCache,

    /// Failed to delete corpora.
    #[error("Failed to delete corpora: {0}")]
    FailedToDeleteCorpora(AnnimateErrorCorpusNames),

    /// Failed to order chains.
    #[error("Failed to order chains")]
    FailedToOrderChains,

    /// Failed to read project.
    #[error(transparent)]
    FailedToReadProject(AnnimateReadFileError),

    /// Failed to read metadata.
    #[error("Failed to read metadata from {path}: {err}")]
    FailedToReadMetadata {
        /// Path of metadata file.
        path: PathBuf,

        /// Inner error.
        err: AnnimateReadFileError,
    },

    /// Failed to write XLSX workbook
    #[error("Failed to write XLSX workbook: {0}")]
    FailedToWriteXlsxWorkbook(#[from] XlsxError),

    /// Match node index out of bounds.
    #[error("Match node index {index} out of bounds, may be at most {max_index}")]
    MatchNodeIndexOutOfBounds {
        /// Match node index.
        index: usize,

        /// Maximal valid index.
        max_index: usize,
    },

    /// Match has no nodes.
    #[error("Match has no nodes")]
    MatchWithoutNodes,

    /// Missing annotation for segmentation.
    #[error("Annotation corresponding to segmentation {0} not found")]
    MissingAnnotationForSegmentation(String),

    /// Wrapper for [`GraphAnnisError`].
    #[error(transparent)]
    Annis(#[from] GraphAnnisError),

    /// Wrapper for [`io::Error`].
    #[error(transparent)]
    Io(#[from] io::Error),
}

#[derive(Debug)]
pub struct AnnimateErrorCorpusNames(Vec<String>);

impl Display for AnnimateErrorCorpusNames {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0.join(", "))
    }
}

impl From<Vec<String>> for AnnimateErrorCorpusNames {
    fn from(corpus_names: Vec<String>) -> Self {
        Self(corpus_names)
    }
}

#[derive(Debug, Error)]
pub enum AnnimateReadFileError {
    #[error("Invalid format")]
    InvalidFormat(#[from] toml::de::Error),

    #[error("Unsupported version: {version}")]
    UnsupportedVersion { version: u32 },
}

impl AnnimateError {
    /// Returns whether the error was due to cancellation.
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
