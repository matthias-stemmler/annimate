use annis_export_core::CorpusStorage;
use anyhow::Context;
use clap::{Parser, Subcommand};
use std::env;

#[derive(Parser, Debug)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// List all corpora
    List,
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    let db_dir =
        env::var("ANNIS_DB_DIR").context("Environment variable `ANNIS_DB_DIR` is not set")?;

    let corpus_storage = CorpusStorage::from_db_dir(&db_dir)
        .with_context(|| format!("Failed to open corpus storage from {db_dir}"))?;

    match cli.command {
        Commands::List => {
            for name in corpus_storage
                .corpus_names()
                .context("Failed to list corpora")?
            {
                println!("{name}");
            }
        }
    }

    Ok(())
}
