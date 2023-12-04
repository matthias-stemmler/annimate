use annis_export_core::{CorpusStorage, ExportFormat, QueryConfig, StatusEvent};
use anyhow::Context;
use clap::{Parser, Subcommand};
use std::{
    env,
    fs::File,
    io::{BufWriter, Write},
    path::PathBuf,
};

#[derive(Parser, Debug)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// List all corpora
    ListCorpora,

    /// Run query and export results
    Query {
        corpus_name: String,
        query: String,

        #[arg(short, long, default_value = "out.csv")]
        output_file: PathBuf,

        #[arg(short, long, default_value = "10")]
        left_context: usize,

        #[arg(short, long, default_value = "10")]
        right_context: usize,
    },
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
            left_context,
            right_context,
        } => {
            let out = File::create(&output_file)
                .with_context(|| format!("Failed to open output file {}", output_file.display()))?;

            //let mut out = BufWriter::new(out);
            let mut out = out;

            corpus_storage
                .export_matches(
                    &corpus_name,
                    &query,
                    QueryConfig {
                        left_context,
                        right_context,
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
    }

    Ok(())
}
