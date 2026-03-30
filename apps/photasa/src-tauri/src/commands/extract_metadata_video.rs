//! 视频元数据：`ffmpeg-next` / libavformat（与 crate 一并静态链接的 FFmpeg），输出形状对齐原 ffprobe JSON

use super::ffmpeg_next_util::{ensure_ffmpeg_initialized, rotation_deg_from_display_matrix};
use ffmpeg_next as ff;
use ffmpeg_next::codec::packet::side_data::Type as PacketSideDataType;
use ffmpeg_next::media::Type as MediaType;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::path::Path;

/// 与 `VIDEO_TIME_FIELDS`（video-extractor.ts）顺序一致
const VIDEO_TIME_FIELDS: &[&str] = &[
    "com.apple.quicktime.creationdate",
    "creation_time",
    "date",
];

const VIDEO_LOCATION_TAGS: &[&str] = &["location", "com.apple.quicktime.location.ISO6709"];

fn dict_to_json_map(d: &ff::DictionaryRef<'_>) -> Map<String, Value> {
    let mut m = Map::new();
    for (k, v) in d.iter() {
        m.insert(k.to_string(), json!(v));
    }
    m
}

fn stream_to_probe_json(stream: &ff::Stream<'_>) -> Result<Value, ff::Error> {
    let ctx = ff::codec::context::Context::from_parameters(stream.parameters())?;
    let codec_name = ctx.id().name();
    let medium = ctx.medium();
    let tags = dict_to_json_map(&stream.metadata());
    let mut obj = Map::new();

    match medium {
        MediaType::Video => {
            let vdec = ctx.decoder().video()?;
            obj.insert("codec_type".to_string(), json!("video"));
            obj.insert("codec_name".to_string(), json!(codec_name));
            obj.insert("width".to_string(), json!(vdec.width()));
            obj.insert("height".to_string(), json!(vdec.height()));
            if !tags.is_empty() {
                obj.insert("tags".to_string(), Value::Object(tags));
            }
            let mut list = Vec::new();
            for sd in stream.side_data() {
                if sd.kind() == PacketSideDataType::DisplayMatrix {
                    if let Some(rot) = rotation_deg_from_display_matrix(sd.data()) {
                        let mut e = Map::new();
                        e.insert("side_data_type".to_string(), json!("Display Matrix"));
                        e.insert("rotation".to_string(), json!(rot));
                        list.push(Value::Object(e));
                    }
                }
            }
            if !list.is_empty() {
                obj.insert("side_data_list".to_string(), json!(list));
            }
        }
        MediaType::Audio => {
            let _dec = ctx.decoder().audio();
            obj.insert("codec_type".to_string(), json!("audio"));
            obj.insert("codec_name".to_string(), json!(codec_name));
            if !tags.is_empty() {
                obj.insert("tags".to_string(), Value::Object(tags));
            }
        }
        _ => {
            let _decoder = ctx.decoder();
            obj.insert("codec_type".to_string(), json!("data"));
            obj.insert("codec_name".to_string(), json!(codec_name));
            if !tags.is_empty() {
                obj.insert("tags".to_string(), Value::Object(tags));
            }
        }
    }

    Ok(Value::Object(obj))
}

/// 打开文件并构造与 `ffprobe -print_format json -show_format -show_streams` 相近的结构
fn probe_to_json(path: &Path) -> Result<Value, String> {
    ensure_ffmpeg_initialized();
    let ictx = ff::format::input(path).map_err(|e| e.to_string())?;

    let duration_sec = if ictx.duration() > 0 {
        ictx.duration() as f64 / f64::from(ff::ffi::AV_TIME_BASE)
    } else {
        0.0
    };

    let format_tags = dict_to_json_map(&ictx.metadata());
    let mut format_obj = Map::new();
    format_obj.insert(
        "duration".to_string(),
        json!(format!("{duration_sec:.6}")),
    );
    if !format_tags.is_empty() {
        format_obj.insert("tags".to_string(), Value::Object(format_tags));
    }

    let mut streams = Vec::new();
    for i in 0..ictx.nb_streams() as usize {
        if let Some(st) = ictx.stream(i) {
            match stream_to_probe_json(&st) {
                Ok(v) => streams.push(v),
                Err(_) => {
                    streams.push(json!({ "index": i }));
                }
            }
        }
    }

    let mut root = Map::new();
    root.insert("format".to_string(), Value::Object(format_obj));
    root.insert("streams".to_string(), json!(streams));
    Ok(Value::Object(root))
}

fn is_plausible_video_date(s: &str) -> bool {
    let t = s.trim();
    !t.is_empty()
        && t != "0000-00-00T00:00:00.000000Z"
        && t != "invalid-date"
        && !t.starts_with("1970-01-01T00:00:00")
}

/// 将常见容器时间字符串转为 RFC3339（供前端 `Date`）
fn parse_video_date_str(s: &str) -> Option<String> {
    let t = s.trim();
    if !is_plausible_video_date(t) {
        return None;
    }
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(t) {
        return Some(dt.with_timezone(&chrono::Utc).to_rfc3339());
    }
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(t) {
        return Some(dt.with_timezone(&chrono::Utc).to_rfc3339());
    }
    for fmt in &[
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S%.f",
        "%Y:%m:%d %H:%M:%S",
    ] {
        if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(t, fmt) {
            let dt = naive.and_utc();
            return Some(dt.to_rfc3339());
        }
    }
    if let Ok(d) = chrono::NaiveDate::parse_from_str(t, "%Y-%m-%d") {
        if let Some(naive) = d.and_hms_opt(0, 0, 0) {
            return Some(naive.and_utc().to_rfc3339());
        }
    }
    None
}

fn tag_str<'a>(tags: Option<&'a Value>, key: &str) -> Option<&'a str> {
    tags?.get(key)?.as_str()
}

fn select_best_date(meta: &Value) -> Option<String> {
    let format_tags = meta.get("format").and_then(|f| f.get("tags"));
    for field in VIDEO_TIME_FIELDS {
        if let Some(v) = tag_str(format_tags, field) {
            if let Some(rfc) = parse_video_date_str(v) {
                return Some(rfc);
            }
        }
    }
    if let Some(streams) = meta.get("streams").and_then(|s| s.as_array()) {
        for stream in streams {
            let stream_tags = stream.get("tags");
            for field in VIDEO_TIME_FIELDS {
                if let Some(v) = tag_str(stream_tags, field) {
                    if let Some(rfc) = parse_video_date_str(v) {
                        return Some(rfc);
                    }
                }
            }
        }
    }
    None
}

fn parse_iso6709(location: &str) -> Option<(f64, f64)> {
    let re = Regex::new(r"([+-]\d+\.?\d*)([+-]\d+\.?\d*)").ok()?;
    let cap = re.captures(location.trim())?;
    let lat: f64 = cap.get(1)?.as_str().parse().ok()?;
    let lon: f64 = cap.get(2)?.as_str().parse().ok()?;
    Some((lat, lon))
}

fn extract_video_gps(meta: &Value) -> Option<(f64, f64)> {
    let streams = meta.get("streams")?.as_array()?;
    for stream in streams {
        let tags = stream.get("tags");
        for field in VIDEO_LOCATION_TAGS {
            if let Some(loc) = tag_str(tags, field) {
                if let Some(ll) = parse_iso6709(loc) {
                    return Some(ll);
                }
            }
        }
    }
    None
}

fn video_rotation(meta: &Value) -> i32 {
    let streams = match meta.get("streams").and_then(|s| s.as_array()) {
        Some(a) => a,
        None => return 0,
    };
    let stream = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(|v| v.as_str()) == Some("video"));
    let stream = match stream {
        Some(s) => s,
        None => return 0,
    };
    if let Some(r) = stream
        .get("tags")
        .and_then(|t| t.get("rotate"))
        .and_then(|v| v.as_str())
    {
        return r.parse::<i32>().unwrap_or(0);
    }
    if let Some(list) = stream.get("side_data_list").and_then(|v| v.as_array()) {
        for item in list {
            if item.get("side_data_type").and_then(|v| v.as_str()) == Some("Display Matrix") {
                if let Some(rot) = item.get("rotation").and_then(|v| v.as_f64()) {
                    let mut r = rot as i32;
                    r = ((r % 360) + 360) % 360;
                    return r;
                }
            }
        }
    }
    if let Some(r) = meta
        .get("format")
        .and_then(|f| f.get("tags"))
        .and_then(|t| t.get("rotate"))
        .and_then(|v| v.as_str())
    {
        return r.parse::<i32>().unwrap_or(0);
    }
    0
}

fn video_stream_dims(meta: &Value, rotation_deg: i32) -> (u32, u32, String) {
    let streams = match meta.get("streams").and_then(|s| s.as_array()) {
        Some(a) => a,
        None => return (0, 0, "unknown".to_string()),
    };
    let stream = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(|v| v.as_str()) == Some("video"));
    let stream = match stream {
        Some(s) => s,
        None => return (0, 0, "unknown".to_string()),
    };
    let mut w = stream.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let mut h = stream.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
    let codec = stream
        .get("codec_name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    if rotation_deg == 90 || rotation_deg == 270 {
        std::mem::swap(&mut w, &mut h);
    }
    (w, h, codec)
}

/// 向已有 `FileMetadata` JSON 合并视频字段；失败时静默跳过
pub(crate) fn enrich_from_ffprobe(path: &Path, out: &mut Value) {
    let meta = match probe_to_json(path) {
        Ok(m) => m,
        Err(e) => {
            log::debug!("🌌 视频元数据 ffmpeg-next 跳过：{e}");
            return;
        }
    };

    let duration = meta
        .get("format")
        .and_then(|f| f.get("duration"))
        .and_then(|v| {
            v.as_str()
                .and_then(|s| s.parse::<f64>().ok())
                .or_else(|| v.as_f64())
        })
        .unwrap_or(0.0);

    let rot = video_rotation(&meta);
    let (w, h, codec) = video_stream_dims(&meta, rot);

    let Some(root) = out.as_object_mut() else {
        return;
    };

    root.insert("duration".to_string(), json!(duration));
    root.insert("codec".to_string(), json!(codec));
    if w > 0 && h > 0 {
        root.insert("width".to_string(), json!(w));
        root.insert("height".to_string(), json!(h));
        let mut res = Map::new();
        res.insert("width".to_string(), json!(w));
        res.insert("height".to_string(), json!(h));
        root.insert("resolution".to_string(), Value::Object(res));
    }
    if rot != 0 {
        match root.get_mut("rawMetadata") {
            Some(Value::Object(rm)) => {
                rm.insert("rotation".to_string(), json!(rot));
            }
            _ => {
                root.insert(
                    "rawMetadata".to_string(),
                    json!({ "rotation": rot }),
                );
            }
        }
    }

    if let Some(rfc) = select_best_date(&meta) {
        root.insert("dateTime".to_string(), Value::String(rfc));
        root.insert("dateSource".to_string(), json!("video_metadata"));
    }

    if let Some((lat, lon)) = extract_video_gps(&meta) {
        let mut gps = Map::new();
        gps.insert("latitude".to_string(), json!(lat));
        gps.insert("longitude".to_string(), json!(lon));
        root.insert("gpsInfo".to_string(), Value::Object(gps));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_iso6709_basic() {
        let r = parse_iso6709("+37.7749-122.4194/").expect("parse");
        assert!((r.0 - 37.7749).abs() < 0.001);
        assert!((r.1 - -122.4194).abs() < 0.001);
    }

    #[test]
    fn parse_video_date_rejects_epoch_sentinel() {
        assert!(parse_video_date_str("1970-01-01T00:00:00.000000Z").is_none());
    }

    #[test]
    fn select_best_date_from_sample_json() {
        let meta: Value = serde_json::from_str(
            r#"{"format":{"tags":{"creation_time":"2021-05-15T10:30:00.000000Z"}},"streams":[]}"#,
        )
        .unwrap();
        let d = select_best_date(&meta).expect("date");
        assert!(d.contains("2021"));
    }
}
