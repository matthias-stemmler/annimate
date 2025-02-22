use std::collections::{BTreeSet, HashSet};
use std::fmt::{self, Display, Formatter};
use std::sync::LazyLock;

use graphannis::AnnotationGraph;
use graphannis::corpusstorage::{QueryLanguage, ResultOrder, SearchQuery};
use graphannis::errors::GraphAnnisError;
use graphannis::model::AnnotationComponentType;
use graphannis::util::node_names_from_match;
use graphannis_core::graph::{ANNIS_NS, DEFAULT_NS, NODE_NAME};
use graphannis_core::types::{AnnoKey, Component, NodeID};
use itertools::Itertools;
use serde::Serialize;

use crate::corpus::CorpusRef;
use crate::error::AnnimateError;
use crate::node_name;

pub(crate) const DOC: &str = "doc";
pub(crate) const TOK: &str = "tok";

pub(crate) static TOKEN_ANNO_KEY: LazyLock<AnnoKey> = LazyLock::new(|| AnnoKey {
    ns: ANNIS_NS.into(),
    name: TOK.into(),
});

pub(crate) static DEFAULT_ORDERING_COMPONENT: LazyLock<Component<AnnotationComponentType>> =
    LazyLock::new(|| {
        Component::new(
            AnnotationComponentType::Ordering,
            ANNIS_NS.into(),
            "".into(),
        )
    });

pub(crate) static GAP_ORDERING_COMPONENT: LazyLock<Component<AnnotationComponentType>> =
    LazyLock::new(|| {
        Component::new(
            AnnotationComponentType::Ordering,
            ANNIS_NS.into(),
            "datasource-gap".into(),
        )
    });

pub(crate) fn segmentations<S>(corpus_ref: CorpusRef<'_, S>) -> Result<Vec<String>, GraphAnnisError>
where
    S: AsRef<str>,
{
    let mut segmentations_by_corpus = corpus_ref.names.iter().map(|name| {
        corpus_ref
            .storage
            .list_components(name.as_ref(), Some(AnnotationComponentType::Ordering), None)
            .map(|components| {
                components.into_iter().filter_map(|component| {
                    // This is the same filter that ANNIS applies to provide the list of
                    // segmentations
                    (component.layer != ANNIS_NS && !component.name.is_empty())
                        .then_some(component.name)
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

/// Returns the [`AnnoKey`] corresponding to the given segmentation.
///
/// This finds an [`AnnoKey`] of the same name as the given segmentation. An [`AnnoKey`] of
/// namespace `default_ns` is preferred if it exists, otherwise the first one in the alphabetical
/// order is returned. If the given segmentation is `None`, then `annis:tok` is returned.
pub(crate) fn get_anno_key_for_segmentation<S>(
    corpus_ref: CorpusRef<'_, S>,
    segmentation: Option<&str>,
) -> Result<AnnoKey, AnnimateError>
where
    S: AsRef<str>,
{
    match segmentation {
        Some(segmentation) => get_anno_key_for_segmentation_if_exists(corpus_ref, segmentation)?
            .ok_or_else(|| {
                AnnimateError::MissingAnnotationForSegmentation(segmentation.to_string())
            }),

        None => Ok(TOKEN_ANNO_KEY.clone()),
    }
}

fn get_anno_key_for_segmentation_if_exists<S>(
    corpus_ref: CorpusRef<'_, S>,
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

/// Manages available [`AnnoKey`]s on different levels (corpus, document, node).
///
/// The combined annotations on the corpus and document levels are what ANNIS calls "meta
/// annotations". On a node level, *all* annotations are included.
#[derive(Debug)]
pub(crate) struct AnnoKeys {
    corpus_anno_keys: HashSet<AnnoKey>,
    doc_anno_keys: HashSet<AnnoKey>,
    node_anno_keys: HashSet<AnnoKey>,
    format: AnnoKeyFormat,
}

impl AnnoKeys {
    pub(crate) fn new<S>(corpus_ref: CorpusRef<'_, S>) -> Result<Self, AnnimateError>
    where
        S: AsRef<str>,
    {
        let mut all_anno_keys = HashSet::new();
        let mut corpus_anno_keys = HashSet::new();
        let mut doc_anno_keys = HashSet::new();

        for corpus_name in corpus_ref.names {
            let corpus_name = corpus_name.as_ref();

            all_anno_keys.extend(
                corpus_ref
                    .storage
                    .list_node_annotations(corpus_name.as_ref(), false, false)?
                    .into_iter()
                    .map(|anno| anno.key),
            );

            let graph = corpus_ref.storage.corpus_graph(corpus_name)?;

            // We assume that the name of the corpus node is the same as the corpus name
            let corpus_node_id = node_name::node_name_to_node_id(&graph, corpus_name)?;

            corpus_anno_keys.extend(
                graph
                    .get_node_annos()
                    .get_all_keys_for_item(&corpus_node_id, None, None)?
                    .into_iter()
                    .map(|anno_key| (*anno_key).clone()),
            );

            let doc_match_ids = corpus_ref.storage.find(
                SearchQuery {
                    corpus_names: &[corpus_name],
                    query: "annis:node_type=\"corpus\" _ident_ annis:doc",
                    query_language: QueryLanguage::AQL,
                    timeout: None,
                },
                0,
                None,
                ResultOrder::NotSorted,
            )?;

            for doc_match_id in doc_match_ids {
                let Some(doc_node_name) = node_names_from_match(&doc_match_id).into_iter().next()
                else {
                    continue;
                };

                let doc_node_id = node_name::node_name_to_node_id(&graph, &doc_node_name)?;
                doc_anno_keys.extend(
                    graph
                        .get_node_annos()
                        .get_all_keys_for_item(&doc_node_id, None, None)?
                        .into_iter()
                        .map(|anno_key| (*anno_key).clone()),
                );
            }
        }

        let format = AnnoKeyFormat::new(&all_anno_keys);

        Ok(Self {
            corpus_anno_keys,
            doc_anno_keys,
            node_anno_keys: all_anno_keys,
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

#[derive(Debug)]
pub(crate) struct AnnoKeyFormat {
    ambiguous_names: HashSet<String>,
}

impl AnnoKeyFormat {
    pub(crate) fn new<'a, I>(anno_keys: I) -> Self
    where
        I: IntoIterator<Item = &'a AnnoKey>,
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

/// Information about which annotation keys are available for export.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportableAnnoKeys {
    corpus: Vec<ExportableAnnoKey>,
    doc: Vec<ExportableAnnoKey>,
    node: Vec<ExportableAnnoKey>,
}

/// An annotation key that can be exported.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportableAnnoKey {
    anno_key: AnnoKey,
    display_name: String,
}

pub(crate) fn is_doc_anno_key(anno_key: &AnnoKey) -> bool {
    anno_key.ns == ANNIS_NS && anno_key.name == DOC
}

pub(crate) fn is_node_name_anno_key(anno_key: &AnnoKey) -> bool {
    anno_key.ns == ANNIS_NS && anno_key.name == NODE_NAME
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

        let format = AnnoKeyFormat::new(&[
            ambiguous1.clone(),
            unambiguous.clone(),
            ambiguous2.clone(),
            unambiguous.clone(),
            empty_ns_ambiguous.clone(),
            empty_ns_unambiguous.clone(),
        ]);

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
