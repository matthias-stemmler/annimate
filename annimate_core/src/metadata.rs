use std::collections::{BTreeMap, BTreeSet};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::RwLock;
use std::{fs, io};

use serde::{Deserialize, Serialize};

use crate::AnnimateError;
use crate::error::AnnimateMetadataError;

const METADATA_VERSION: usize = 1;

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
                    write_metadata(&path, &metadata)?;
                    metadata
                }
                Err(err) => return Err(AnnimateError::FailedToReadMetadata { path, err }),
            }
        } else {
            let metadata = Metadata::default();
            write_metadata(&path, &metadata)?;
            metadata
        };

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
        toml::to_string_pretty(metadata)
            .map_err(|err| io::Error::new(ErrorKind::Other, err))?
            .as_bytes(),
    )
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
struct Metadata {
    metadata_version: usize,
    corpus_sets: BTreeMap<String, CorpusSet>,
}

impl Default for Metadata {
    fn default() -> Self {
        Self {
            metadata_version: METADATA_VERSION,
            corpus_sets: BTreeMap::default(),
        }
    }
}

impl FromStr for Metadata {
    type Err = AnnimateMetadataError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let metadata: Metadata = toml::from_str(s)?;

        if metadata.metadata_version == 0 || metadata.metadata_version > METADATA_VERSION {
            Err(AnnimateMetadataError::UnsupportedVersion {
                version: metadata.metadata_version,
            })
        } else {
            Ok(metadata)
        }
    }
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) struct CorpusSet {
    pub(crate) corpus_names: BTreeSet<String>,
}
