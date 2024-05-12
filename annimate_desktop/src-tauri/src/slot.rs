use std::ops::Deref;

use tokio::sync::watch;

/// A slot where tasks can asynchronously wait until a value is inserted
///
/// This is basically a wrapper around tokio's watch channel where the inner value is an Option.
#[derive(Debug)]
pub(crate) struct Slot<T> {
    sender: watch::Sender<Option<T>>,
}

impl<T> Slot<T> {
    pub(crate) fn set(&self, value: T) {
        self.sender.send_replace(Some(value));
    }

    pub(crate) fn subscribe(&self) -> SlotSubscription<T> {
        SlotSubscription {
            receiver: self.sender.subscribe(),
        }
    }
}

impl<T> Default for Slot<T> {
    fn default() -> Self {
        Self {
            sender: watch::Sender::new(None),
        }
    }
}

#[derive(Debug)]
pub(crate) struct SlotSubscription<T> {
    receiver: watch::Receiver<Option<T>>,
}

impl<T> SlotSubscription<T> {
    pub(crate) async fn wait(&mut self) -> SlotRef<T> {
        SlotRef(
            self.receiver
                .wait_for(|v| v.is_some())
                .await
                .expect("Channel is open because there is a receiver"),
        )
    }
}

#[derive(Debug)]
pub(crate) struct SlotRef<'a, T>(watch::Ref<'a, Option<T>>);

impl<T> Deref for SlotRef<'_, T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        self.0
            .as_ref()
            .expect("Content is Some because of wait condition")
    }
}
