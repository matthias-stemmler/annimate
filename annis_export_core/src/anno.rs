use crate::{corpus::CorpusRef, error::AnnisExportError};
use graphannis::{errors::GraphAnnisError, model::AnnotationComponentType};
use graphannis_core::{
    graph::{ANNIS_NS, DEFAULT_NS},
    types::{AnnoKey, Component},
};
use itertools::Itertools;
use std::{
    collections::{BTreeSet, HashSet},
    fmt::{self, Display, Formatter},
    sync::OnceLock,
};

pub(crate) fn token_anno_key() -> &'static AnnoKey {
    static ANNO_KEY: OnceLock<AnnoKey> = OnceLock::new();

    ANNO_KEY.get_or_init(|| AnnoKey {
        ns: ANNIS_NS.into(),
        name: "tok".into(),
    })
}

pub(crate) fn default_ordering_component() -> &'static Component<AnnotationComponentType> {
    static COMPONENT: OnceLock<Component<AnnotationComponentType>> = OnceLock::new();

    COMPONENT.get_or_init(|| {
        Component::new(
            AnnotationComponentType::Ordering,
            ANNIS_NS.into(),
            "".into(),
        )
    })
}

pub(crate) fn gap_ordering_component() -> &'static Component<AnnotationComponentType> {
    static COMPONENT: OnceLock<Component<AnnotationComponentType>> = OnceLock::new();

    COMPONENT.get_or_init(|| {
        Component::new(
            AnnotationComponentType::Ordering,
            ANNIS_NS.into(),
            "datasource-gap".into(),
        )
    })
}

pub(crate) fn segmentations<S>(corpus_ref: CorpusRef<S>) -> Result<Vec<String>, GraphAnnisError>
where
    S: AsRef<str>,
{
    let mut segmentations_by_corpus = corpus_ref.names.iter().map(|name| {
        corpus_ref
            .storage
            .list_components(name.as_ref(), Some(AnnotationComponentType::Ordering), None)
            .map(|components| {
                components.into_iter().filter_map(|component| {
                    (component.layer == DEFAULT_NS).then_some(component.name)
                })
            })
    });

    let mut segmentations: BTreeSet<_> = match segmentations_by_corpus.next() {
        Some(segmentations) => segmentations?.collect(),
        None => return Ok(Vec::new()),
    };

    for segmentations_of_corpus in segmentations_by_corpus {
        let mut segmentations_of_corpus = segmentations_of_corpus?;
        segmentations.retain(|component| segmentations_of_corpus.contains(component));
    }

    segmentations
        .into_iter()
        .map(|name| {
            get_anno_key_for_segmentation_if_exists(corpus_ref, &name)
                .map(|anno_key| (name, anno_key))
        })
        .filter_map_ok(|(name, anno_key)| anno_key.map(|_| name.into()))
        .collect()
}

pub(crate) fn get_anno_key_for_segmentation<S>(
    corpus_ref: CorpusRef<S>,
    segmentation: Option<&str>,
) -> Result<AnnoKey, AnnisExportError>
where
    S: AsRef<str>,
{
    match segmentation {
        Some(segmentation) => get_anno_key_for_segmentation_if_exists(corpus_ref, segmentation)?
            .ok_or_else(|| {
                AnnisExportError::MissingAnnotationForSegmentation(segmentation.to_string())
            }),

        None => Ok(token_anno_key().clone()),
    }
}

fn get_anno_key_for_segmentation_if_exists<S>(
    corpus_ref: CorpusRef<S>,
    segmentation: &str,
) -> Result<Option<AnnoKey>, GraphAnnisError>
where
    S: AsRef<str>,
{
    let mut anno_keys_by_corpus = corpus_ref.names.iter().map(|name| {
        corpus_ref
            .storage
            .list_node_annotations(name.as_ref(), false, false)
            .map(|annos| {
                annos
                    .into_iter()
                    .map(|anno| anno.key)
                    .filter(|anno_key| anno_key.name == *segmentation)
            })
    });

    let mut anno_keys: BTreeSet<_> = match anno_keys_by_corpus.next() {
        Some(anno_keys) => anno_keys?.collect(),
        None => return Ok(None),
    };

    for anno_keys_of_corpus in anno_keys_by_corpus {
        let mut anno_keys_of_corpus = anno_keys_of_corpus?;
        anno_keys.retain(|anno_key| anno_keys_of_corpus.contains(anno_key));
    }

    Ok(anno_keys.into_iter().next())
}

#[derive(Debug)]
pub(crate) struct AnnoKeyFormat<'a> {
    ambiguous_anno_names: HashSet<&'a str>,
}

impl<'a> AnnoKeyFormat<'a> {
    pub(crate) fn new<I>(anno_keys: I) -> Self
    where
        I: IntoIterator<Item = &'a AnnoKey>,
    {
        Self {
            ambiguous_anno_names: anno_keys
                .into_iter()
                .collect::<HashSet<_>>()
                .into_iter()
                .map(|anno_key| &*anno_key.name)
                .duplicates()
                .collect(),
        }
    }

    pub(crate) fn display(&'a self, anno_key: &'a AnnoKey) -> AnnoKeyDisplay<'a> {
        AnnoKeyDisplay {
            format: self,
            anno_key,
        }
    }
}

#[derive(Debug)]
pub(crate) struct AnnoKeyDisplay<'a> {
    format: &'a AnnoKeyFormat<'a>,
    anno_key: &'a AnnoKey,
}

impl Display for AnnoKeyDisplay<'_> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        if !self.anno_key.ns.is_empty()
            && self
                .format
                .ambiguous_anno_names
                .contains(&*self.anno_key.name)
        {
            write!(f, "{}:{}", self.anno_key.ns, self.anno_key.name)
        } else {
            write!(f, "{}", self.anno_key.name)
        }
    }
}

pub(crate) fn is_doc_anno_key(anno_key: &AnnoKey) -> bool {
    anno_key.ns == ANNIS_NS && anno_key.name == "doc"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anno_key_format() {
        let ambiguous1 = AnnoKey {
            ns: "ns1".into(),
            name: "ambiguous_name".into(),
        };
        let ambiguous2 = AnnoKey {
            ns: "ns2".into(),
            name: "ambiguous_name".into(),
        };
        let unambiguous = AnnoKey {
            ns: "ns1".into(),
            name: "unambiguous_name".into(),
        };
        let empty_ns_ambiguous = AnnoKey {
            ns: "".into(),
            name: "ambiguous_name".into(),
        };
        let empty_ns_unambiguous = AnnoKey {
            ns: "".into(),
            name: "empty_ns_unambiguous_name".into(),
        };

        let format = AnnoKeyFormat::new(
            [
                &ambiguous1,
                &unambiguous,
                &ambiguous2,
                &unambiguous,
                &empty_ns_ambiguous,
                &empty_ns_unambiguous,
            ]
            .into_iter(),
        );

        assert_eq!(
            format.display(&ambiguous1).to_string(),
            "ns1:ambiguous_name"
        );
        assert_eq!(
            format.display(&ambiguous2).to_string(),
            "ns2:ambiguous_name"
        );
        assert_eq!(format.display(&unambiguous).to_string(), "unambiguous_name");
        assert_eq!(
            format.display(&empty_ns_ambiguous).to_string(),
            "ambiguous_name"
        );
        assert_eq!(
            format.display(&empty_ns_unambiguous).to_string(),
            "empty_ns_unambiguous_name"
        );
    }
}
