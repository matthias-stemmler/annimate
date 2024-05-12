use std::env;

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

impl From<env::VarError> for Error {
    fn from(err: env::VarError) -> Self {
        Self {
            message: err.to_string(),
            cancelled: false,
        }
    }
}
