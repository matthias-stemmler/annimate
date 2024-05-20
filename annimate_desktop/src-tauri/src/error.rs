use std::io;

use annimate_core::AnnisExportError;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
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

impl From<tauri::Error> for Error {
    fn from(err: tauri::Error) -> Self {
        Self {
            message: err.to_string(),
            cancelled: false,
        }
    }
}

impl From<io::Error> for Error {
    fn from(err: io::Error) -> Self {
        Self {
            message: err.to_string(),
            cancelled: false,
        }
    }
}
