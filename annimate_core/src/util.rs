//! Utility functions.

/// Groups runs of items in a slice with the same optional key, calculated fallibly.
///
/// Groups runs of successive elements in `items` for which `key_fn` returns the same non-`None`
/// value. Returns an iterator over pairs of a key and a subslice of `items`. If `key_fn` returns
/// `None` for an item, it is not included in the result, but it may interrupt a run.
///
/// # Errors
/// Returns an error if `key_fn` fails.
pub(crate) fn group_by<F, T>(items: &[T], key_fn: F) -> Groups<'_, F, T> {
    Groups(Some(GroupsInner {
        items,
        key_fn,
        next_index: 0,
    }))
}

/// Iterator over pairs of keys and subslices returned from [`group_by`].
#[derive(Debug)]
pub(crate) struct Groups<'a, F, T>(Option<GroupsInner<'a, F, T>>);

/// Helper type for [Groups].
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

#[cfg(test)]
mod tests {
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
