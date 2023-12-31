use annis_export_core::{
    CorpusStorage, ExportFormat, QueryConfig, QueryNode, QueryValidationResult, StatusEvent,
};
use anyhow::{anyhow, Context};
use clap::{Parser, Subcommand, ValueEnum};
use indicatif::{ProgressBar, ProgressStyle};
use itertools::Itertools;
use std::{env, fs::File, io::Write, path::PathBuf, str::FromStr};
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

    /// List all corpora
    ListCorpora,

    /// List all segmentations
    ListSegmentations {
        /// Name of the corpus to list segmentations for
        corpus_name: String,
    },

    /// Run AQL query and export results
    Query {
        /// Name of the corpus to run AQL query on
        corpus_name: String,

        /// AQL query to run
        query: String,

        /// Path of output file, relative to the current working directory
        #[arg(short, long, default_value = "out.csv")]
        output_file: PathBuf,

        /// Context size, where e.g. "10,5" means 10 nodes to the left and 5 to the right and "10" means 10 tokens in both directions
        #[arg(short, long, default_value = "10")]
        context: ContextSize,

        /// Segmentation to use for defining the context, use the `list-segmentations` command to list all options [default: use tokens]
        #[arg(short, long)]
        segmentation: Option<String>,

        /// Query language to use
        #[arg(short, long, value_enum, default_value_t = QueryLanguage::Aql)]
        language: QueryLanguage,
    },

    /// Validate AQL query
    ValidateQuery {
        /// Name of the corpus to validate AQL query against
        corpus_name: String,

        /// AQL query to validate
        query: String,

        /// Query language to use
        #[arg(short, long, value_enum, default_value_t = QueryLanguage::Aql)]
        language: QueryLanguage,
    },
}

#[derive(Clone, Copy)]
struct ContextSize {
    left: usize,
    right: usize,
}

impl ContextSize {
    fn symmetric(size: usize) -> Self {
        Self::left_right(size, size)
    }

    fn left_right(left: usize, right: usize) -> Self {
        Self { left, right }
    }
}

impl FromStr for ContextSize {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if let Ok(size) = s.parse() {
            Ok(Self::symmetric(size))
        } else if let Some((Ok(left), Ok(right))) =
            s.split_once(',').map(|(l, r)| (l.parse(), r.parse()))
        {
            Ok(Self::left_right(left, right))
        } else {
            Err(anyhow!("Context must be specified either as a single number (e.g. \"10\") or two comma-separated numbers (e.g. \"10,5\")"))
        }
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

            println!("Corpora imported successfully:");
            for corpus_name in corpus_names {
                println!("{corpus_name}");
            }
        }
        Commands::ListCorpora => {
            for name in corpus_storage
                .corpus_names()
                .context("Failed to list corpora")?
            {
                println!("{name}");
            }
        }
        Commands::ListSegmentations { corpus_name } => {
            for name in corpus_storage
                .segmentations(&corpus_name)
                .context("Failed to list segmentations")?
            {
                println!("{name}");
            }
        }
        Commands::Query {
            corpus_name,
            query,
            output_file,
            context,
            language,
            segmentation,
        } => {
            let mut out = File::create(&output_file)
                .with_context(|| format!("Failed to open output file {}", output_file.display()))?;

            let progress_reporter = ProgressReporter::new(cli.debug);

            corpus_storage
                .export_matches(
                    &corpus_name,
                    &query,
                    QueryConfig {
                        left_context: context.left,
                        right_context: context.right,
                        query_language: language.into(),
                        segmentation,
                    },
                    ExportFormat::Csv,
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
            corpus_name,
            query,
            language,
        } => {
            let result = corpus_storage
                .validate_query(&corpus_name, &query, language.into())
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
