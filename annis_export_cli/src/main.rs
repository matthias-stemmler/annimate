use annis_export_core::{
    AnnoKey, CorpusStorage, CsvExportColumn, CsvExportConfig, ExportData, ExportDataAnno,
    ExportDataText, ExportFormat, ExportableAnnoKey, QueryNode, QueryValidationResult, StatusEvent,
};
use anyhow::{anyhow, Context};
use clap::{Parser, Subcommand, ValueEnum};
use indicatif::{ProgressBar, ProgressStyle};
use itertools::Itertools;
use regex::Regex;
use std::{
    convert::Infallible, env, fs::File, io::Write, ops::Deref, path::PathBuf, str::FromStr,
    sync::OnceLock,
};
use tracing::info;

#[derive(Parser)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Show debug information
    #[arg(short, long)]
    debug: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Describe the nodes of an AQL query
    DescribeQuery {
        /// AQL query to describe
        query: String,

        /// Query language to use
        #[arg(short, long, value_enum, default_value_t = QueryLanguage::Aql)]
        language: QueryLanguage,
    },

    /// Import corpora from a ZIP file
    ImportCorpora {
        /// Path to ZIP file to import corpora from
        path: PathBuf,
    },

    /// List all exportable annotation keys
    ListAnnoKeys {
        /// Names of the corpora (comma-separated) to list annotation keys for
        corpus_names: CorpusNames,
    },

    /// List all corpora
    ListCorpora,

    /// List all segmentations
    ListSegmentations {
        /// Names of the corpora (comma-separated) to list segmentations for
        corpus_names: CorpusNames,
    },

    /// Run AQL query and export results
    Query {
        /// Names of the corpora (comma-separated) to run AQL query on
        corpus_names: CorpusNames,

        /// AQL query to run
        query: String,

        /// List of columns (comma-separated) to be exported
        columns: Columns,

        /// Query language to use
        #[arg(short, long, value_enum, default_value_t = QueryLanguage::Aql)]
        language: QueryLanguage,

        /// Path of output file, relative to the current working directory
        #[arg(short, long, default_value = "out.csv")]
        output_file: PathBuf,
    },

    /// Validate AQL query
    ValidateQuery {
        /// Names of the corpora (comma-separated) to validate AQL query against
        corpus_names: CorpusNames,

        /// AQL query to validate
        query: String,

        /// Query language to use
        #[arg(short, long, value_enum, default_value_t = QueryLanguage::Aql)]
        language: QueryLanguage,
    },
}

#[derive(Clone)]
struct CorpusNames(Vec<String>);

impl Deref for CorpusNames {
    type Target = [String];

    fn deref(&self) -> &[String] {
        &self.0
    }
}

impl FromStr for CorpusNames {
    type Err = Infallible;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(CorpusNames(s.split(',').map(ToString::to_string).collect()))
    }
}
#[derive(Clone, Copy, ValueEnum)]
enum QueryLanguage {
    Aql,
    AqlQuirksV3,
}

impl From<QueryLanguage> for annis_export_core::QueryLanguage {
    fn from(value: QueryLanguage) -> Self {
        match value {
            QueryLanguage::Aql => annis_export_core::QueryLanguage::AQL,
            QueryLanguage::AqlQuirksV3 => annis_export_core::QueryLanguage::AQLQuirksV3,
        }
    }
}

#[derive(Clone)]
struct Columns(Vec<CsvExportColumn>);

impl Columns {
    fn into_inner(self) -> Vec<CsvExportColumn> {
        self.0
    }
}

impl FromStr for Columns {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        s.split(',')
            .map(parse_csv_export_column)
            .collect::<Result<_, _>>()
            .map(Columns)
    }
}

fn parse_csv_export_column(s: &str) -> anyhow::Result<CsvExportColumn> {
    if s == "n" {
        Ok(CsvExportColumn::Number)
    } else if let Some(anno_key) = s.strip_prefix("c:") {
        Ok(CsvExportColumn::Data(ExportData::Anno(
            ExportDataAnno::Corpus {
                anno_key: parse_anno_key(anno_key),
            },
        )))
    } else if let Some(anno_key) = s.strip_prefix("d:") {
        Ok(CsvExportColumn::Data(ExportData::Anno(
            ExportDataAnno::Document {
                anno_key: parse_anno_key(anno_key),
            },
        )))
    } else if let Some(captures) = match_anno_regex().captures(s) {
        let (_match, index, anno_key) = captures
            .iter()
            .map(|c| c.expect("All capture groups are mandatory"))
            .collect_tuple()
            .expect("All matches have exactly two captures groups");

        Ok(CsvExportColumn::Data(ExportData::Anno(
            ExportDataAnno::MatchNode {
                anno_key: parse_anno_key(anno_key.as_str()),
                index: index.as_str().parse()?,
            },
        )))
    } else if let Some(rest) = s.strip_prefix("t:") {
        let (segmentation, left_context, right_context) =
            rest.split(';').collect_tuple().ok_or(anyhow!(concat!(
                "'t:' column definition must be of the form ",
                "<segmentation>;<left context>;<right context>"
            )))?;

        Ok(CsvExportColumn::Data(ExportData::Text(ExportDataText {
            segmentation: match segmentation {
                "~" => None,
                s => Some(s.into()),
            },
            left_context: left_context.parse()?,
            right_context: right_context.parse()?,
        })))
    } else {
        Err(anyhow!(concat!(
            "Column definition must be one of ",
            "'n', ",
            "'c:<definition>', ",
            "'d:<definition>', ",
            "'<match node index>:<definition>', or ",
            "'t:<definition>'"
        )))
    }
}

fn parse_anno_key(s: &str) -> AnnoKey {
    let (ns, name) = s.split_once(':').unwrap_or(("", s));

    AnnoKey {
        ns: ns.into(),
        name: name.into(),
    }
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    if cli.debug {
        tracing_subscriber::fmt::init();
    }

    let db_dir =
        env::var("ANNIS_DB_DIR").context("Environment variable `ANNIS_DB_DIR` is not set")?;

    let corpus_storage = CorpusStorage::from_db_dir(&db_dir)
        .with_context(|| format!("Failed to open corpus storage from {db_dir}"))?;

    match cli.command {
        Commands::DescribeQuery { query, language } => {
            for (index, nodes) in corpus_storage
                .query_nodes(&query, language.into())
                .context("Failed to determine query nodes")?
                .into_iter()
                .enumerate()
            {
                println!(
                    "{index}: {}",
                    nodes
                        .into_iter()
                        .map(
                            |QueryNode {
                                 query_fragment,
                                 variable,
                             }| format!("#{variable} {query_fragment}"),
                        )
                        .join(" | ")
                );
            }
        }
        Commands::ImportCorpora { path } => {
            let corpus_names = corpus_storage
                .import_corpora_from_zip(
                    File::open(&path)
                        .with_context(|| format!("Failed to open file {}", path.display()))?,
                    |message| println!("{message}"),
                )
                .context("Failed to import corpora")?;

            if corpus_names.is_empty() {
                println!("No corpora found");
            } else {
                println!("Corpora imported successfully:");
                for corpus_name in corpus_names {
                    println!("{corpus_name}");
                }
            }
        }
        Commands::ListAnnoKeys { corpus_names } => {
            fn print_exportable_anno_keys(exportable_anno_keys: &[ExportableAnnoKey]) {
                for ExportableAnnoKey {
                    anno_key,
                    display_name,
                } in exportable_anno_keys
                {
                    if anno_key.ns.is_empty() {
                        println!("  {}", display_name);
                    } else {
                        println!("  {} ({}:{})", display_name, anno_key.ns, anno_key.name);
                    }
                }
            }

            let anno_keys = corpus_storage
                .exportable_anno_keys(&corpus_names)
                .context("Failed to list annotation keys")?;

            println!("Corpus annotation keys");
            print_exportable_anno_keys(&anno_keys.corpus);

            println!("\nDocument annotation keys");
            print_exportable_anno_keys(&anno_keys.doc);

            println!("\nNode annotation keys");
            print_exportable_anno_keys(&anno_keys.node);
        }
        Commands::ListCorpora => {
            for name in corpus_storage
                .corpus_names()
                .context("Failed to list corpora")?
            {
                println!("{name}");
            }
        }
        Commands::ListSegmentations { corpus_names } => {
            for name in corpus_storage
                .segmentations(&corpus_names)
                .context("Failed to list segmentations")?
            {
                println!("{name}");
            }
        }
        Commands::Query {
            corpus_names,
            query,
            language,
            output_file,
            columns,
        } => {
            let mut out = File::create(&output_file)
                .with_context(|| format!("Failed to open output file {}", output_file.display()))?;

            let progress_reporter = ProgressReporter::new(cli.debug);

            corpus_storage
                .export_matches(
                    &corpus_names,
                    &query,
                    language.into(),
                    ExportFormat::Csv(CsvExportConfig {
                        columns: columns.into_inner(),
                    }),
                    &mut out,
                    |event| match event {
                        StatusEvent::Found { count } => println!("Found {count} matches"),
                        StatusEvent::Exported { progress } => {
                            progress_reporter.report(progress);
                        }
                    },
                )
                .context("Failed to export matches")?;

            out.flush()
                .with_context(|| format!("Failed to open output file {}", output_file.display()))?;

            progress_reporter.finish();
        }
        Commands::ValidateQuery {
            corpus_names,
            query,
            language,
        } => {
            let result = corpus_storage
                .validate_query(&corpus_names, &query, language.into())
                .context("Failed to validate query")?;
            match result {
                QueryValidationResult::Valid => println!("Query is valid"),
                QueryValidationResult::Invalid(err) => println!("Query is invalid\n{err}"),
            }
        }
    }

    Ok(())
}

enum ProgressReporter {
    ProgressBar(ProgressBar),
    Text,
}

impl ProgressReporter {
    fn new(debug: bool) -> Self {
        if debug {
            Self::Text
        } else {
            Self::ProgressBar(
                ProgressBar::new(100)
                    .with_style(ProgressStyle::with_template("{wide_bar} {percent:>3}%").unwrap()),
            )
        }
    }

    fn report(&self, progress: f32) {
        let progress = (progress * 100.0) as u64;

        match self {
            Self::Text => info!("Progress: {}%", progress),
            Self::ProgressBar(progress_bar) => progress_bar.set_position(progress),
        }
    }

    fn finish(&self) {
        match self {
            Self::Text => info!("Progress: finished"),
            Self::ProgressBar(progress_bar) => progress_bar.finish(),
        }
    }
}

fn match_anno_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| Regex::new(r"^(\d+):(.*)").unwrap())
}
