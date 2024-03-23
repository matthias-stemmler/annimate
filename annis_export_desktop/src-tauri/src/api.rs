use crate::error::Error;
use annis_export_core::{
    AnnoKey, CorpusStorage, CsvExportColumn, CsvExportConfig, ExportData, ExportDataAnno,
    ExportDataText, ExportFormat, ExportableAnnoKeys, QueryAnalysisResult, QueryLanguage,
    QueryNodes,
};
use itertools::Itertools;
use serde::Deserialize;
use std::{
    io::{self, Write},
    path::PathBuf,
};
use tauri::Window;

pub(crate) struct State {
    storage: CorpusStorage,
}

impl State {
    pub(crate) fn from_db_dir(db_dir: PathBuf) -> Self {
        Self {
            storage: CorpusStorage::from_db_dir(db_dir).expect("Failed to create corpus storage"),
        }
    }
}

#[tauri::command(async)]
pub(crate) fn export_matches(
    state: tauri::State<State>,
    window: Window,
    corpus_names: Vec<String>,
    aql_query: String,
    query_language: QueryLanguage,
    export_columns: Vec<ExportColumn>,
    output_file: PathBuf,
) -> Result<(), Error> {
    let mut out = tempfile::Builder::new()
        .prefix(".annis_export_")
        .suffix(".csv")
        .tempfile()?;

    state.storage.export_matches(
        &corpus_names,
        &aql_query,
        query_language,
        ExportFormat::Csv(CsvExportConfig {
            columns: export_columns.into_iter().map_into().collect(),
        }),
        &mut out,
        |status_event| {
            window
                .emit("export_status", &status_event)
                .expect("Failed to emit export_status event")
        },
    )?;

    out.flush()?;
    out.persist(output_file).map_err(io::Error::from)?;

    Ok(())
}

#[tauri::command(async)]
pub(crate) fn get_corpus_names(state: tauri::State<State>) -> Result<Vec<String>, Error> {
    Ok(state
        .storage
        .corpus_infos()?
        .into_iter()
        .map(|corpus_info| corpus_info.name)
        .collect())
}

#[tauri::command(async)]
pub(crate) fn get_exportable_anno_keys(
    state: tauri::State<State>,
    corpus_names: Vec<String>,
) -> Result<ExportableAnnoKeys, Error> {
    Ok(state.storage.exportable_anno_keys(&corpus_names)?)
}

#[tauri::command(async)]
pub(crate) fn get_query_nodes(
    state: tauri::State<State>,
    aql_query: String,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<QueryNodes>, Error> {
    Ok(state.storage.query_nodes(&aql_query, query_language)?)
}

#[tauri::command(async)]
pub(crate) fn get_segmentations(
    state: tauri::State<State>,
    corpus_names: Vec<String>,
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
pub(crate) fn validate_query(
    state: tauri::State<State>,
    corpus_names: Vec<String>,
    aql_query: String,
    query_language: QueryLanguage,
) -> Result<QueryAnalysisResult<()>, Error> {
    Ok(state
        .storage
        .validate_query(&corpus_names, &aql_query, query_language)?)
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
