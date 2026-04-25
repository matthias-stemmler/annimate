use std::fs;
use std::io::{self, ErrorKind, Write};
use std::path::Path;

use tempfile::{NamedTempFile, PersistError};

/// Groups runs of items in a slice with the same optional key, calculated fallibly.
///
/// Groups runs of successive elements in `items` for which `key_fn` returns the same non-`None`
/// value. Returns an iterator over pairs of a key and a subslice of `items`. If `key_fn` returns
/// `None` for an item, it is not included in the result, but it may interrupt a run.
pub(crate) fn group_by<F, T>(items: &[T], key_fn: F) -> Groups<'_, F, T> {
    Groups(Some(GroupsInner {
        items,
        key_fn,
        next_index: 0,
    }))
}

#[derive(Debug)]
pub(crate) struct Groups<'a, F, T>(Option<GroupsInner<'a, F, T>>);

#[derive(Debug)]
struct GroupsInner<'a, F, T> {
    items: &'a [T],
    key_fn: F,
    next_index: usize,
}

impl<'a, E, F, K, T> Iterator for Groups<'a, F, T>
where
    F: FnMut(&T) -> Result<Option<K>, E>,
    K: PartialEq,
{
    type Item = Result<(K, &'a [T]), E>;

    fn next(&mut self) -> Option<Self::Item> {
        let GroupsInner {
            items,
            mut key_fn,
            next_index,
        } = self.0.take()?;

        let (key, index) = match (next_index..items.len())
            .find_map(|i| key_fn(&items[i]).map(|k| k.map(|k| (k, i))).transpose())?
        {
            Ok((k, i)) => (k, i),
            Err(err) => return Some(Err(err)),
        };

        let next_index = match (index + 1..items.len()).find_map(|i| match key_fn(&items[i]) {
            Ok(Some(k)) if k == key => None,
            Ok(_) => Some(Ok(i)),
            Err(err) => Some(Err(err)),
        }) {
            Some(Ok(i)) => i,
            Some(Err(err)) => return Some(Err(err)),
            None => items.len(),
        };

        self.0 = Some(GroupsInner {
            items,
            key_fn,
            next_index,
        });

        Some(Ok((key, &items[index..next_index])))
    }
}

/// Atomically writes to `path` by writing to a temp file in the same directory and renaming.
///
/// The closure receives a [`NamedTempFile`] to write into. After it returns successfully, the temp
/// file is flushed and persisted at `path`. If the rename would cross filesystems, falls back to
/// copying.
pub(crate) fn write_atomically<E, F, P>(path: P, write: F) -> Result<(), E>
where
    E: From<io::Error>,
    F: FnOnce(&mut NamedTempFile) -> Result<(), E>,
    P: AsRef<Path>,
{
    let path = path.as_ref();

    let mut out = {
        let mut builder = tempfile::Builder::new();
        builder.prefix(".annimate_");
        match path.parent() {
            Some(parent) => builder.tempfile_in(parent)?,
            None => builder.tempfile()?,
        }
    };

    write(&mut out)?;

    out.flush()?;

    match out.persist(path) {
        Err(PersistError { error, file }) if error.kind() == ErrorKind::CrossesDevices => {
            // In case renaming would cross file systems, copy the file instead
            fs::copy(file.path(), path)?;
        }
        result => {
            result.map_err(io::Error::from)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    mod group_by {
        use super::*;

        #[test]
        fn empty() {
            let items: [&str; 0] = [];

            let groups: Vec<_> = group_by(&items, key_fn).collect();

            assert!(groups.is_empty());
        }

        #[test]
        fn single_group() {
            let items = ["abc", "def", "ghi"];

            let groups: Vec<_> = group_by(&items, key_fn).collect();

            assert_eq!(groups, [Ok((3, &["abc", "def", "ghi"][..]))]);
        }

        #[test]
        fn multiple_groups() {
            let items = ["abc", "def", "ghij", "klm", "nop"];

            let groups: Vec<_> = group_by(&items, key_fn).collect();

            assert_eq!(
                groups,
                [
                    Ok((3, &["abc", "def"][..])),
                    Ok((4, &["ghij"][..])),
                    Ok((3, &["klm", "nop"][..])),
                ]
            );
        }

        #[test]
        fn without_key() {
            let items = ["", "", ""];

            let groups: Vec<_> = group_by(&items, key_fn).collect();

            assert!(groups.is_empty());
        }

        #[test]
        fn partly_without_key() {
            let items = ["", "abc", "", "def", "ghi", ""];

            let groups: Vec<_> = group_by(&items, key_fn).collect();

            assert_eq!(
                groups,
                [Ok((3, &["abc"][..])), Ok((3, &["def", "ghi"][..]))]
            );
        }

        #[test]
        fn failing() {
            let items = ["abc", "def", "ghij", "FAIL", "klm"];

            let groups: Vec<_> = group_by(&items, key_fn).collect();

            assert_eq!(groups, [Ok((3, &["abc", "def"][..])), Err(KeyError)]);
        }

        fn key_fn(item: &&str) -> Result<Option<usize>, KeyError> {
            if *item == "FAIL" {
                Err(KeyError)
            } else if item.is_empty() {
                Ok(None)
            } else {
                Ok(Some(item.len()))
            }
        }

        #[derive(Debug, PartialEq)]
        struct KeyError;
    }

    mod write_atomically {
        use super::*;

        #[test]
        fn creates_file_with_content() {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("file.txt");

            write_atomically(&path, |out| out.write_all(b"test")).unwrap();

            assert_eq!(fs::read_to_string(&path).unwrap(), "test");
        }

        #[test]
        fn overwrites_existing_file() {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("file.txt");
            fs::write(&path, "old").unwrap();

            write_atomically(&path, |out| out.write_all(b"new")).unwrap();

            assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        }

        #[test]
        fn closure_error_propagates_and_leaves_existing_file_untouched() {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("file.txt");
            fs::write(&path, "untouched").unwrap();

            let result = write_atomically(&path, |_| Err(io::Error::other("failed")));

            assert!(result.is_err());
            assert_eq!(fs::read_to_string(&path).unwrap(), "untouched");
        }

        #[test]
        fn closure_error_leaves_no_file_when_path_did_not_exist() {
            let dir = tempfile::tempdir().unwrap();
            let path = dir.path().join("file.txt");

            let result = write_atomically(&path, |_| Err(io::Error::other("failed")));

            assert!(result.is_err());
            assert!(!path.exists());
        }
    }
}
