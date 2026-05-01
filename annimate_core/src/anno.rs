use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::fmt::{self, Display, Formatter};
use std::sync::LazyLock;

use graphannis::corpusstorage::{QueryLanguage, ResultOrder, SearchQuery};
use graphannis::errors::GraphAnnisError;
use graphannis::model::{AnnotationComponent, AnnotationComponentType};
use graphannis::{AnnotationGraph, CorpusStorage, util};
use graphannis_core::graph::{ANNIS_NS, DEFAULT_NS, NODE_NAME};
use graphannis_core::types::{AnnoKey, Component, NodeID};
use itertools::Itertools;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::cache::{CacheStorage, EdgeAnnoKeyInfo, NodeAnnoKeyInfo};
use crate::error::AnnimateError;
use crate::name;

pub(crate) const DOC: &str = "doc";
pub(crate) const TOK: &str = "tok";

pub(crate) static TOKEN_ANNO_KEY: LazyLock<AnnoKey> = LazyLock::new(|| AnnoKey {
    ns: ANNIS_NS.into(),
    name: TOK.into(),
});

pub(crate) static DEFAULT_ORDERING_COMPONENT: LazyLock<AnnotationComponent> = LazyLock::new(|| {
    Component::new(
        AnnotationComponentType::Ordering,
        ANNIS_NS.into(),
        "".into(),
    )
});

pub(crate) static GAP_ORDERING_COMPONENT: LazyLock<AnnotationComponent> = LazyLock::new(|| {
    Component::new(
        AnnotationComponentType::Ordering,
        ANNIS_NS.into(),
        "datasource-gap".into(),
    )
});

const CTYPES_WITH_ANNOS: [AnnotationComponentType; 2] = [
    AnnotationComponentType::Dominance,
    AnnotationComponentType::Pointing,
];

pub(crate) fn segmentations<S>(
    corpus_storage: &CorpusStorage,
    cache_storage: &CacheStorage,
    corpus_names: &[S],
) -> Result<Vec<String>, GraphAnnisError>
where
    S: AsRef<str>,
{
    let mut segmentations_by_corpus = corpus_names.iter().map(|corpus_name| {
        corpus_storage
            .list_components(
                corpus_name.as_ref(),
                Some(AnnotationComponentType::Ordering),
                None,
            )
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
        .map(|segmentation| {
            get_anno_key_for_segmentation_if_exists(
                corpus_storage,
                cache_storage,
                corpus_names,
                &segmentation,
            )
            .map(|anno_key| (segmentation, anno_key))
        })
        .filter_map_ok(|(segmentation, anno_key)| anno_key.is_some().then_some(segmentation))
        .collect()
}

/// Returns the [`AnnoKey`] corresponding to the given segmentation.
///
/// This finds an [`AnnoKey`] of the same name as the given segmentation. An [`AnnoKey`] of
/// namespace `default_ns` is preferred if it exists, otherwise the first one in the alphabetical
/// order is returned. If the given segmentation is `None`, then `annis:tok` is returned.
pub(crate) fn get_anno_key_for_segmentation<S>(
    corpus_storage: &CorpusStorage,
    cache_storage: &CacheStorage,
    corpus_names: &[S],
    segmentation: Option<&str>,
) -> Result<AnnoKey, AnnimateError>
where
    S: AsRef<str>,
{
    match segmentation {
        Some(segmentation) => get_anno_key_for_segmentation_if_exists(
            corpus_storage,
            cache_storage,
            corpus_names,
            segmentation,
        )?
        .ok_or_else(|| AnnimateError::MissingAnnotationForSegmentation(segmentation.to_string())),

        None => Ok(TOKEN_ANNO_KEY.clone()),
    }
}

fn get_anno_key_for_segmentation_if_exists<S>(
    corpus_storage: &CorpusStorage,
    cache_storage: &CacheStorage,
    corpus_names: &[S],
    segmentation: &str,
) -> Result<Option<AnnoKey>, GraphAnnisError>
where
    S: AsRef<str>,
{
    let mut anno_keys_by_corpus = corpus_names.iter().map(|corpus_name| {
        get_node_anno_key_infos(corpus_storage, cache_storage, corpus_name.as_ref()).map(
            |node_anno_key_infos| {
                node_anno_key_infos
                    .into_iter()
                    .filter_map(|node_anno_key_info| {
                        (node_anno_key_info.anno_key.name == *segmentation)
                            .then_some(node_anno_key_info.anno_key)
                    })
            },
        )
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

pub(crate) fn exportable_edge_types<S>(
    corpus_storage: &CorpusStorage,
    corpus_names: &[S],
) -> Result<Vec<ExportableEdgeType>, GraphAnnisError>
where
    S: AsRef<str>,
{
    let mut exportable_edge_types = BTreeSet::new();

    for (corpus_name, ctype) in corpus_names.iter().cartesian_product(CTYPES_WITH_ANNOS) {
        let components = corpus_storage.list_components(corpus_name.as_ref(), Some(ctype), None)?;

        exportable_edge_types.extend(components.into_iter().map(|component| ExportableEdgeType {
            ctype: component.get_type(),
            name: component.name,
        }));
    }

    Ok(exportable_edge_types.into_iter().collect())
}

/// Information about which edge types and annotations are available for export.
#[derive(Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct ExportableEdgeType {
    ctype: AnnotationComponentType,
    name: String,
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

/// Manages available node [`AnnoKey`]s on different levels (corpus, document, node).
///
/// The combined annotations on the corpus and document levels are what ANNIS calls "meta
/// annotations". On a node level, *all* annotations are included.
#[derive(Debug)]
pub(crate) struct NodeAnnoKeys {
    corpus_anno_keys: HashSet<AnnoKey>,
    doc_anno_keys: HashSet<AnnoKey>,
    node_anno_keys: HashSet<AnnoKey>,
    format: AnnoKeyFormat,
}

impl NodeAnnoKeys {
    pub(crate) fn new<S>(
        corpus_storage: &CorpusStorage,
        cache_storage: &CacheStorage,
        corpus_names: &[S],
    ) -> Result<Self, AnnimateError>
    where
        S: AsRef<str>,
    {
        let mut all_anno_keys = HashSet::new();
        let mut corpus_anno_keys = HashSet::new();
        let mut doc_anno_keys = HashSet::new();

        for corpus_name in corpus_names {
            for NodeAnnoKeyInfo {
                anno_key,
                is_corpus,
                is_document,
            } in get_node_anno_key_infos(corpus_storage, cache_storage, corpus_name.as_ref())?
            {
                if is_corpus {
                    corpus_anno_keys.insert(anno_key.clone());
                }

                if is_document {
                    doc_anno_keys.insert(anno_key.clone());
                }

                all_anno_keys.insert(anno_key);
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

    pub(crate) fn into_exportable(self) -> ExportableNodeAnnoKeys {
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

        ExportableNodeAnnoKeys {
            corpus: map(self.corpus_anno_keys),
            doc: map(self.doc_anno_keys),
            node: map(self.node_anno_keys),
        }
    }
}

pub(crate) fn prefill_cache(
    corpus_storage: &CorpusStorage,
    cache_storage: &CacheStorage,
    corpus_name: &str,
) -> Result<(), GraphAnnisError> {
    get_node_anno_key_infos(corpus_storage, cache_storage, corpus_name)?;
    get_edge_anno_key_infos(corpus_storage, cache_storage, corpus_name)?;
    Ok(())
}

fn get_node_anno_key_infos(
    corpus_storage: &CorpusStorage,
    cache_storage: &CacheStorage,
    corpus_name: &str,
) -> Result<Vec<NodeAnnoKeyInfo>, GraphAnnisError> {
    cache_storage.get_node_anno_key_infos(corpus_name, || {
        let all_anno_keys: BTreeSet<_> = corpus_storage
            .list_node_annotations(corpus_name, false, false)?
            .into_iter()
            .map(|anno| anno.key)
            .collect();

        let mut corpus_anno_keys = HashSet::new();
        let mut doc_anno_keys = HashSet::new();

        let corpus_or_doc_match_ids = corpus_storage.find(
            SearchQuery {
                corpus_names: &[corpus_name],
                // Matches both the corpus node and all document nodes
                query: "annis:node_type=\"corpus\"",
                query_language: QueryLanguage::AQL,
                timeout: None,
            },
            0,
            None,
            ResultOrder::NotSorted,
        )?;

        let graph = corpus_storage.corpus_graph(corpus_name)?;

        for corpus_or_doc_match_id in corpus_or_doc_match_ids {
            let Some(node_name) = util::node_names_from_match(&corpus_or_doc_match_id)
                .into_iter()
                .next()
            else {
                continue;
            };
            let node_id = name::node_name_to_node_id(&graph, &node_name)?;
            let anno_keys = graph
                .get_node_annos()
                .get_all_keys_for_item(&node_id, None, None)?;

            if anno_keys.iter().any(|anno_key| is_doc_anno_key(anno_key)) {
                doc_anno_keys.extend(anno_keys);
            } else {
                corpus_anno_keys.extend(anno_keys);
            }
        }

        let node_anno_key_infos = all_anno_keys
            .into_iter()
            .map(|anno_key| {
                let is_corpus = corpus_anno_keys.iter().any(|key| **key == anno_key);
                let is_document = doc_anno_keys.iter().any(|key| **key == anno_key);

                NodeAnnoKeyInfo {
                    anno_key,
                    is_corpus,
                    is_document,
                }
            })
            .collect();

        Ok(node_anno_key_infos)
    })
}

fn get_edge_anno_key_infos(
    corpus_storage: &CorpusStorage,
    cache_storage: &CacheStorage,
    corpus_name: &str,
) -> Result<Vec<EdgeAnnoKeyInfo>, GraphAnnisError> {
    cache_storage.get_edge_anno_key_infos(corpus_name, || {
        let mut anno_keys_with_components: BTreeMap<AnnoKey, BTreeSet<AnnotationComponent>> =
            BTreeMap::new();

        for ctype in CTYPES_WITH_ANNOS {
            for component in corpus_storage.list_components(corpus_name, Some(ctype), None)? {
                let annos =
                    corpus_storage.list_edge_annotations(corpus_name, &component, false, false)?;

                for anno in annos {
                    anno_keys_with_components
                        .entry(anno.key)
                        .or_default()
                        .insert(component.clone());
                }
            }
        }

        Ok(anno_keys_with_components
            .into_iter()
            .map(|(anno_key, components)| EdgeAnnoKeyInfo {
                anno_key,
                component_descriptions: components.into_iter().map(|c| c.to_string()).collect(),
            })
            .collect())
    })
}

#[derive(Debug)]
pub(crate) struct AnnoKeyFormat {
    ambiguous_names: HashSet<String>,
}

impl AnnoKeyFormat {
    pub(crate) fn new(anno_keys: &HashSet<AnnoKey>) -> Self {
        Self {
            ambiguous_names: anno_keys
                .iter()
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

/// Information about which node annotation keys are available for export.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportableNodeAnnoKeys {
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

/// The annotation key to use for a "Match in context" column.
#[derive(Clone, Debug, Eq, Hash, PartialEq)]
pub enum AnnoKeyOrDefault {
    /// Use the given [`AnnoKey`].
    AnnoKey(AnnoKey),
    /// Use the default [`AnnoKey`] for the given segmentation.
    Default,
}

impl AnnoKeyOrDefault {
    pub(crate) const TAG_DEFAULT: &str = "default";
}

impl Serialize for AnnoKeyOrDefault {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::AnnoKey(anno_key) => anno_key.serialize(serializer),
            Self::Default => Self::TAG_DEFAULT.serialize(serializer),
        }
    }
}

impl<'de> Deserialize<'de> for AnnoKeyOrDefault {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Helper<'a> {
            AnnoKey(AnnoKey),
            Default(&'a str),
        }

        match Helper::deserialize(deserializer)? {
            Helper::AnnoKey(anno_key) => Ok(Self::AnnoKey(anno_key)),
            Helper::Default(Self::TAG_DEFAULT) => Ok(Self::Default),
            Helper::Default(s) => Err(serde::de::Error::custom(format!(
                "expected \"{}\" or an annotation key, found {s:?}",
                Self::TAG_DEFAULT
            ))),
        }
    }
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
    fn exportable_edge_type_ord_orders_dominance_before_pointing_then_by_name() {
        let mut exportable_edge_types = vec![
            ExportableEdgeType {
                ctype: AnnotationComponentType::Pointing,
                name: "b".into(),
            },
            ExportableEdgeType {
                ctype: AnnotationComponentType::Dominance,
                name: "b".into(),
            },
            ExportableEdgeType {
                ctype: AnnotationComponentType::Dominance,
                name: "".into(),
            },
            ExportableEdgeType {
                ctype: AnnotationComponentType::Pointing,
                name: "a".into(),
            },
            ExportableEdgeType {
                ctype: AnnotationComponentType::Dominance,
                name: "a".into(),
            },
        ];

        exportable_edge_types.sort();

        assert_eq!(
            exportable_edge_types,
            vec![
                ExportableEdgeType {
                    ctype: AnnotationComponentType::Dominance,
                    name: "".into(),
                },
                ExportableEdgeType {
                    ctype: AnnotationComponentType::Dominance,
                    name: "a".into(),
                },
                ExportableEdgeType {
                    ctype: AnnotationComponentType::Dominance,
                    name: "b".into(),
                },
                ExportableEdgeType {
                    ctype: AnnotationComponentType::Pointing,
                    name: "a".into(),
                },
                ExportableEdgeType {
                    ctype: AnnotationComponentType::Pointing,
                    name: "b".into(),
                },
            ]
        )
    }

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
            &[
                ambiguous1.clone(),
                unambiguous.clone(),
                ambiguous2.clone(),
                unambiguous.clone(),
                empty_ns_ambiguous.clone(),
                empty_ns_unambiguous.clone(),
            ]
            .into_iter()
            .collect(),
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
