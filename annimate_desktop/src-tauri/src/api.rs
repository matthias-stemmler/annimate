use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use annimate_core::{
    AnnoKey, Corpora, CsvExportColumn, CsvExportConfig, ExportConfig, ExportData, ExportDataAnno,
    ExportDataText, ExportFormat, ExportableAnnoKeys, QueryAnalysisResult, QueryLanguage,
    QueryNodes, Storage,
};
use itertools::Itertools;
use serde::Deserialize;
use tauri::{EventHandler, Window};

use crate::error::Error;

pub(crate) struct State {
    storage: Storage,
}

impl State {
    pub(crate) fn from_db_dir(db_dir: PathBuf) -> Self {
        Self {
            storage: Storage::from_db_dir(db_dir).expect("Failed to create corpus storage"),
        }
    }
}

#[tauri::command(async)]
pub(crate) fn add_corpora_to_set(
    state: tauri::State<State>,
    corpus_set: &str,
    corpus_names: Vec<&str>,
) -> Result<(), Error> {
    Ok(state
        .storage
        .add_corpora_to_set(corpus_set, &corpus_names)?)
}

#[tauri::command(async)]
pub(crate) fn delete_corpus(state: tauri::State<State>, corpus_name: &str) -> Result<(), Error> {
    Ok(state.storage.delete_corpus(corpus_name)?)
}

#[tauri::command(async)]
pub(crate) fn export_matches(
    state: tauri::State<State>,
    window: Window,
    corpus_names: Vec<&str>,
    aql_query: &str,
    query_language: QueryLanguage,
    export_columns: Vec<ExportColumn>,
    output_file: &Path,
) -> Result<(), Error> {
    let cancel_requested = Arc::new(AtomicBool::new(false));

    let _guard = EventHandlerGuard::new(
        &window,
        window.once("export_cancel_requested", {
            let cancel_requested = Arc::clone(&cancel_requested);
            move |_| {
                cancel_requested.store(true, Ordering::Relaxed);
            }
        }),
    );

    state.storage.export_matches(
        ExportConfig {
            corpus_names: &corpus_names,
            aql_query,
            query_language,
            format: ExportFormat::Csv(CsvExportConfig {
                columns: export_columns.into_iter().map_into().collect(),
            }),
        },
        output_file,
        |status_event| {
            window
                .emit("export_status", &status_event)
                .expect("Failed to emit export_status event")
        },
        || cancel_requested.load(Ordering::Relaxed),
    )?;

    Ok(())
}

#[tauri::command(async)]
pub(crate) fn get_corpora(state: tauri::State<State>) -> Result<Corpora, Error> {
    Ok(state.storage.corpora()?)
}

#[tauri::command(async)]
pub(crate) fn get_exportable_anno_keys(
    state: tauri::State<State>,
    corpus_names: Vec<&str>,
) -> Result<ExportableAnnoKeys, Error> {
    Ok(state.storage.exportable_anno_keys(&corpus_names)?)
}

#[tauri::command(async)]
pub(crate) fn get_query_nodes(
    state: tauri::State<State>,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<QueryNodes>, Error> {
    Ok(state.storage.query_nodes(aql_query, query_language)?)
}

#[tauri::command(async)]
pub(crate) fn get_segmentations(
    state: tauri::State<State>,
    corpus_names: Vec<&str>,
) -> Result<Vec<String>, Error> {
    if corpus_names.is_empty() {
        Ok(Vec::new())
    } else {
        let mut segmentations = state.storage.segmentations(&corpus_names)?;
        segmentations.push("".into());
        Ok(segmentations)
    }
}

#[tauri::command(async)]
pub(crate) fn import_corpora(
    state: tauri::State<State>,
    window: Window,
    paths: Vec<PathBuf>,
) -> Result<Vec<String>, Error> {
    let cancel_requested = Arc::new(AtomicBool::new(false));

    let _guard = EventHandlerGuard::new(
        &window,
        window.once("import_cancel_requested", {
            let cancel_requested = Arc::clone(&cancel_requested);
            move |_| {
                cancel_requested.store(true, Ordering::Relaxed);
            }
        }),
    );

    let corpus_names = state.storage.import_corpora(
        paths,
        |status_event| {
            window
                .emit("import_status", &status_event)
                .expect("Failed to emit import_status event");
        },
        || cancel_requested.load(Ordering::Relaxed),
    )?;

    Ok(corpus_names)
}

#[tauri::command(async)]
pub(crate) fn toggle_corpus_in_set(
    state: tauri::State<State>,
    corpus_set: &str,
    corpus_name: &str,
) -> Result<(), Error> {
    Ok(state
        .storage
        .toggle_corpus_in_set(corpus_set, corpus_name)?)
}

#[tauri::command(async)]
pub(crate) fn validate_query(
    state: tauri::State<State>,
    corpus_names: Vec<&str>,
    aql_query: &str,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<()>, Error> {
    Ok(state
        .storage
        .validate_query(&corpus_names, aql_query, query_language)?)
}

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub(crate) enum ExportColumn {
    Number,
    AnnoCorpus {
        anno_key: AnnoKey,
    },
    AnnoDocument {
        anno_key: AnnoKey,
    },
    AnnoMatch {
        anno_key: AnnoKey,
        node_ref: QueryNodeRef,
    },
    MatchInContext {
        context: usize,
        context_right_override: Option<usize>,
        primary_node_refs: Vec<QueryNodeRef>,
        segmentation: String,
    },
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub(crate) struct QueryNodeRef {
    index: usize,
}

impl From<ExportColumn> for CsvExportColumn {
    fn from(export_column: ExportColumn) -> CsvExportColumn {
        match export_column {
            ExportColumn::Number => CsvExportColumn::Number,
            ExportColumn::AnnoCorpus { anno_key } => {
                CsvExportColumn::Data(ExportData::Anno(ExportDataAnno::Corpus { anno_key }))
            }
            ExportColumn::AnnoDocument { anno_key } => {
                CsvExportColumn::Data(ExportData::Anno(ExportDataAnno::Document { anno_key }))
            }
            ExportColumn::AnnoMatch { anno_key, node_ref } => {
                CsvExportColumn::Data(ExportData::Anno(ExportDataAnno::MatchNode {
                    anno_key,
                    index: node_ref.index,
                }))
            }
            ExportColumn::MatchInContext {
                context,
                context_right_override,
                primary_node_refs,
                segmentation,
            } => CsvExportColumn::Data(ExportData::Text(ExportDataText {
                left_context: context,
                right_context: context_right_override.unwrap_or(context),
                segmentation: (!segmentation.is_empty()).then_some(segmentation),
                primary_node_indices: Some(
                    primary_node_refs.into_iter().map(|n| n.index).collect(),
                ),
            })),
        }
    }
}

#[derive(Debug)]
struct EventHandlerGuard<'a> {
    window: &'a Window,
    event_handler: EventHandler,
}

impl<'a> EventHandlerGuard<'a> {
    fn new(window: &'a Window, event_handler: EventHandler) -> Self {
        Self {
            window,
            event_handler,
        }
    }
}

impl Drop for EventHandlerGuard<'_> {
    fn drop(&mut self) {
        self.window.unlisten(self.event_handler);
    }
}
