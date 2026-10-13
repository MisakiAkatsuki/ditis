use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct OpenFileRequest {
    pub id: u64,
    pub path: String,
}

#[derive(Clone, Debug, Serialize)]
pub struct OpenFileDelivery {
    pub generation: u64,
    pub files: Vec<OpenFileRequest>,
}

#[derive(Default)]
pub struct OpenFiles {
    ready: bool,
    generation: u64,
    next_id: u64,
    pending: Vec<OpenFileRequest>,
}

impl OpenFiles {
    pub fn enqueue(&mut self, path: String) -> Option<OpenFileDelivery> {
        if !self.pending.iter().any(|request| request.path == path) {
            self.next_id += 1;
            self.pending.push(OpenFileRequest { id: self.next_id, path });
        }
        self.ready.then(|| self.delivery())
    }

    fn delivery(&self) -> OpenFileDelivery {
        OpenFileDelivery { generation: self.generation, files: self.pending.clone() }
    }

    pub fn frontend_ready(&mut self) -> OpenFileDelivery {
        self.ready = true;
        self.delivery()
    }

    pub fn navigation_started(&mut self) {
        self.ready = false;
        self.generation += 1;
    }

    pub fn acknowledge(&mut self, generation: u64, id: u64) -> bool {
        if !self.ready || generation != self.generation { return false; }
        let count = self.pending.len();
        self.pending.retain(|request| request.id != id);
        self.pending.len() != count
    }
}

#[cfg(test)]
mod tests {
    use super::OpenFiles;

    #[test]
    fn readiness_and_emission_do_not_consume_pending_files() {
        let mut files = OpenFiles::default();
        assert!(files.enqueue("first.ditis".into()).is_none());
        let initial = files.frontend_ready();
        assert_eq!(initial.files.len(), 1);
        let emitted = files.enqueue("second.ditis".into()).unwrap();
        assert_eq!(emitted.files.len(), 2);
        assert_eq!(files.frontend_ready().files.len(), 2);
    }

    #[test]
    fn lost_emission_is_replayed_after_navigation() {
        let mut files = OpenFiles::default();
        files.frontend_ready();
        let emitted = files.enqueue("during-reload.ditis".into()).unwrap();
        files.navigation_started();
        let replayed = files.frontend_ready();
        assert_eq!(replayed.files[0].id, emitted.files[0].id);
        assert_eq!(replayed.files[0].path, "during-reload.ditis");
        assert_ne!(replayed.generation, emitted.generation);
    }

    #[test]
    fn old_page_cannot_acknowledge_after_double_navigation_reset() {
        let mut files = OpenFiles::default();
        files.enqueue("loading.ditis".into());
        let old = files.frontend_ready();
        files.navigation_started();
        files.navigation_started();
        assert!(!files.acknowledge(old.generation, old.files[0].id));
        files.enqueue("new.ditis".into());
        let new = files.frontend_ready();
        assert!(!files.acknowledge(old.generation, old.files[0].id));
        assert_eq!(new.files.len(), 2);
        assert!(files.acknowledge(new.generation, old.files[0].id));
        assert_eq!(files.frontend_ready().files[0].path, "new.ditis");
    }

    #[test]
    fn acknowledgements_only_remove_the_completed_request() {
        let mut files = OpenFiles::default();
        files.enqueue("one.ditis".into());
        files.enqueue("two.ditis".into());
        let delivery = files.frontend_ready();
        assert!(!files.acknowledge(delivery.generation, 999));
        assert!(files.acknowledge(delivery.generation, delivery.files[0].id));
        assert!(!files.acknowledge(delivery.generation, delivery.files[0].id));
        assert_eq!(files.frontend_ready().files[0].path, "two.ditis");
    }

    #[test]
    fn duplicate_pending_os_requests_share_one_id() {
        let mut files = OpenFiles::default();
        files.enqueue("same.ditis".into());
        files.enqueue("same.ditis".into());
        assert_eq!(files.frontend_ready().files.len(), 1);
    }
}
