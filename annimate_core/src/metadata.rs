//! Dealing with metadata (data not managed by graphANNIS).

use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::sync::RwLock;
use std::{fs, io};

use serde::{Deserialize, Serialize};

use crate::error::AnnisExportMetadataError;
use crate::AnnimateError;

/// Current version of the metadata file format.
const METADATA_VERSION: usize = 1;

/// Storage for metadata.
pub(crate) struct MetadataStorage {
    /// Path to the metadata file.
    path: PathBuf,

    /// In-memory copy of metadata.
    metadata: RwLock<Metadata>,
}

impl MetadataStorage {
    /// Creates a new [`MetadataStorage`] for the given database directory.
    ///
    /// Assumes that the database directory contains corpora with the given names, and no more.
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

    /// Returns all [`CorpusSet`]s.
    pub(crate) fn corpus_sets(&self) -> BTreeMap<String, CorpusSet> {
        self.metadata.read().unwrap().corpus_sets.clone()
    }

    /// Applies the given closure to the map of [`CorpusSet`]s.
    ///
    /// This updates the metadata in memory and also writes them to disk.
    pub(crate) fn update_corpus_sets(
        &self,
        op: impl FnOnce(&mut BTreeMap<String, CorpusSet>),
    ) -> io::Result<()> {
        let mut metadata = self.metadata.write().unwrap();
        op(&mut metadata.corpus_sets);
        write_metadata(&self.path, &metadata)
    }

    /// Applies the given fallible closure to the map of [`CorpusSet`]s.
    ///
    /// This updates the metadata in memory and also writes them to disk.
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

/// Removes corpora from metadata that don't belong to the given list.
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

/// Writes metadata to disk.
fn write_metadata(path: &Path, metadata: &Metadata) -> io::Result<()> {
    fs::write(
        path,
        toml::to_string_pretty(metadata)
            .expect("Failed to serialize metadata")
            .as_bytes(),
    )
}

/// The metadata for a given database directory.
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
struct Metadata {
    /// Version of the metadata file format.
    metadata_version: usize,

    /// Map of corpus sets.
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

/// A set of corpora.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) struct CorpusSet {
    /// Names of the corpora contained in this set.
    pub(crate) corpus_names: BTreeSet<String>,
}
