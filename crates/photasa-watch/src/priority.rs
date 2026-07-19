//! 与 `packages/common` `FileOperationPriorities` 一致

use photasa_types::FileOperationType;

pub fn event_priority(op_type: &str) -> i64 {
    match op_type {
        "delete" | "deleteDir" => 1,
        "change" => 2,
        "add" => 3,
        "addDir" => 4,
        _ => 5,
    }
}

pub fn event_priority_typed(op: FileOperationType) -> i64 {
    event_priority(crate::operation_type_str(op))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn priority_matches_common_constants() {
        assert_eq!(event_priority("delete"), 1);
        assert_eq!(event_priority("deleteDir"), 1);
        assert_eq!(event_priority("change"), 2);
        assert_eq!(event_priority("add"), 3);
        assert_eq!(event_priority("addDir"), 4);
        assert_eq!(event_priority("unknown"), 5);
    }

    #[test]
    fn event_priority_typed_matches_string_table() {
        assert_eq!(event_priority_typed(FileOperationType::Delete), 1);
        assert_eq!(event_priority_typed(FileOperationType::DeleteDir), 1);
        assert_eq!(event_priority_typed(FileOperationType::Change), 2);
        assert_eq!(event_priority_typed(FileOperationType::Add), 3);
        assert_eq!(event_priority_typed(FileOperationType::AddDir), 4);
    }
}

