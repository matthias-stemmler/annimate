use std::cell::RefCell;
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};

use annimate_core::{ImportStatusEvent, Storage};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const DATA_DIR: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/data");
const DB_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/import/db");
const INPUT_DIR: &str = concat!(env!("CARGO_TARGET_TMPDIR"), "/tests/import/input");

#[test]
fn import() {
    let _ = fs::remove_dir_all(DB_DIR);
    let _ = fs::remove_dir_all(INPUT_DIR);

    let storage = Storage::from_db_dir(DB_DIR).unwrap();

    let events = RefCell::new(Vec::new());

    storage
        .import_corpora(prepare_input_files(INPUT_DIR), |event| match event {
            ImportStatusEvent::Message { .. } => (),
            event => events.borrow_mut().push(event.clone()),
        })
        .unwrap();

    let corpora = storage.corpora().unwrap();

    insta::with_settings!(
        {
             omit_expression => true,
        },
        {
            insta::assert_yaml_snapshot!(events.into_inner(), {
                ".**.path" => "[path]"
            });
            insta::assert_debug_snapshot!(corpora);
        }
    );
}

#[rustfmt::skip]
// Creates the following folder structure:
//
// <root_path>
// ├── README.md                             # Non-corpus file
// ├── subtok.demo_relANNIS/                 # Corpus 1 subtok.demo (RelANNIS)
// └── test_dir/                             # Directory
//    ├── subtok.demo2_relANNIS/             # Corpus 2 subtok.demo2 (RelANNIS)
//    └── test_zip.zip                       # ZIP file
//        ├── subtok.demo.graphml            # Corpus 3 subtok.demo (GraphML, name conflict with corpus 1)
//        └── test_dir_in_zip/               # Directory in ZIP file
//            └── subtok.demo3_relANNIS.zip  # ZIP file in ZIP file
//                └── subtok.demo3_relANNIS/ # Corpus 4 subtok.demo3 (RelANNIS)
fn prepare_input_files<P>(root_path: P) -> Vec<PathBuf>
where
    P: AsRef<Path>,
{
    let root_path = root_path.as_ref();
    fs::create_dir_all(root_path).unwrap();

    fs::copy(
        Path::new(DATA_DIR).join("README.md"),
        root_path.join("README.md"),
    )
    .unwrap();

    extract_zip(
        Path::new(DATA_DIR).join("subtok.demo_relANNIS.zip"),
        root_path,
    );

    fs::create_dir(root_path.join("test_dir")).unwrap();

    extract_zip(
        Path::new(DATA_DIR).join("subtok.demo2_relANNIS.zip"),
        root_path.join("test_dir"),
    );

    let mut zip_writer =
        ZipWriter::new(File::create(root_path.join("test_dir/test_zip.zip")).unwrap());

    zip_writer
        .start_file(
            "subtok.demo.graphml",
            SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
        )
        .unwrap();

    let tempdir_graphml = tempfile::tempdir().unwrap();

    extract_zip(
        Path::new(DATA_DIR).join("subtok.demo_graphml.zip"),
        &tempdir_graphml,
    );

    io::copy(
        &mut File::open(tempdir_graphml.path().join("subtok.demo.graphml")).unwrap(),
        &mut zip_writer,
    )
    .unwrap();

    zip_writer
        .start_file(
            "test_dir_in_zip/subtok.demo3_relANNIS.zip",
            SimpleFileOptions::default().compression_method(CompressionMethod::Stored),
        )
        .unwrap();

    io::copy(
        &mut File::open(Path::new(DATA_DIR).join("subtok.demo3_relANNIS.zip")).unwrap(),
        &mut zip_writer,
    )
    .unwrap();

    vec![
        root_path.join("subtok.demo_relANNIS"),
        root_path.join("test_dir"),
        root_path.join("test_dir/subtok.demo2_relANNIS"), // testing deduplication
    ]
}

fn extract_zip<P, Q>(zip_path: P, output_dir: Q)
where
    P: AsRef<Path>,
    Q: AsRef<Path>,
{
    let mut archive = ZipArchive::new(File::open(zip_path.as_ref()).unwrap()).unwrap();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).unwrap();

        if let Some(enclosed_path) = entry.enclosed_name() {
            let output_path = output_dir.as_ref().join(enclosed_path);

            if entry.is_dir() {
                fs::create_dir_all(output_path).unwrap();
            } else if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent).unwrap();
                let mut output_file = File::create(&output_path).unwrap();
                io::copy(&mut entry, &mut output_file).unwrap();
            }
        }
    }
}
