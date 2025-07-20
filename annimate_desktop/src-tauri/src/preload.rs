use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use annimate_core::Storage;

use crate::async_util::DelayedQueue;

const DELAY: Duration = Duration::from_secs(5);

pub(crate) struct Preloader {
    shared: Arc<Shared>,
}

struct Shared {
    corpus_names_to_preload: Mutex<HashSet<String>>,
    queue: DelayedQueue<String>,
}

impl Preloader {
    pub(crate) fn new(storage: Arc<Storage>) -> Self {
        let shared = Arc::new(Shared {
            corpus_names_to_preload: Mutex::new(HashSet::new()),
            queue: DelayedQueue::new(),
        });

        tauri::async_runtime::spawn({
            let shared = Arc::clone(&shared);

            async move {
                loop {
                    let corpus_name = shared.queue.pop().await;

                    let _ = tauri::async_runtime::spawn_blocking({
                        let storage = Arc::clone(&storage);
                        move || storage.preload_corpus(&corpus_name)
                    })
                    .await;
                }
            }
        });

        Self { shared }
    }

    pub(crate) async fn set_corpus_names_to_preload(&self, corpus_names: Vec<String>) {
        // Remove corpora from queue that are no longer on the list
        self.shared
            .queue
            .retain(|corpus_name| corpus_names.contains(corpus_name));

        let mut corpus_names_to_preload = self.shared.corpus_names_to_preload.lock().unwrap();
        let now = Instant::now();

        // Enqueue corpora that have been added to the list
        for corpus_name in &corpus_names {
            if !corpus_names_to_preload.contains(corpus_name) {
                self.shared.queue.push(corpus_name.clone(), now + DELAY);
            }
        }

        // Save new list
        *corpus_names_to_preload = HashSet::from_iter(corpus_names);
    }

    pub(crate) fn suspend(&self) -> SuspendGuard<'_> {
        self.shared.queue.suspend();
        SuspendGuard { preloader: self }
    }

    fn resume(&self) {
        self.shared.queue.resume();
    }
}

pub(crate) struct SuspendGuard<'a> {
    preloader: &'a Preloader,
}

impl<'a> Drop for SuspendGuard<'a> {
    fn drop(&mut self) {
        self.preloader.resume();
    }
}
