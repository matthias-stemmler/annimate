use annis_export_core::AnnisExportError;
use serde::{Serialize, Serializer};
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub(crate) enum Error {
    #[error(transparent)]
    AnnisExport(#[from] AnnisExportError),

    #[error(transparent)]
    Io(#[from] io::Error),
}

impl Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}
