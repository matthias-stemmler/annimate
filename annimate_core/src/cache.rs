use std::collections::HashMap;
use std::io::Write;
use std::ops::Not;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use std::{fs, io};

use graphannis::graph::AnnoKey;
use serde::{Deserialize, Serialize};

use crate::name;

pub(crate) struct CacheStorage {
    db_dir: PathBuf,
    cache: RwLock<HashMap<String, RwLock<CorpusCache>>>,
}

impl CacheStorage {
    pub(crate) fn from_db_dir(db_dir: PathBuf) -> Self {
        Self {
            db_dir,
            cache: RwLock::new(HashMap::new()),
        }
    }

    pub(crate) fn get_anno_key_infos<E>(
        &self,
        corpus_name: &str,
        load: impl FnOnce() -> Result<Vec<AnnoKeyInfo>, E>,
    ) -> Result<Vec<AnnoKeyInfo>, E>
    where
        E: From<io::Error>,
    {
        if let Some(corpus_cache) = self.cache.read().unwrap().get(corpus_name) {
            if let Some(value) = corpus_cache.read().unwrap().anno_key_infos.clone() {
                return Ok(value);
            }

            let value = load()?;

            {
                let mut corpus_cache = corpus_cache.write().unwrap();
                corpus_cache.anno_key_infos = Some(value.clone());
                corpus_cache.write_to_disk(&self.db_dir, corpus_name)?;
            }

            return Ok(value);
        }

        let mut corpus_cache =
            CorpusCache::read_from_disk(&self.db_dir, corpus_name)?.unwrap_or_default();

        if let Some(value) = corpus_cache.anno_key_infos {
            return Ok(value.clone());
        }

        let value = load()?;

        corpus_cache.anno_key_infos = Some(value.clone());
        corpus_cache.write_to_disk(&self.db_dir, corpus_name)?;
        self.cache
            .write()
            .unwrap()
            .insert(corpus_name.to_string(), RwLock::new(corpus_cache));

        Ok(value)
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
struct CacheVersion {
    #[serde(rename = "cache-version")]
    value: u32,
}

impl CacheVersion {
    const CURRENT: Self = Self { value: 1 };

    fn is_valid(self) -> bool {
        self.value == Self::CURRENT.value
    }
}

#[derive(Debug, Deserialize, Serialize)]
struct CorpusCache {
    #[serde(flatten)]
    cache_version: CacheVersion,

    #[serde(rename = "annotations")]
    anno_key_infos: Option<Vec<AnnoKeyInfo>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct AnnoKeyInfo {
    #[serde(flatten)]
    pub(crate) anno_key: AnnoKey,

    #[serde(rename = "corpus", default, skip_serializing_if = "<&bool>::not")]
    pub(crate) is_corpus: bool,

    #[serde(rename = "document", default, skip_serializing_if = "<&bool>::not")]
    pub(crate) is_document: bool,
}

impl Default for CorpusCache {
    fn default() -> Self {
        Self {
            cache_version: CacheVersion::CURRENT,
            anno_key_infos: None,
        }
    }
}

impl CorpusCache {
    fn read_from_disk(db_dir: &Path, corpus_name: &str) -> Result<Option<Self>, io::Error> {
        let path = Self::get_path(db_dir, corpus_name);

        let corpus_cache = if path.try_exists()? {
            let data = fs::read_to_string(path)?;
            Self::parse(&data)
        } else {
            None
        };

        Ok(corpus_cache)
    }

    fn write_to_disk(&self, db_dir: &Path, corpus_name: &str) -> Result<(), io::Error> {
        // Persist atomically to avoid ending up with a partially written cache

        let mut temp_file = tempfile::Builder::new()
            .prefix(".annimate-cache")
            .suffix(".toml")
            .tempfile_in(name::get_corpus_path(db_dir, corpus_name))?;

        temp_file.write_all(
            toml::to_string_pretty(self)
                .map_err(io::Error::other)?
                .as_bytes(),
        )?;

        temp_file.flush()?;
        temp_file.persist(Self::get_path(db_dir, corpus_name))?;

        Ok(())
    }

    fn get_path(db_dir: &Path, corpus_name: &str) -> PathBuf {
        name::get_corpus_path(db_dir, corpus_name).join("annimate-cache.toml")
    }

    fn parse(s: &str) -> Option<Self> {
        toml::from_str::<CorpusCache>(s)
            .ok()
            .take_if(|cache| cache.cache_version.is_valid())
    }
}
