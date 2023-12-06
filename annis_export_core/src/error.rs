use graphannis::errors::GraphAnnisError;
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AnnisExportError {
    #[error(transparent)]
    Annis(#[from] GraphAnnisError),

    #[error(transparent)]
    Io(#[from] io::Error),

    #[error("matches have different number of tokens: {0} != {1}")]
    DifferentMatchTokenCount(usize, usize),
}
