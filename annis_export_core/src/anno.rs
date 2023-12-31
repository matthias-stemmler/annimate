use crate::{corpus::CorpusRef, error::AnnisExportError};
use graphannis::{errors::GraphAnnisError, model::AnnotationComponentType};
use graphannis_core::{
    graph::{ANNIS_NS, DEFAULT_NS},
    types::AnnoKey,
};

pub(crate) fn segmentations(corpus_ref: CorpusRef) -> Result<Vec<String>, GraphAnnisError> {
    let mut segmentations = Vec::new();

    for c in corpus_ref.storage.list_components(
        corpus_ref.name,
        Some(AnnotationComponentType::Ordering),
        None,
    )? {
        if c.layer == DEFAULT_NS && get_anno_keys_for_segmentation(corpus_ref, &c.name)?.is_some() {
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
        Some(segmentation) => {
            get_anno_keys_for_segmentation(corpus_ref, segmentation)?.ok_or_else(|| {
                AnnisExportError::MissingAnnotationForSegmentation(segmentation.to_string())
            })
        }

        None => Ok(AnnoKey {
            ns: ANNIS_NS.into(),
            name: "tok".into(),
        }),
    }
}

fn get_anno_keys_for_segmentation(
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
