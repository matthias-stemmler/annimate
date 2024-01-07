pub(crate) fn group_by<F, T>(items: &[T], key_fn: F) -> Groups<F, T> {
    Groups {
        items,
        key_fn: Some(key_fn),
        next_index: 0,
    }
}

#[derive(Debug)]
pub(crate) struct Groups<'a, F, T> {
    items: &'a [T],
    key_fn: Option<F>,
    next_index: usize,
}

impl<'a, E, F, K, T> Iterator for Groups<'a, F, T>
where
    F: FnMut(&T) -> Result<Option<K>, E>,
    K: PartialEq,
{
    type Item = Result<(K, &'a [T]), E>;

    fn next(&mut self) -> Option<Self::Item> {
        let mut key_fn = self.key_fn.take()?;

        let (key, index) = match (self.next_index..self.items.len()).find_map(|i| {
            key_fn(&self.items[i])
                .map(|k| k.map(|k| (k, i)))
                .transpose()
        })? {
            Ok((_, i)) if i >= self.items.len() => return None,
            Ok((k, i)) => (k, i),
            Err(err) => return Some(Err(err)),
        };

        self.next_index =
            match (index + 1..self.items.len()).find_map(|i| match key_fn(&self.items[i]) {
                Ok(Some(k)) if k == key => None,
                Ok(..) => Some(Ok(i)),
                Err(err) => Some(Err(err)),
            }) {
                Some(Ok(i)) => i,
                Some(Err(err)) => return Some(Err(err)),
                None => self.items.len(),
            };

        self.key_fn = Some(key_fn);
        Some(Ok((key, &self.items[index..self.next_index])))
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
