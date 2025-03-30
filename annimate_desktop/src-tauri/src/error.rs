use annimate_core::AnnimateError;
use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub(crate) struct Error {
    message: String,
    cancelled: bool,
}

impl From<AnnimateError> for Error {
    fn from(err: AnnimateError) -> Self {
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

impl From<tauri_plugin_opener::Error> for Error {
    fn from(err: tauri_plugin_opener::Error) -> Self {
        Self {
            message: err.to_string(),
            cancelled: false,
        }
    }
}

pub(crate) struct ConversionError;

impl From<ConversionError> for Error {
    fn from(_: ConversionError) -> Self {
        Self {
            message: "Failed to convert data".into(),
            cancelled: false,
        }
    }
}
