pub const VERSION_INFO: VersionInfo = VersionInfo {
    annimate_version: env!("CARGO_PKG_VERSION"),
    graphannis_version: env!("GRAPHANNIS_VERSION"),
};

#[cfg_attr(feature = "serde", derive(serde::Serialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct VersionInfo {
    pub annimate_version: &'static str,
    pub graphannis_version: &'static str,
}
