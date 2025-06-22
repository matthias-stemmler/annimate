use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::RwLock;
use std::{fs, io};

use serde::{Deserialize, Serialize};

use crate::AnnimateError;
use crate::error::AnnimateReadFileError;

pub(crate) struct MetadataStorage {
    path: PathBuf,
    metadata: RwLock<Metadata>,
}

impl MetadataStorage {
    pub(crate) fn from_db_dir<P, S>(db_dir: P, corpus_names: &[S]) -> Result<Self, AnnimateError>
    where
        P: AsRef<Path>,
        S: AsRef<str>,
    {
        let path = db_dir.as_ref().join("annimate.toml");

        let metadata = if path.try_exists()? {
            let data = fs::read_to_string(&path)?;

            match data.parse() {
                Ok(mut metadata) => {
                    cleanup_metadata(&mut metadata, corpus_names);
                    metadata
                }
                Err(err) => return Err(AnnimateError::FailedToReadMetadata { path, err }),
            }
        } else {
            Metadata::default()
        };

        write_metadata(&path, &metadata)?;

        Ok(Self {
            path,
            metadata: RwLock::new(metadata),
        })
    }

    pub(crate) fn corpus_sets(&self) -> BTreeMap<String, CorpusSet> {
        self.metadata.read().unwrap().corpus_sets.clone()
    }

    pub(crate) fn update_corpus_sets(
        &self,
        op: impl FnOnce(&mut BTreeMap<String, CorpusSet>),
    ) -> io::Result<()> {
        let mut metadata = self.metadata.write().unwrap();
        op(&mut metadata.corpus_sets);
        write_metadata(&self.path, &metadata)
    }

    pub(crate) fn try_update_corpus_sets<E>(
        &self,
        op: impl FnOnce(&mut BTreeMap<String, CorpusSet>) -> Result<(), E>,
    ) -> Result<(), AnnimateError>
    where
        AnnimateError: From<E>,
    {
        let mut metadata = self.metadata.write().unwrap();
        op(&mut metadata.corpus_sets)?;
        write_metadata(&self.path, &metadata)?;
        Ok(())
    }
}

fn cleanup_metadata<S>(metadata: &mut Metadata, corpus_names: &[S])
where
    S: AsRef<str>,
{
    for corpus_set in &mut metadata.corpus_sets.values_mut() {
        corpus_set
            .corpus_names
            .retain(|corpus_name| corpus_names.iter().any(|c| c.as_ref() == corpus_name));
    }
}

fn write_metadata(path: &Path, metadata: &Metadata) -> io::Result<()> {
    fs::write(
        path,
        toml::to_string_pretty(metadata).map_err(io::Error::other)?,
    )
}

#[derive(Debug, Deserialize, Serialize)]
struct MetadataVersion {
    #[serde(rename = "metadata-version")]
    value: u32,
}

impl MetadataVersion {
    const CURRENT: Self = Self { value: 1 };

    fn validate(self) -> Result<(), AnnimateReadFileError> {
        if self.value == 0 || self.value > Self::CURRENT.value {
            Err(AnnimateReadFileError::UnsupportedVersion {
                version: self.value,
            })
        } else {
            Ok(())
        }
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
struct Metadata {
    #[serde(flatten)]
    metadata_version: MetadataVersion,
    corpus_sets: BTreeMap<String, CorpusSet>,
}

impl Default for Metadata {
    fn default() -> Self {
        Self {
            metadata_version: MetadataVersion::CURRENT,
            corpus_sets: BTreeMap::default(),
        }
    }
}

impl FromStr for Metadata {
    type Err = AnnimateReadFileError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        toml::from_str::<MetadataVersion>(s)?.validate()?;
        Ok(toml::from_str(s)?)
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) struct CorpusSet {
    pub(crate) corpus_names: BTreeSet<String>,
}
