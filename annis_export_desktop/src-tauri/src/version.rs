use serde::Serialize;

pub(crate) const VERSION_INFO: VersionInfo = VersionInfo {
    annimate_version: env!("CARGO_PKG_VERSION"),
    graphannis_version: env!("GRAPHANNIS_VERSION"),
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct VersionInfo {
    annimate_version: &'static str,
    graphannis_version: &'static str,
}
