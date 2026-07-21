//! 与 legacy-api `getDeduplicationWindow` / `shouldDeduplicateEvent` 一致

pub fn deduplication_window_ms(op_type: &str) -> u64 {
 match op_type {
 "add" => 50,
 "change" => 200,
 "delete" => 100,
 "addDir" => 100,
 "deleteDir" => 100,
 _ => 100,
 }
}

pub fn should_deduplicate(existing_ts: u64, current: u64, window_ms: u64) -> bool {
 current.saturating_sub(existing_ts) < window_ms
}

#[cfg(test)]
mod tests {
 use super::*;

 #[test]
 fn dedup_window_matches_common() {
 assert_eq!(deduplication_window_ms("add"), 50);
 assert_eq!(deduplication_window_ms("change"), 200);
 assert_eq!(deduplication_window_ms("delete"), 100);
 assert_eq!(deduplication_window_ms("addDir"), 100);
 assert_eq!(deduplication_window_ms("deleteDir"), 100);
 assert_eq!(deduplication_window_ms("other"), 100);
 }

 #[test]
 fn should_deduplicate_respects_window() {
 assert!(should_deduplicate(1000, 1005, 200));
 assert!(!should_deduplicate(1000, 1300, 200));
 }
}
