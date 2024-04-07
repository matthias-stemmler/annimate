use crate::{error::AnnisExportMetadataError, AnnisExportError};
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, KeyValueMap};
use std::{
    fs, io,
    path::{Path, PathBuf},
    str::FromStr,
    sync::RwLock,
};

const METADATA_VERSION: usize = 1;

pub(crate) struct MetadataStorage {
    path: PathBuf,
    metadata: RwLock<Metadata>,
}

impl MetadataStorage {
    pub(crate) fn from_db_dir<P>(db_dir: P) -> Result<Self, AnnisExportError>
    where
        P: AsRef<Path>,
    {
        let path = db_dir.as_ref().join("annimate.toml");

        if path.try_exists()? {
            let data = fs::read_to_string(&path)?;

            match data.parse() {
                Ok(metadata) => Ok(Self {
                    path,
                    metadata: RwLock::new(metadata),
                }),
                Err(err) => Err(AnnisExportError::FailedToReadMetadata { path, err }),
            }
        } else {
            let storage = Self {
                path,
                metadata: Default::default(),
            };
            storage.write()?;
            Ok(storage)
        }
    }

    pub(crate) fn corpus_sets(&self) -> Vec<CorpusSet> {
        self.metadata.read().unwrap().corpus_sets.clone()
    }

    fn write(&self) -> io::Result<()> {
        fs::write(
            &self.path,
            toml::to_string_pretty(&self.metadata)
                .expect("Failed to serialize metadata")
                .as_bytes(),
        )
    }
}

#[serde_as]
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
struct Metadata {
    metadata_version: usize,

    #[serde_as(as = "KeyValueMap<_>")]
    corpus_sets: Vec<CorpusSet>,
}

impl Default for Metadata {
    fn default() -> Self {
        Self {
            metadata_version: METADATA_VERSION,
            corpus_sets: Default::default(),
        }
    }
}

impl FromStr for Metadata {
    type Err = AnnisExportMetadataError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let metadata: Metadata = toml::from_str(s)?;

        if metadata.metadata_version == 0 || metadata.metadata_version > METADATA_VERSION {
            Err(AnnisExportMetadataError::UnsupportedVersion {
                version: metadata.metadata_version,
            })
        } else {
            Ok(metadata)
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) struct CorpusSet {
    #[serde(rename = "$key$")]
    pub(crate) name: String,

    pub(crate) corpus_names: Vec<String>,
}
