use std::fs;
use std::path::Path;

use annimate_core::Storage;
use graphannis::model::AnnotationComponentType;
use graphannis::update::{GraphUpdate, UpdateEvent};
use graphannis_core::graph::DEFAULT_NS;
use itertools::Itertools;
use serde::Deserialize;

const DB_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/cache/db");

#[test]
fn caching_exportable_node_anno_keys_and_segmentations() {
    let db_dir = Path::new(DB_DIR).join("caching_exportable_node_anno_keys_and_segmentations");
    let _ = fs::remove_dir_all(&db_dir);

    create_corpus(&db_dir, "test_corpus");
    add_ordering_component(&db_dir, "test_corpus", "test_segmentation_1");
    add_ordering_component(&db_dir, "test_corpus", "test_segmentation_2");
    add_node_anno(&db_dir, "test_corpus", "test_segmentation_1");

    assert_eq!(
        get_exportable_node_anno_keys(&db_dir, "test_corpus"),
        ["node_name", "node_type", "test_segmentation_1"]
    );
    assert_eq!(
        get_segmentations(&db_dir, "test_corpus"),
        ["test_segmentation_1"]
    );

    add_node_anno(&db_dir, "test_corpus", "test_segmentation_2");

    // `test_segmentation_2` not included -> annotations are served from cache
    assert_eq!(
        get_exportable_node_anno_keys(&db_dir, "test_corpus"),
        ["node_name", "node_type", "test_segmentation_1"]
    );
    assert_eq!(
        get_segmentations(&db_dir, "test_corpus"),
        ["test_segmentation_1"]
    );

    delete_corpus(&db_dir, "test_corpus");
    create_corpus(&db_dir, "test_corpus");

    // No custom data -> cache has been cleared
    assert_eq!(
        get_exportable_node_anno_keys(&db_dir, "test_corpus"),
        ["node_name", "node_type"]
    );
    assert!(get_segmentations(&db_dir, "test_corpus").is_empty());
}

#[test]
fn caching_exportable_edge_types() {
    let db_dir = Path::new(DB_DIR).join("caching_exportable_edge_types");
    let _ = fs::remove_dir_all(&db_dir);

    create_corpus(&db_dir, "test_corpus");
    add_dominance_component(&db_dir, "test_corpus", "test_dominance_1");
    add_dominance_edge_anno(&db_dir, "test_corpus", "test_dominance_1", "test_anno_1_a");

    assert_eq!(
        get_exportable_edge_types(&db_dir, "test_corpus"),
        [("test_dominance_1".into(), vec!["test_anno_1_a".into()])]
    );

    add_dominance_component(&db_dir, "test_corpus", "test_dominance_2");
    add_dominance_edge_anno(&db_dir, "test_corpus", "test_dominance_1", "test_anno_1_b");
    add_dominance_edge_anno(&db_dir, "test_corpus", "test_dominance_2", "test_anno_2_a");

    // `test_dominance_2` included -> components are not served from cache
    // `test_anno_1_b`, `test_anno_2_a` not included -> annotations are served from cache
    assert_eq!(
        get_exportable_edge_types(&db_dir, "test_corpus"),
        [
            ("test_dominance_1".into(), vec!["test_anno_1_a".into()]),
            ("test_dominance_2".into(), vec![])
        ]
    );

    delete_corpus(&db_dir, "test_corpus");
    create_corpus(&db_dir, "test_corpus");

    // No custom data -> cache has been cleared
    assert_eq!(get_exportable_edge_types(&db_dir, "test_corpus"), []);
}

#[test]
fn deleted_corpus_is_evicted_from_memory_cache() {
    let db_dir = Path::new(DB_DIR).join("deleted_corpus_is_evicted_from_memory_cache");
    let _ = fs::remove_dir_all(&db_dir);

    create_corpus(&db_dir, "test_corpus");
    add_ordering_component(&db_dir, "test_corpus", "test_segmentation");
    add_node_anno(&db_dir, "test_corpus", "test_segmentation");

    let storage = Storage::from_db_dir(db_dir.clone()).unwrap();

    // Fill cache
    storage.exportable_node_anno_keys(&["test_corpus"]).unwrap();

    storage.delete_corpus("test_corpus").unwrap();

    // Corpus not found -> corpus has been evicted from in-memory cache
    assert!(storage.exportable_node_anno_keys(&["test_corpus"]).is_err());
}

#[test]
fn corpus_name_encoding() {
    let db_dir = Path::new(DB_DIR).join("corpus_name_encoding");
    let _ = fs::remove_dir_all(&db_dir);

    // Generate corpus names with many special characters
    // Note that this will include whitespace.
    // Whitespace in _node names_, while technically valid, breaks node search,
    // but since for the corpus root node, we use a fixed name rather than the corpus name,
    // we're fine here.
    let corpus_names: Vec<String> = (0..0xFF)
        .filter_map(char::from_u32)
        .chunks(16)
        .into_iter()
        .map(|chunk| chunk.collect())
        .collect();

    for corpus_name in corpus_names {
        create_corpus(&db_dir, &corpus_name);
        add_ordering_component(&db_dir, &corpus_name, "test_segmentation");
        add_node_anno(&db_dir, &corpus_name, "test_segmentation");

        // No errors -> cache was created successfully
        assert_eq!(
            get_exportable_node_anno_keys(&db_dir, &corpus_name),
            ["node_name", "node_type", "test_segmentation"]
        );
        assert_eq!(
            get_segmentations(&db_dir, &corpus_name),
            ["test_segmentation"]
        );

        delete_corpus(&db_dir, &corpus_name);
        create_corpus(&db_dir, &corpus_name);

        // No custom data -> cache has been cleared, so it was created in the correct folder
        assert_eq!(
            get_exportable_node_anno_keys(&db_dir, &corpus_name),
            ["node_name", "node_type"]
        );
        assert!(get_segmentations(&db_dir, &corpus_name).is_empty());
    }
}

const CORPUS_NODE_NAME: &str = "corpus-node";
const OTHER_NODE_NAME: &str = "other-node";

fn create_corpus(db_dir: &Path, corpus_name: &str) {
    let corpus_storage = graphannis::CorpusStorage::with_auto_cache_size(db_dir, true).unwrap();

    corpus_storage
        .create_empty_corpus(corpus_name, true)
        .unwrap();

    let mut update = GraphUpdate::new();
    update
        .add_event(UpdateEvent::AddNode {
            node_name: CORPUS_NODE_NAME.into(),
            node_type: "corpus".into(),
        })
        .unwrap();
    update
        .add_event(UpdateEvent::AddNode {
            node_name: OTHER_NODE_NAME.into(),
            node_type: "node".into(),
        })
        .unwrap();
    corpus_storage
        .apply_update(corpus_name, &mut update)
        .unwrap();
}

fn add_ordering_component(db_dir: &Path, corpus_name: &str, component_name: &str) {
    add_component(
        db_dir,
        corpus_name,
        AnnotationComponentType::Ordering,
        component_name,
    );
}

fn add_dominance_component(db_dir: &Path, corpus_name: &str, component_name: &str) {
    add_component(
        db_dir,
        corpus_name,
        AnnotationComponentType::Dominance,
        component_name,
    );
}

fn add_component(
    db_dir: &Path,
    corpus_name: &str,
    ctype: AnnotationComponentType,
    component_name: &str,
) {
    let corpus_storage = graphannis::CorpusStorage::with_auto_cache_size(db_dir, true).unwrap();

    let mut update = GraphUpdate::new();
    update
        .add_event(UpdateEvent::AddEdge {
            source_node: CORPUS_NODE_NAME.into(),
            target_node: OTHER_NODE_NAME.into(),
            layer: DEFAULT_NS.into(),
            component_type: ctype.to_string(),
            component_name: component_name.into(),
        })
        .unwrap();
    corpus_storage
        .apply_update(corpus_name, &mut update)
        .unwrap();
}

fn add_node_anno(db_dir: &Path, corpus_name: &str, anno_name: &str) {
    let corpus_storage = graphannis::CorpusStorage::with_auto_cache_size(db_dir, true).unwrap();

    let mut update = GraphUpdate::new();
    update
        .add_event(UpdateEvent::AddNodeLabel {
            node_name: CORPUS_NODE_NAME.into(),
            anno_ns: DEFAULT_NS.into(),
            anno_name: anno_name.into(),
            anno_value: "".into(),
        })
        .unwrap();

    corpus_storage
        .apply_update(corpus_name, &mut update)
        .unwrap();
}

fn add_dominance_edge_anno(
    db_dir: &Path,
    corpus_name: &str,
    component_name: &str,
    anno_name: &str,
) {
    let corpus_storage = graphannis::CorpusStorage::with_auto_cache_size(db_dir, true).unwrap();

    let mut update = GraphUpdate::new();
    update
        .add_event(UpdateEvent::AddEdgeLabel {
            source_node: CORPUS_NODE_NAME.into(),
            target_node: OTHER_NODE_NAME.into(),
            layer: DEFAULT_NS.into(),
            component_type: AnnotationComponentType::Dominance.to_string(),
            component_name: component_name.into(),
            anno_ns: DEFAULT_NS.into(),
            anno_name: anno_name.into(),
            anno_value: "".into(),
        })
        .unwrap();

    corpus_storage
        .apply_update(corpus_name, &mut update)
        .unwrap();
}

fn delete_corpus(db_dir: &Path, corpus_name: &str) {
    let corpus_storage = graphannis::CorpusStorage::with_auto_cache_size(db_dir, true).unwrap();
    corpus_storage.delete(corpus_name).unwrap();
}

fn get_exportable_node_anno_keys(db_dir: &Path, corpus_name: &str) -> Vec<String> {
    let storage = Storage::from_db_dir(db_dir.into()).unwrap();
    let ExportableNodeAnnoKeys { node } = serde_json::from_str(
        &serde_json::to_string(&storage.exportable_node_anno_keys(&[corpus_name]).unwrap())
            .unwrap(),
    )
    .unwrap();
    node.into_iter().map(|e| e.display_name).collect()
}

fn get_segmentations(db_dir: &Path, corpus_name: &str) -> Vec<String> {
    let storage = Storage::from_db_dir(db_dir.into()).unwrap();
    storage.segmentations(&[corpus_name]).unwrap()
}

fn get_exportable_edge_types(db_dir: &Path, corpus_name: &str) -> Vec<(String, Vec<String>)> {
    let storage = Storage::from_db_dir(db_dir.into()).unwrap();
    let exportable_edge_types: Vec<ExportableEdgeType> = serde_json::from_str(
        &serde_json::to_string(&storage.exportable_edge_types(&[corpus_name]).unwrap()).unwrap(),
    )
    .unwrap();

    exportable_edge_types
        .into_iter()
        .map(|e| {
            (
                e.name,
                e.anno_keys.into_iter().map(|e| e.display_name).collect(),
            )
        })
        .collect()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportableNodeAnnoKeys {
    node: Vec<ExportableAnnoKey>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportableEdgeType {
    name: String,
    anno_keys: Vec<ExportableAnnoKey>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportableAnnoKey {
    display_name: String,
}
