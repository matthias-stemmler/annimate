use graphannis::errors::GraphAnnisError;
use graphannis_core::{errors::GraphAnnisCoreError, types::NodeID};
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AnnisExportError {
    #[error("failed to find covered node for {0}")]
    CoveredNodeNotFound(NodeID),

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
