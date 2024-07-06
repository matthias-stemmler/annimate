use serde::Serialize;

/// The current version of Annimate and the version of [graphANNIS](https://docs.rs/graphannis) used by it.
pub const VERSION_INFO: VersionInfo = VersionInfo {
    annimate_version: env!("CARGO_PKG_VERSION"),
    graphannis_version: env!("GRAPHANNIS_VERSION"),
};

/// Information about a specific version of Annimate.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub(crate) annimate_version: &'static str,
    pub(crate) graphannis_version: &'static str,
}
