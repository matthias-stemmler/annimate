use std::collections::HashSet;
use std::fmt::Debug;
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use std::rc::Rc;

use graphannis::errors::GraphAnnisError;
use itertools::Itertools;
use serde::Serialize;
use tempfile::TempDir;
use zip::ZipArchive;

pub(crate) fn find_importable_corpora(paths: Vec<PathBuf>) -> io::Result<Vec<ImportableCorpus>> {
    let mut importable_corpora = Vec::new();
    let mut seen_paths = HashSet::new();
    let mut stack = paths
        .into_iter()
        .map(|path| Location {
            parents: Vec::new(),
            scoped_path: path.into(),
        })
        .rev()
        .collect_vec();

    while let Some(location) = stack.pop() {
        if !location.scoped_path.has_temp_dir()
            && !seen_paths.insert(location.scoped_path.path.clone())
        {
            continue;
        }

        match import_path_type(&location)? {
            Some(ImportPathType::Corpus(format)) => importable_corpora.push({
                let relative_path = location
                    .scoped_path
                    .relative_path()
                    .to_string_lossy()
                    .into_owned();

                let file_name = location
                    .scoped_path
                    .as_ref()
                    .file_name()
                    .map(|f| f.to_string_lossy().into_owned())
                    .unwrap_or_else(|| relative_path.clone());

                let trace = location
                    .parents
                    .into_iter()
                    .map(|p| p.to_string_lossy())
                    .chain([FilesystemEntity {
                        kind: FilesystemEntityKind::Corpus { format },
                        path: relative_path,
                    }])
                    .collect();

                ImportableCorpus {
                    file_name,
                    format,
                    path: location.scoped_path,
                    trace,
                }
            }),

            Some(ImportPathType::Directory) => {
                let entries: Vec<_> = location
                    .as_ref()
                    .read_dir()?
                    .map_ok(|entry| Location {
                        parents: location.parents.clone(),
                        scoped_path: location.scoped_path.in_scope(entry.path()),
                    })
                    .try_collect()?;

                stack.extend(entries.into_iter().rev());
            }

            Some(ImportPathType::Archive) => {
                let temp_dir = TempDir::new()?;
                extract_zip(&location, &temp_dir)?;

                stack.push(Location {
                    parents: location
                        .parents
                        .iter()
                        .cloned()
                        .chain([FilesystemEntity {
                            kind: FilesystemEntityKind::Archive,
                            path: location.scoped_path.relative_path().to_path_buf(),
                        }])
                        .collect(),
                    scoped_path: temp_dir.into(),
                });
            }

            None => {}
        }
    }

    Ok(importable_corpora)
}

#[derive(Debug)]
pub(crate) struct ImportableCorpus {
    pub(crate) file_name: String,
    pub(crate) format: ImportFormat,
    pub(crate) trace: Vec<FilesystemEntity<String>>,
    path: ScopedPath,
}

#[derive(Clone, Copy, Debug, Serialize)]
pub(crate) enum ImportFormat {
    RelANNIS,
    GraphML,
}

impl From<ImportFormat> for graphannis::corpusstorage::ImportFormat {
    fn from(import_format: ImportFormat) -> Self {
        match import_format {
            ImportFormat::RelANNIS => graphannis::corpusstorage::ImportFormat::RelANNIS,
            ImportFormat::GraphML => graphannis::corpusstorage::ImportFormat::GraphML,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FilesystemEntity<T> {
    kind: FilesystemEntityKind,
    path: T,
}

impl FilesystemEntity<PathBuf> {
    fn to_string_lossy(&self) -> FilesystemEntity<String> {
        FilesystemEntity {
            kind: self.kind,
            path: self.path.to_string_lossy().into_owned(),
        }
    }
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
#[serde(rename_all_fields = "camelCase")]
pub(crate) enum FilesystemEntityKind {
    Archive,
    Corpus { format: ImportFormat },
}

#[derive(Debug)]
struct Location {
    parents: Vec<FilesystemEntity<PathBuf>>,
    scoped_path: ScopedPath,
}

impl AsRef<Path> for Location {
    fn as_ref(&self) -> &Path {
        self.scoped_path.as_ref()
    }
}

#[derive(Debug)]
pub(crate) struct ScopedPath {
    path: PathBuf,
    temp_dir: Option<Rc<TempDir>>,
}

impl ScopedPath {
    fn has_temp_dir(&self) -> bool {
        self.temp_dir.is_some()
    }

    fn in_scope(&self, path: PathBuf) -> ScopedPath {
        ScopedPath {
            path,
            temp_dir: self.temp_dir.clone(),
        }
    }

    fn relative_path(&self) -> &Path {
        match &self.temp_dir {
            Some(temp_dir) => self.path.strip_prefix(temp_dir.path()).unwrap(),
            None => &self.path,
        }
    }
}

impl AsRef<Path> for ScopedPath {
    fn as_ref(&self) -> &Path {
        &self.path
    }
}

impl From<PathBuf> for ScopedPath {
    fn from(path: PathBuf) -> ScopedPath {
        ScopedPath {
            path,
            temp_dir: None,
        }
    }
}

impl From<TempDir> for ScopedPath {
    fn from(temp_dir: TempDir) -> ScopedPath {
        ScopedPath {
            path: temp_dir.path().to_path_buf(),
            temp_dir: Some(Rc::new(temp_dir)),
        }
    }
}

fn import_path_type<P>(path: P) -> io::Result<Option<ImportPathType>>
where
    P: AsRef<Path>,
{
    let path = path.as_ref();
    let metadata = path.symlink_metadata()?;

    if metadata.is_file() {
        match path.extension() {
            Some(ext) if ext.eq_ignore_ascii_case("graphml") => {
                Ok(Some(ImportPathType::Corpus(ImportFormat::GraphML)))
            }
            Some(ext) if ext.eq_ignore_ascii_case("zip") => Ok(Some(ImportPathType::Archive)),
            _ => Ok(None),
        }
    } else if metadata.is_dir() {
        for entry in path.read_dir()? {
            let entry = entry?;
            if entry.file_name() == "corpus.annis" || entry.file_name() == "corpus.tab" {
                return Ok(Some(ImportPathType::Corpus(ImportFormat::RelANNIS)));
            }
        }

        Ok(Some(ImportPathType::Directory))
    } else {
        Ok(None)
    }
}

enum ImportPathType {
    Archive,
    Corpus(ImportFormat),
    Directory,
}

fn extract_zip<P, Q>(zip_path: P, output_dir: Q) -> io::Result<()>
where
    P: AsRef<Path>,
    Q: AsRef<Path>,
{
    let mut archive = ZipArchive::new(File::open(zip_path.as_ref())?)?;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;

        if let Some(enclosed_path) = entry.enclosed_name() {
            let output_path = output_dir.as_ref().join(enclosed_path);

            if entry.is_dir() {
                fs::create_dir_all(output_path)?;
            } else if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent)?;
                let mut output_file = File::create(&output_path)?;
                io::copy(&mut entry, &mut output_file)?;
            }
        }
    }

    Ok(())
}

pub(crate) fn import_corpus<F>(
    storage: &graphannis::CorpusStorage,
    corpus: ImportableCorpus,
    on_progress: F,
) -> Result<ImportedCorpus, GraphAnnisError>
where
    F: Fn(&str),
{
    let import = |name| {
        storage.import_from_fs(
            corpus.path.as_ref(),
            corpus.format.into(),
            name,
            false,
            false,
            &on_progress,
        )
    };

    let conflicting_name = match import(None) {
        Ok(imported_name) => {
            return Ok(ImportedCorpus {
                imported_name,
                conflicting_name: None,
            })
        }

        Err(GraphAnnisError::CorpusExists(conflicting_name)) => conflicting_name,

        Err(err) => return Err(err),
    };

    let corpus_infos = storage.list()?;

    let fallback_name = match (1..)
        .map(|i| format!("{conflicting_name} ({i})"))
        .find(|name| corpus_infos.iter().all(|c| &c.name != name))
    {
        Some(name) => name,
        None => return Err(GraphAnnisError::CorpusExists(conflicting_name)),
    };

    match import(Some(fallback_name)) {
        Ok(imported_name) => Ok(ImportedCorpus {
            imported_name,
            conflicting_name: Some(conflicting_name),
        }),

        Err(GraphAnnisError::CorpusExists(_)) => {
            Err(GraphAnnisError::CorpusExists(conflicting_name))
        }

        Err(err) => Err(err),
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportedCorpus {
    pub(crate) imported_name: String,
    pub(crate) conflicting_name: Option<String>,
}
