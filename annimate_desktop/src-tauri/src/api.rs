use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use annimate_core::{
    AnnoKey, Corpora, CsvExportConfig, ExportConfig, ExportData, ExportDataAnno, ExportDataText,
    ExportFormat, ExportableAnnoKeys, QueryAnalysisResult, QueryLanguage, QueryNodes,
    TableExportColumn,
};
use itertools::Itertools;
use serde::Deserialize;
use tauri::{EventHandler, Window};

use crate::error::Error;
use crate::state::AppState;

#[tauri::command]
pub(crate) async fn add_corpora_to_set(
    state: tauri::State<'_, AppState>,
    corpus_set: String,
    corpus_names: Vec<String>,
) -> Result<(), Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
        Ok(storage.add_corpora_to_set(corpus_set, &corpus_names)?)
    })
    .await?
}

#[tauri::command]
pub(crate) async fn create_corpus_set(
    state: tauri::State<'_, AppState>,
    corpus_set: String,
) -> Result<(), Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || Ok(storage.create_corpus_set(corpus_set)?)).await?
}

#[tauri::command]
pub(crate) async fn delete_corpus(
    state: tauri::State<'_, AppState>,
    corpus_name: String,
) -> Result<(), Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || Ok(storage.delete_corpus(&corpus_name)?)).await?
}

#[tauri::command]
pub(crate) async fn delete_corpus_set(
    state: tauri::State<'_, AppState>,
    corpus_set: String,
    delete_corpora: bool,
) -> Result<(), Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
        Ok(storage.delete_corpus_set(corpus_set, delete_corpora)?)
    })
    .await?
}

#[tauri::command]
pub(crate) async fn export_matches(
    state: tauri::State<'_, AppState>,
    window: Window,
    corpus_names: Vec<String>,
    aql_query: String,
    query_language: QueryLanguage,
    export_columns: Vec<ExportColumn>,
    output_file: PathBuf,
) -> Result<(), Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
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

        storage.export_matches(
            ExportConfig {
                corpus_names: &corpus_names,
                aql_query: &aql_query,
                query_language,
                format: ExportFormat::Csv(CsvExportConfig {
                    columns: export_columns.into_iter().map_into().collect(),
                }),
            },
            output_file,
            |status_event| {
                window
                    .emit("export_status", &status_event)
                    .expect("Failed to emit export_status event");
            },
            || cancel_requested.load(Ordering::Relaxed),
        )?;

        Ok(())
    })
    .await?
}

#[tauri::command]
pub(crate) async fn get_corpora(state: tauri::State<'_, AppState>) -> Result<Corpora, Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || Ok(storage.corpora()?)).await?
}

#[tauri::command]
pub(crate) async fn get_db_dir(state: tauri::State<'_, AppState>) -> Result<PathBuf, Error> {
    let mut subscription = state.db_dir_slot.subscribe();
    let db_dir = subscription.wait().await.clone()?;

    Ok(db_dir)
}

#[tauri::command]
pub(crate) async fn get_exportable_anno_keys(
    state: tauri::State<'_, AppState>,
    corpus_names: Vec<String>,
) -> Result<ExportableAnnoKeys, Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || Ok(storage.exportable_anno_keys(&corpus_names)?))
        .await?
}

#[tauri::command]
pub(crate) async fn get_query_nodes(
    state: tauri::State<'_, AppState>,
    aql_query: String,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<QueryNodes>, Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
        Ok(storage.query_nodes(&aql_query, query_language)?)
    })
    .await?
}

#[tauri::command]
pub(crate) async fn get_segmentations(
    state: tauri::State<'_, AppState>,
    corpus_names: Vec<String>,
) -> Result<Vec<String>, Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
        if corpus_names.is_empty() {
            Ok(Vec::new())
        } else {
            let mut segmentations = storage.segmentations(&corpus_names)?;
            segmentations.push("".into());
            Ok(segmentations)
        }
    })
    .await?
}

#[tauri::command]
pub(crate) async fn import_corpora(
    state: tauri::State<'_, AppState>,
    window: Window,
    paths: Vec<PathBuf>,
) -> Result<Vec<String>, Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
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

        let corpus_names = storage.import_corpora(
            paths,
            |status_event| {
                window
                    .emit("import_status", &status_event)
                    .expect("Failed to emit import_status event");
            },
            || cancel_requested.load(Ordering::Relaxed),
        )?;

        Ok(corpus_names)
    })
    .await?
}

#[tauri::command]
pub(crate) async fn rename_corpus_set(
    state: tauri::State<'_, AppState>,
    corpus_set: String,
    new_corpus_set: String,
) -> Result<(), Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
        Ok(storage.rename_corpus_set(&corpus_set, new_corpus_set)?)
    })
    .await?
}

#[tauri::command]
pub(crate) async fn toggle_corpus_in_set(
    state: tauri::State<'_, AppState>,
    corpus_set: String,
    corpus_name: String,
) -> Result<(), Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
        Ok(storage.toggle_corpus_in_set(&corpus_set, &corpus_name)?)
    })
    .await?
}

#[tauri::command]
pub(crate) async fn validate_query(
    state: tauri::State<'_, AppState>,
    corpus_names: Vec<String>,
    aql_query: String,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<()>, Error> {
    let mut subscription = state.storage_slot.subscribe();
    let storage = subscription.wait().await.clone()?;

    tauri::async_runtime::spawn_blocking(move || {
        Ok(storage.validate_query(&corpus_names, &aql_query, query_language)?)
    })
    .await?
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

impl From<ExportColumn> for TableExportColumn {
    fn from(export_column: ExportColumn) -> TableExportColumn {
        match export_column {
            ExportColumn::Number => TableExportColumn::Number,
            ExportColumn::AnnoCorpus { anno_key } => {
                TableExportColumn::Data(ExportData::Anno(ExportDataAnno::Corpus { anno_key }))
            }
            ExportColumn::AnnoDocument { anno_key } => {
                TableExportColumn::Data(ExportData::Anno(ExportDataAnno::Document { anno_key }))
            }
            ExportColumn::AnnoMatch { anno_key, node_ref } => {
                TableExportColumn::Data(ExportData::Anno(ExportDataAnno::MatchNode {
                    anno_key,
                    index: node_ref.index,
                }))
            }
            ExportColumn::MatchInContext {
                context,
                context_right_override,
                primary_node_refs,
                segmentation,
            } => TableExportColumn::Data(ExportData::Text(ExportDataText {
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
