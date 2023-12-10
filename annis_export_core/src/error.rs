use graphannis::errors::GraphAnnisError;
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AnnisExportError {
    #[error(transparent)]
    Annis(#[from] GraphAnnisError),

    #[error(transparent)]
    Io(#[from] io::Error),
}
