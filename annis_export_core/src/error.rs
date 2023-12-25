use graphannis::errors::GraphAnnisError;
use graphannis_core::errors::GraphAnnisCoreError;
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AnnisExportError {
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
