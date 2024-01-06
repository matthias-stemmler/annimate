use graphannis::errors::GraphAnnisError;
use graphannis_core::errors::GraphAnnisCoreError;
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AnnisExportError {
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

impl From<GraphAnnisCoreError> for AnnisExportError {
    fn from(err: GraphAnnisCoreError) -> Self {
        GraphAnnisError::Core(err).into()
    }
}
