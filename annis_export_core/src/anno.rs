use std::sync::OnceLock;

use crate::{corpus::CorpusRef, error::AnnisExportError};
use graphannis::{errors::GraphAnnisError, model::AnnotationComponentType};
use graphannis_core::{
    graph::{ANNIS_NS, DEFAULT_NS},
    types::{AnnoKey, Component},
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

pub(crate) fn segmentations(corpus_ref: CorpusRef) -> Result<Vec<String>, GraphAnnisError> {
    let mut segmentations = Vec::new();

    for c in corpus_ref.storage.list_components(
        corpus_ref.name,
        Some(AnnotationComponentType::Ordering),
        None,
    )? {
        if c.layer == DEFAULT_NS
            && get_anno_key_for_segmentation_if_exists(corpus_ref, &c.name)?.is_some()
        {
            segmentations.push(c.name.into());
        }
    }

    segmentations.sort_unstable();

    Ok(segmentations)
}

pub(crate) fn get_anno_key_for_segmentation(
    corpus_ref: CorpusRef,
    segmentation: Option<&str>,
) -> Result<AnnoKey, AnnisExportError> {
    match segmentation {
        Some(segmentation) => get_anno_key_for_segmentation_if_exists(corpus_ref, segmentation)?
            .ok_or_else(|| {
                AnnisExportError::MissingAnnotationForSegmentation(segmentation.to_string())
            }),

        None => Ok(token_anno_key().clone()),
    }
}

fn get_anno_key_for_segmentation_if_exists(
    corpus_ref: CorpusRef,
    segmentation: &str,
) -> Result<Option<AnnoKey>, GraphAnnisError> {
    Ok(corpus_ref
        .storage
        .list_node_annotations(corpus_ref.name, false, false)?
        .into_iter()
        .map(|anno| anno.key)
        .filter(|anno_key| anno_key.name == *segmentation)
        .min_by(|a, b| a.ns.cmp(&b.ns)))
}
