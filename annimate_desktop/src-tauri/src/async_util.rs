use std::cmp::Reverse;
use std::collections::BinaryHeap;
use std::ops::Deref;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tokio::sync::{Notify, watch};

/// A slot where tasks can wait asynchronously until a value is inserted.
///
/// This is basically a wrapper around tokio's watch channel where the inner value is an [Option].
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
    pub(crate) async fn wait(&mut self) -> SlotRef<'_, T> {
        SlotRef(
            self.receiver
                .wait_for(|v| v.is_some())
                .await
                .expect("channel should be open because there is a receiver"),
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
            .expect("content should be Some(_) because of wait condition")
    }
}

/// A asynchronous queue that tracks for each item when it is ready to be processed.
///
/// Items that become ready at the same time are processed according to their [Ord] implementation.
pub(crate) struct DelayedQueue<T> {
    queue: Mutex<BinaryHeap<Reverse<Item<T>>>>,
    suspended: AtomicBool,
    notify: Notify,
}

#[derive(Eq, Ord, PartialEq, PartialOrd)]
struct Item<T> {
    ready_at: tokio::time::Instant,
    value: T,
}

enum Peek<T> {
    Ready(T),
    NotReady(Option<Duration>),
}

impl<T> DelayedQueue<T>
where
    T: Ord,
{
    pub(crate) fn new() -> Self {
        Self {
            queue: Mutex::new(BinaryHeap::new()),
            suspended: AtomicBool::new(false),
            notify: Notify::new(),
        }
    }

    pub(crate) fn push(&self, value: T, ready_at: impl Into<tokio::time::Instant>) {
        self.queue.lock().unwrap().push(Reverse(Item {
            ready_at: ready_at.into(),
            value,
        }));

        self.notify.notify_one();
    }

    pub(crate) fn retain(&self, mut predicate: impl FnMut(&T) -> bool) {
        self.queue
            .lock()
            .unwrap()
            .retain(|item| predicate(&item.0.value));
    }

    pub(crate) fn suspend(&self) {
        self.suspended.store(true, Ordering::Relaxed);
    }

    pub(crate) fn resume(&self) {
        self.suspended.store(false, Ordering::Relaxed);
        self.notify.notify_one();
    }

    pub(crate) async fn pop(&self) -> T {
        loop {
            match self.peek() {
                Peek::Ready(value) => return value,
                Peek::NotReady(Some(duration)) => {
                    let _ = tokio::time::timeout(duration, self.notify.notified()).await;
                }
                Peek::NotReady(None) => {
                    self.notify.notified().await;
                }
            }
        }
    }

    fn peek(&self) -> Peek<T> {
        if self.suspended.load(Ordering::Relaxed) {
            return Peek::NotReady(None);
        }

        let mut queue = self.queue.lock().unwrap();
        let now = tokio::time::Instant::now();

        match queue.peek() {
            Some(item) => {
                if item.0.ready_at > now {
                    Peek::NotReady(Some(item.0.ready_at - now))
                } else {
                    Peek::Ready(queue.pop().unwrap().0.value)
                }
            }
            None => Peek::NotReady(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn slot() {
        let slot = Slot::default();

        slot.set(1);

        let mut subscription = slot.subscribe();
        let value = subscription.wait().await;
        assert_eq!(*value, 1);
    }

    #[tokio::test(start_paused = true)]
    async fn delayed_queue() {
        let queue = DelayedQueue::new();
        let now = tokio::time::Instant::now();

        queue.push(2, now + Duration::from_secs(2));
        queue.push(1, now + Duration::from_secs(2));
        queue.push(3, now + Duration::from_secs(1));

        let value = queue.pop().await;
        assert_eq!(value, 3);
        assert_eq!(now.elapsed(), Duration::from_secs(1));

        let value = queue.pop().await;
        assert_eq!(value, 1);
        assert_eq!(now.elapsed(), Duration::from_secs(2));

        let value = queue.pop().await;
        assert_eq!(value, 2);
        assert_eq!(now.elapsed(), Duration::from_secs(2));
    }
}
