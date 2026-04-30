use std::collections::HashMap;
use std::io::Write;
use std::ops::Not;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use std::{fs, io};

use graphannis::graph::AnnoKey;
use serde::{Deserialize, Serialize};

use crate::{name, util};

pub(crate) struct CacheStorage {
    db_dir: PathBuf,
    cache: RwLock<HashMap<String, Arc<RwLock<CorpusCache>>>>,
}

impl CacheStorage {
    pub(crate) fn from_db_dir(db_dir: PathBuf) -> Self {
        Self {
            db_dir,
            cache: RwLock::new(HashMap::new()),
        }
    }

    pub(crate) fn get_node_anno_key_infos<E>(
        &self,
        corpus_name: &str,
        load: impl FnOnce() -> Result<Vec<NodeAnnoKeyInfo>, E>,
    ) -> Result<Vec<NodeAnnoKeyInfo>, E>
    where
        E: From<io::Error>,
    {
        self.get_or_load(
            corpus_name,
            |c| &c.node_anno_key_infos,
            |c| &mut c.node_anno_key_infos,
            load,
        )
    }

    /// Evict a corpus from the in-memory cache.
    ///
    /// This will only evict the corpus from the in-memory cache, not from disk.
    /// It is meant to be used when a corpus has already been deleted from disk.
    pub(crate) fn evict_in_memory(&self, corpus_name: &str) {
        self.cache.write().unwrap().remove(corpus_name);
    }

    /// Clear the cache for the given corpus.
    ///
    /// This evicts the in-memory cache for the corpus and deletes the on-disk
    /// cache file if present.
    pub(crate) fn clear(&self, corpus_name: &str) -> Result<(), io::Error> {
        let mut cache = self.cache.write().unwrap();
        cache.remove(corpus_name);

        // Remove the file while holding the write lock to avoid a concurrent
        // load reading the still-present file and re-inserting a stale entry
        match fs::remove_file(CorpusCache::get_path(&self.db_dir, corpus_name)) {
            Ok(()) => Ok(()),
            Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(()),
            Err(err) => Err(err),
        }
    }

    fn get_or_load<E, T>(
        &self,
        corpus_name: &str,
        get: impl Fn(&CorpusCache) -> &Option<T>,
        get_mut: impl Fn(&mut CorpusCache) -> &mut Option<T>,
        load: impl FnOnce() -> Result<T, E>,
    ) -> Result<T, E>
    where
        E: From<io::Error>,
        T: Clone,
    {
        let corpus_cache = self.get_corpus_cache(corpus_name)?;

        if let Some(value) = get(&corpus_cache.read().unwrap()) {
            return Ok(value.clone());
        }

        let mut corpus_cache_write = corpus_cache.write().unwrap();

        // Check again in case another thread inserted the value
        // between releasing the read lock and acquiring the write lock
        if let Some(value) = get(&corpus_cache_write) {
            return Ok(value.clone());
        }

        // Load and write to disk while holding the write lock to avoid multiple loads
        // and to avoid concurrent writes to the file
        let value = load()?;
        *get_mut(&mut corpus_cache_write) = Some(value.clone());
        corpus_cache_write.write_to_disk(&self.db_dir, corpus_name)?;
        Ok(value)
    }

    fn get_corpus_cache(&self, corpus_name: &str) -> Result<Arc<RwLock<CorpusCache>>, io::Error> {
        if let Some(corpus_cache) = self.cache.read().unwrap().get(corpus_name) {
            return Ok(Arc::clone(corpus_cache));
        }

        let mut cache_write = self.cache.write().unwrap();

        // Check again in case another thread inserted the entry
        // between releasing the read lock and acquiring the write lock
        if let Some(corpus_cache) = cache_write.get(corpus_name) {
            return Ok(Arc::clone(corpus_cache));
        }

        let corpus_cache =
            CorpusCache::read_from_disk(&self.db_dir, corpus_name)?.unwrap_or_default();
        let corpus_cache = Arc::new(RwLock::new(corpus_cache));
        cache_write.insert(corpus_name.to_string(), Arc::clone(&corpus_cache));
        Ok(corpus_cache)
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

    // on-disk key kept as "annotations" for backward compatibility with existing caches
    #[serde(rename = "annotations")]
    node_anno_key_infos: Option<Vec<NodeAnnoKeyInfo>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(crate) struct NodeAnnoKeyInfo {
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
            node_anno_key_infos: None,
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
        util::write_atomically(Self::get_path(db_dir, corpus_name), |out| {
            write!(
                out,
                "{}",
                toml::to_string_pretty(self).map_err(io::Error::other)?
            )
        })
    }

    fn get_path(db_dir: &Path, corpus_name: &str) -> PathBuf {
        name::get_corpus_path(db_dir, corpus_name).join("annimate-cache.toml")
    }

    fn parse(s: &str) -> Option<Self> {
        toml::from_str::<CorpusCache>(s)
            .ok()
            .filter(|cache| cache.cache_version.is_valid())
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::thread;

    use super::*;

    #[test]
    fn get_node_anno_key_infos_when_called_concurrently_calls_load_only_once() {
        const TEST_CORPUS: &str = "test_corpus";

        let db_dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(db_dir.path().join(TEST_CORPUS)).unwrap();

        let cache_storage = Arc::new(CacheStorage::from_db_dir(db_dir.path().into()));
        let load_counter = Arc::new(AtomicUsize::new(0));

        let mut handles = Vec::new();
        for _ in 0..2 {
            handles.push(thread::spawn({
                let cache_storage = Arc::clone(&cache_storage);
                let load_counter = Arc::clone(&load_counter);

                move || {
                    cache_storage
                        .get_node_anno_key_infos(TEST_CORPUS, || {
                            load_counter.fetch_add(1, Ordering::Relaxed);
                            Ok::<_, io::Error>(Vec::new())
                        })
                        .unwrap();
                }
            }));
        }

        for handle in handles {
            handle.join().unwrap();
        }

        assert_eq!(load_counter.load(Ordering::Relaxed), 1);
    }
}
