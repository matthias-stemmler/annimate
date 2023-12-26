use annis_export_core::{
    CorpusStorage, ExportFormat, QueryConfig, QueryValidationResult, StatusEvent,
};
use anyhow::{anyhow, Context};
use clap::{Parser, Subcommand, ValueEnum};
use std::{env, fs::File, io::Write, path::PathBuf, str::FromStr};

#[derive(Parser)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List all corpora
    ListCorpora,

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

    let db_dir =
        env::var("ANNIS_DB_DIR").context("Environment variable `ANNIS_DB_DIR` is not set")?;

    let corpus_storage = CorpusStorage::from_db_dir(&db_dir)
        .with_context(|| format!("Failed to open corpus storage from {db_dir}"))?;

    match cli.command {
        Commands::ListCorpora => {
            for name in corpus_storage
                .corpus_names()
                .context("Failed to list corpora")?
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
        } => {
            let mut out = File::create(&output_file)
                .with_context(|| format!("Failed to open output file {}", output_file.display()))?;

            corpus_storage
                .export_matches(
                    &corpus_name,
                    &query,
                    QueryConfig {
                        left_context: context.left,
                        right_context: context.right,
                        query_language: language.into(),
                    },
                    ExportFormat::Csv,
                    &mut out,
                    |event| match event {
                        StatusEvent::Found { count } => println!("Found {count} matches"),
                        StatusEvent::Fetched {
                            total_count,
                            fetched_count: written_count,
                        } => println!("Written {written_count} of {total_count} matches"),
                    },
                )
                .context("Failed to export matches")?;

            out.flush()
                .with_context(|| format!("Failed to open output file {}", output_file.display()))?;
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
