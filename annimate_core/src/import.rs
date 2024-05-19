use std::collections::HashSet;
use std::fmt::{self, Debug, Display, Formatter};
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use std::rc::Rc;

use itertools::Itertools;
use serde::Serialize;
use tempfile::TempDir;
use zip::ZipArchive;

use crate::{cancel_if, AnnisExportError};

pub(crate) fn find_importable_corpora<F, G>(
    paths: Vec<PathBuf>,
    on_progress: F,
    cancel_requested: G,
) -> Result<Vec<ImportableCorpus>, AnnisExportError>
where
    F: Fn(&str),
    G: Fn() -> bool,
{
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
        cancel_if(&cancel_requested)?;

        if !location.scoped_path.has_temp_dir()
            && !seen_paths.insert(location.scoped_path.path.clone())
        {
            continue;
        }

        match import_path_type(&location)? {
            Some(ImportPathType::Corpus(format)) => {
                on_progress(&format!(
                    "found {} corpus at {}",
                    format,
                    location.as_ref().display(),
                ));

                importable_corpora.push({
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
                })
            }

            Some(ImportPathType::Directory) => {
                on_progress(&format!(
                    "found directory at {}, scanning",
                    location.as_ref().display(),
                ));

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

                on_progress(&format!(
                    "found archive at {}, extracting into {}",
                    location.as_ref().display(),
                    temp_dir.path().display(),
                ));

                extract_zip(&location, &temp_dir, &cancel_requested)?;

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

impl Display for ImportFormat {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self {
            ImportFormat::RelANNIS => write!(f, "RelANNIS"),
            ImportFormat::GraphML => write!(f, "GraphML"),
        }
    }
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

fn extract_zip<F, P, Q>(
    zip_path: P,
    output_dir: Q,
    cancel_requested: F,
) -> Result<(), AnnisExportError>
where
    F: Fn() -> bool,
    P: AsRef<Path>,
    Q: AsRef<Path>,
{
    let mut archive = ZipArchive::new(File::open(zip_path.as_ref())?)?;

    for i in 0..archive.len() {
        cancel_if(&cancel_requested)?;

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

pub(crate) fn import_corpus<F, G, H>(
    storage: &graphannis::CorpusStorage,
    corpus: ImportableCorpus,
    on_started: F,
    on_progress: G,
    cancel_requested: H,
) -> Result<String, AnnisExportError>
where
    F: Fn(),
    G: Fn(&str),
    H: Fn() -> bool,
{
    cancel_if(&cancel_requested)?;

    on_started();

    on_progress(&format!(
        "importing {} corpus from {}",
        corpus.format,
        corpus.path.as_ref().display(),
    ));

    let name = storage.import_from_fs(
        corpus.path.as_ref(),
        corpus.format.into(),
        None,
        false,
        false,
        &on_progress,
    )?;

    on_progress(&format!("done importing corpus {name}"));

    Ok(name)
}
