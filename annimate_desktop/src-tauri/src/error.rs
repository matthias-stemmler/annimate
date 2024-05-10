use annimate_core::AnnisExportError;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub(crate) struct Error {
    message: String,
    cancelled: bool,
}

impl From<AnnisExportError> for Error {
    fn from(err: AnnisExportError) -> Self {
        Self {
            message: err.to_string(),
            cancelled: err.cancelled(),
        }
    }
}
