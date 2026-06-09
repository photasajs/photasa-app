//! 扫描队列等工作流依赖的内置数组/对象操作（对齐 Electron BuiltinAdapter，RFC 0045/0048）

use serde_json::{json, Map, Value};

use crate::expression::resolve_value;
use crate::types::ExecutionContext;

fn normalize_array(value: &Value) -> Vec<Value> {
    match value {
        Value::Array(items) => items.clone(),
        Value::Null => Vec::new(),
        _ => Vec::new(),
    }
}

fn get_nested_value(value: &Value, path: &str) -> Value {
    if path.is_empty() {
        return value.clone();
    }
    let mut current = value;
    for key in path.split('.') {
        match current {
            Value::Object(map) => {
                current = map.get(key).unwrap_or(&Value::Null);
            }
            _ => return Value::Null,
        }
    }
    current.clone()
}

fn json_values_equal(left: &Value, right: &Value) -> bool {
    left == right
}

fn compare_values(left: &Value, op: &str, right: &Value) -> bool {
    match op {
        "eq" => json_values_equal(left, right),
        "ne" => !json_values_equal(left, right),
        "gt" => left.as_f64().unwrap_or(0.0) > right.as_f64().unwrap_or(0.0),
        "lt" => left.as_f64().unwrap_or(0.0) < right.as_f64().unwrap_or(0.0),
        "gte" => left.as_f64().unwrap_or(0.0) >= right.as_f64().unwrap_or(0.0),
        "lte" => left.as_f64().unwrap_or(0.0) <= right.as_f64().unwrap_or(0.0),
        _ => false,
    }
}

fn parse_literal_rhs(raw: &str) -> Value {
    let trimmed = raw.trim();
    if (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
    {
        return Value::String(trimmed[1..trimmed.len() - 1].to_string());
    }
    if let Ok(num) = trimmed.parse::<f64>() {
        return json!(num);
    }
    if trimmed == "true" {
        return Value::Bool(true);
    }
    if trimmed == "false" {
        return Value::Bool(false);
    }
    Value::String(trimmed.to_string())
}

fn resolve_rhs(raw: &str, ctx: &ExecutionContext) -> Value {
    let trimmed = raw.trim();
    if trimmed.starts_with("inputs.") || trimmed.starts_with("variables.") {
        return resolve_value(&Value::String(format!("{{{{{trimmed}}}}}")), ctx);
    }
    parse_literal_rhs(trimmed)
}

fn parse_item_eq_predicate(predicate: &str) -> Option<(String, String)> {
    let re_match = predicate.trim();
    let parts: Vec<&str> = re_match.split("===").collect();
    if parts.len() == 2 {
        let left = parts[0].trim();
        let right = parts[1].trim();
        if let Some(field) = left.strip_prefix("item.") {
            return Some((field.to_string(), right.to_string()));
        }
    }
    let parts: Vec<&str> = re_match.split("==").collect();
    if parts.len() == 2 {
        let left = parts[0].trim();
        let right = parts[1].trim();
        if let Some(field) = left.strip_prefix("item.") {
            return Some((field.to_string(), right.to_string()));
        }
    }
    None
}

pub fn array_concat(input: &Value) -> Value {
    let array1 = normalize_array(input.get("array1").unwrap_or(&Value::Null));
    let array2 = normalize_array(input.get("array2").unwrap_or(&Value::Null));
    let mut merged = array1;
    merged.extend(array2);
    Value::Array(merged)
}

pub fn array_filter(input: &Value) -> Value {
    let array = match input.get("array") {
        Some(Value::Array(items)) => items.clone(),
        Some(Value::Null) | None => Vec::new(),
        _ => return Value::Array(Vec::new()),
    };

    let condition = match input.get("condition") {
        Some(Value::Object(map)) => map,
        _ => return Value::Array(array),
    };

    let field = condition
        .get("field")
        .and_then(|v| v.as_str())
        .unwrap_or("path");
    let operator = condition
        .get("operator")
        .and_then(|v| v.as_str())
        .unwrap_or("eq");
    let expected = condition.get("value").cloned().unwrap_or(Value::Null);

    let filtered: Vec<Value> = array
        .into_iter()
        .filter(|item| {
            let actual = get_nested_value(&item, field);
            compare_values(&actual, operator, &expected)
        })
        .collect();

    Value::Array(filtered)
}

pub fn array_find(input: &Value, ctx: &ExecutionContext) -> Value {
    let array = match input.get("array") {
        Some(Value::Array(items)) => items.clone(),
        _ => {
            if input.get("returnIndex").and_then(|v| v.as_bool()).unwrap_or(false) {
                return json!(-1);
            }
            return Value::Null;
        }
    };

    let return_index = input
        .get("returnIndex")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if let Some(Value::Object(obj)) = input.get("predicate") {
        let field = obj.get("field").and_then(|v| v.as_str()).unwrap_or("path");
        let expected = obj.get("value").cloned().unwrap_or(Value::Null);
        for (idx, item) in array.iter().enumerate() {
            if json_values_equal(&get_nested_value(item, field), &expected) {
                return if return_index {
                    json!(idx)
                } else {
                    item.clone()
                };
            }
        }
        return if return_index { json!(-1) } else { Value::Null };
    }

    if let Some(predicate) = input.get("predicate").and_then(|v| v.as_str()) {
        if let Some((field, rhs)) = parse_item_eq_predicate(predicate) {
            let expected = resolve_rhs(&rhs, ctx);
            for (idx, item) in array.iter().enumerate() {
                if json_values_equal(&get_nested_value(item, &field), &expected) {
                    return if return_index {
                        json!(idx)
                    } else {
                        item.clone()
                    };
                }
            }
        }
    }

    if return_index {
        json!(-1)
    } else {
        Value::Null
    }
}

pub fn array_get(input: &Value) -> Value {
    let array = match input.get("array") {
        Some(Value::Array(items)) => items,
        _ => return Value::Null,
    };
    let index = input.get("index").and_then(|v| v.as_i64()).unwrap_or(0) as isize;
    let len = array.len() as isize;
    let actual = if index < 0 { len + index } else { index };
    if actual < 0 || actual as usize >= array.len() {
        return Value::Null;
    }
    array[actual as usize].clone()
}

pub fn array_set(input: &Value) -> Value {
    let array = match input.get("array") {
        Some(Value::Array(items)) => items.clone(),
        _ => return Value::Array(Vec::new()),
    };
    let index = input.get("index").and_then(|v| v.as_i64()).unwrap_or(0) as isize;
    let value = input.get("value").cloned().unwrap_or(Value::Null);
    let len = array.len() as isize;
    let actual = if index < 0 { len + index } else { index };
    if actual < 0 || actual as usize >= array.len() {
        return Value::Array(array);
    }
    let mut next = array;
    next[actual as usize] = value;
    Value::Array(next)
}

pub fn object_merge(input: &Value) -> Value {
    let base = input
        .get("base")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    let updates = input
        .get("updates")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    let additional = input
        .get("additional")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let mut merged = Map::new();
    for (k, v) in base {
        merged.insert(k, v);
    }
    for (k, v) in updates {
        merged.insert(k, v);
    }
    for (k, v) in additional {
        merged.insert(k, v);
    }
    Value::Object(merged)
}

pub fn conditional(input: &Value) -> Value {
    let condition = input.get("condition").cloned().unwrap_or(Value::Bool(false));
    let pass = match &condition {
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_i64().unwrap_or(0) >= 0,
        Value::String(s) => {
            let trimmed = s.trim();
            if trimmed.eq_ignore_ascii_case("true") {
                true
            } else if trimmed.eq_ignore_ascii_case("false") {
                false
            } else if let Some((left, op, right)) = parse_numeric_comparison(trimmed) {
                compare_values(&json!(left), op, &json!(right))
            } else {
                !trimmed.is_empty()
            }
        }
        Value::Null => false,
        _ => true,
    };

    if pass {
        input.get("onTrue").cloned().unwrap_or(Value::Null)
    } else {
        input.get("onFalse").cloned().unwrap_or(Value::Null)
    }
}

fn parse_numeric_comparison(input: &str) -> Option<(f64, &str, f64)> {
    let trimmed = input.trim();
    for op in [">=", "<=", "===", "==", "!==", "!=", ">", "<"] {
        if let Some((left, right)) = trimmed.split_once(op) {
            if let (Ok(l), Ok(r)) = (left.trim().parse::<f64>(), right.trim().parse::<f64>()) {
                return Some((l, op, r));
            }
        }
    }
    None
}

pub fn run_builtin_action(action: &str, input: &Value, ctx: &ExecutionContext) -> Option<Value> {
    match action {
        "arrayConcat" => Some(array_concat(input)),
        "arrayFilter" => Some(array_filter(input)),
        "arrayFind" => Some(array_find(input, ctx)),
        "arrayGet" => Some(array_get(input)),
        "arraySet" => Some(array_set(input)),
        "objectMerge" => Some(object_merge(input)),
        "conditional" => Some(conditional(input)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ExecutionContext;

    #[test]
    fn array_concat_merges_two_arrays() {
        let input = json!({
            "array1": [{ "path": "/a" }],
            "array2": [{ "path": "/b", "action": "rescan" }]
        });
        let result = array_concat(&input);
        assert_eq!(result.as_array().map(|a| a.len()), Some(2));
    }

    #[test]
    fn array_filter_removes_matching_path() {
        let input = json!({
            "array": [
                { "path": "/keep" },
                { "path": "/drop" }
            ],
            "condition": {
                "field": "path",
                "operator": "ne",
                "value": "/drop"
            }
        });
        let result = array_filter(&input);
        let items = result.as_array().unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0]["path"], "/keep");
    }

    #[test]
    fn array_find_returns_index_with_inputs_predicate() {
        let ctx = ExecutionContext::new(json!({
            "path": "/photos",
            "status": "pending"
        }));
        let input = json!({
            "array": [
                { "path": "/other" },
                { "path": "/photos", "status": "pending" }
            ],
            "predicate": "item.path === inputs.path",
            "returnIndex": true
        });
        let result = array_find(&input, &ctx);
        assert_eq!(result, json!(1));
    }

    #[test]
    fn conditional_parses_numeric_comparison() {
        let input = json!({
            "condition": "2 >= 0",
            "onTrue": { "success": true },
            "onFalse": { "success": false, "error": "missing" }
        });
        let result = conditional(&input);
        assert_eq!(result["success"], true);
    }
}
