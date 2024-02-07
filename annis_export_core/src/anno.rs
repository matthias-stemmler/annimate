use crate::{corpus::CorpusRef, error::AnnisExportError, node_name::node_name_to_node_id};
use graphannis::{
    corpusstorage::{QueryLanguage, ResultOrder, SearchQuery},
    errors::GraphAnnisError,
    model::AnnotationComponentType,
    AnnotationGraph,
};
use graphannis_core::{
    graph::{ANNIS_NS, DEFAULT_NS},
    types::{AnnoKey, Component, NodeID},
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

    let mut segmentations_present_in_all_corpora: BTreeSet<_> = match segmentations_by_corpus.next()
    {
        Some(segmentations) => segmentations?.collect(),
        None => return Ok(Vec::new()),
    };

    for segmentations in segmentations_by_corpus {
        let mut segmentations = segmentations?;
        segmentations_present_in_all_corpora.retain(|component| segmentations.contains(component));
    }

    segmentations_present_in_all_corpora
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

    let mut anno_keys_present_in_all_corpora: BTreeSet<_> = match anno_keys_by_corpus.next() {
        Some(anno_keys) => anno_keys?.collect(),
        None => return Ok(None),
    };

    for anno_keys in anno_keys_by_corpus {
        let mut anno_keys = anno_keys?;
        anno_keys_present_in_all_corpora.retain(|anno_key| anno_keys.contains(anno_key));
    }

    let mut fallback_anno_key = None;

    for anno_key in anno_keys_present_in_all_corpora {
        if anno_key.ns == DEFAULT_NS {
            return Ok(Some(anno_key));
        }

        fallback_anno_key.get_or_insert(anno_key);
    }

    Ok(fallback_anno_key)
}

pub(crate) fn get_anno(
    graph: &AnnotationGraph,
    node_id: NodeID,
    anno_key: &AnnoKey,
) -> Result<Option<String>, GraphAnnisError> {
    Ok(graph
        .get_node_annos()
        .get_value_for_item(&node_id, anno_key)?
        .map(|s| s.into()))
}

#[derive(Debug)]
pub(crate) struct AnnoKeys {
    corpus_anno_keys: HashSet<AnnoKey>,
    doc_anno_keys: HashSet<AnnoKey>,
    node_anno_keys: HashSet<AnnoKey>,
    format: AnnoKeyFormat,
}

impl AnnoKeys {
    pub(crate) fn new<S>(corpus_ref: CorpusRef<S>) -> Result<Self, GraphAnnisError>
    where
        S: AsRef<str>,
    {
        let corpus_anno_keys: HashSet<_> = corpus_ref
            .names
            .iter()
            .map::<Result<_, GraphAnnisError>, _>(|corpus_name| {
                let corpus_name = corpus_name.as_ref();
                let graph = corpus_ref.storage.corpus_graph(corpus_name)?;
                let corpus_node_id = node_name_to_node_id(&graph, corpus_name)?;
                Ok(graph
                    .get_node_annos()
                    .get_all_keys_for_item(&corpus_node_id, None, None)?
                    .into_iter()
                    .map(|anno_key| (*anno_key).clone()))
            })
            .flatten_ok()
            .try_collect()?;

        let all_anno_keys: HashSet<_> = corpus_ref
            .names
            .iter()
            .map::<Result<_, GraphAnnisError>, _>(|corpus_name| {
                Ok(corpus_ref
                    .storage
                    .list_node_annotations(corpus_name.as_ref(), false, false)?
                    .into_iter()
                    .map(|a| a.key))
            })
            .flatten_ok()
            .try_collect()?;

        // Anno keys with name "tok" are invalid in AQL queries (when qualified with a namespace),
        // so we just assume those don't appear on the corpus and document levels, but they do appear on the node level

        let doc_anno_keys = filter_anno_keys_by_query(
            corpus_ref,
            all_anno_keys
                .iter()
                .filter(|anno_key| anno_key.name != "tok"),
            |anno_key| {
                format!(
                    "annis:node_type=\"corpus\" _ident_ annis:doc _ident_ {}",
                    AnnoKeyDisplay::fully_qualified(anno_key)
                )
            },
        )?;

        let mut node_anno_keys = filter_anno_keys_by_query(
            corpus_ref,
            all_anno_keys
                .iter()
                .filter(|anno_key| anno_key.name != "tok"),
            |anno_key| {
                format!(
                    "annis:node_type!=\"corpus\" _ident_ {}",
                    AnnoKeyDisplay::fully_qualified(anno_key)
                )
            },
        )?;

        node_anno_keys.extend(
            all_anno_keys
                .iter()
                .filter(|anno_key| anno_key.name == "tok")
                .cloned(),
        );

        let format = AnnoKeyFormat::new(all_anno_keys);

        Ok(Self {
            corpus_anno_keys,
            doc_anno_keys,
            node_anno_keys,
            format,
        })
    }

    pub(crate) fn format(&self) -> &AnnoKeyFormat {
        &self.format
    }

    pub(crate) fn into_exportable(self) -> ExportableAnnoKeys {
        let map = |anno_keys: HashSet<AnnoKey>| {
            anno_keys
                .into_iter()
                .map(|anno_key| ExportableAnnoKey {
                    display_name: self.format.display(&anno_key).to_string(),
                    anno_key,
                })
                .sorted_by(|a, b| a.display_name.cmp(&b.display_name))
                .collect()
        };

        ExportableAnnoKeys {
            corpus: map(self.corpus_anno_keys),
            doc: map(self.doc_anno_keys),
            node: map(self.node_anno_keys),
        }
    }
}

fn filter_anno_keys_by_query<'a, F, I, S>(
    corpus_ref: CorpusRef<S>,
    anno_keys: I,
    mut get_query: F,
) -> Result<HashSet<AnnoKey>, GraphAnnisError>
where
    F: FnMut(&AnnoKey) -> String,
    I: IntoIterator<Item = &'a AnnoKey>,
    S: AsRef<str>,
{
    anno_keys
        .into_iter()
        .map(|anno_key| {
            has_match(corpus_ref, &get_query(anno_key)).map(|has_match| (anno_key, has_match))
        })
        .filter_map_ok(|(anno_key, has_match)| has_match.then_some(anno_key.clone()))
        .try_collect()
}

fn has_match<S>(corpus_ref: CorpusRef<S>, query: &str) -> Result<bool, GraphAnnisError>
where
    S: AsRef<str>,
{
    let matches = corpus_ref.storage.find(
        SearchQuery {
            corpus_names: corpus_ref.names,
            query,
            query_language: QueryLanguage::AQL,
            timeout: None,
        },
        0,
        Some(1),
        ResultOrder::NotSorted,
    )?;

    Ok(!matches.is_empty())
}

#[derive(Debug)]
pub(crate) struct AnnoKeyFormat {
    ambiguous_names: HashSet<String>,
}

impl AnnoKeyFormat {
    pub(crate) fn new<I>(anno_keys: I) -> Self
    where
        I: IntoIterator<Item = AnnoKey>,
    {
        Self {
            ambiguous_names: anno_keys
                .into_iter()
                .collect::<HashSet<_>>()
                .into_iter()
                .map(|anno_key| anno_key.name.to_string())
                .duplicates()
                .collect(),
        }
    }

    pub(crate) fn display<'a>(&'a self, anno_key: &'a AnnoKey) -> AnnoKeyDisplay<'a> {
        if self.ambiguous_names.contains(&*anno_key.name) {
            AnnoKeyDisplay::fully_qualified(anno_key)
        } else {
            AnnoKeyDisplay::name_only(anno_key)
        }
    }
}

#[derive(Debug)]
pub(crate) struct AnnoKeyDisplay<'a> {
    name: &'a str,
    ns: Option<&'a str>,
}

impl<'a> AnnoKeyDisplay<'a> {
    fn fully_qualified(anno_key: &'a AnnoKey) -> Self {
        Self {
            name: &anno_key.name,
            ns: (!anno_key.ns.is_empty()).then_some(&anno_key.ns),
        }
    }

    fn name_only(anno_key: &'a AnnoKey) -> Self {
        Self {
            name: &anno_key.name,
            ns: None,
        }
    }
}

impl Display for AnnoKeyDisplay<'_> {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match (self.ns, self.name) {
            (Some(ns), name) => write!(f, "{ns}:{name}"),
            (None, name) => write!(f, "{name}"),
        }
    }
}

#[derive(Debug)]
pub struct ExportableAnnoKeys {
    pub corpus: Vec<ExportableAnnoKey>,
    pub doc: Vec<ExportableAnnoKey>,
    pub node: Vec<ExportableAnnoKey>,
}

#[derive(Debug)]
pub struct ExportableAnnoKey {
    pub anno_key: AnnoKey,
    pub display_name: String,
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
                ambiguous1.clone(),
                unambiguous.clone(),
                ambiguous2.clone(),
                unambiguous.clone(),
                empty_ns_ambiguous.clone(),
                empty_ns_unambiguous.clone(),
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
