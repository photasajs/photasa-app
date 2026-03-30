//! JPEG/TIFF EXIF enrichment for `extract_metadata`（`kamadak-exif`，对齐常见 EXIF 标签）

use chrono::{Local, NaiveDateTime};
use exif::{Exif, Reader, Tag, Value as ExifValue};
use serde_json::{json, Map, Value};
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::Path;

fn read_file_bytes(path: &Path) -> Option<Vec<u8>> {
    let mut f = File::open(path).ok()?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).ok()?;
    Some(buf)
}

fn ascii_first(v: &ExifValue) -> Option<String> {
    match v {
        ExifValue::Ascii(parts) => {
            let b = parts.first()?;
            let s = std::str::from_utf8(b).ok()?.trim_end_matches('\0').trim();
            if s.is_empty() {
                None
            } else {
                Some(s.to_string())
            }
        }
        _ => None,
    }
}

fn dms_triple(v: &ExifValue) -> Option<(f64, f64, f64)> {
    match v {
        ExifValue::Rational(parts) if parts.len() >= 3 => {
            let d = parts[0].num as f64 / f64::from(parts[0].denom.max(1));
            let m = parts[1].num as f64 / f64::from(parts[1].denom.max(1));
            let s = parts[2].num as f64 / f64::from(parts[2].denom.max(1));
            Some((d, m, s))
        }
        _ => None,
    }
}

fn signed_decimal(deg: f64, min: f64, sec: f64, positive_ref: bool) -> f64 {
    let v = deg + min / 60.0 + sec / 3600.0;
    if positive_ref { v } else { -v }
}

fn parse_exif_datetime(s: &str) -> Option<String> {
    let naive = NaiveDateTime::parse_from_str(s.trim(), "%Y:%m:%d %H:%M:%S").ok()?;
    let local = naive.and_local_timezone(Local).single()?;
    Some(local.to_rfc3339())
}

fn apply_parsed(exif: &Exif, out: &mut Value) {
    let mut datetime_raw: Option<String> = None;
    let mut gps_lat: Option<&ExifValue> = None;
    let mut gps_lon: Option<&ExifValue> = None;
    let mut gps_lat_ref: Option<String> = None;
    let mut gps_lon_ref: Option<String> = None;
    let mut gps_alt: Option<&ExifValue> = None;
    let mut make: Option<String> = None;
    let mut model: Option<String> = None;

    for f in exif.fields() {
        match f.tag {
            Tag::DateTimeOriginal => {
                if datetime_raw.is_none() {
                    datetime_raw = ascii_first(&f.value);
                }
            }
            Tag::DateTime => {
                if datetime_raw.is_none() {
                    datetime_raw = ascii_first(&f.value);
                }
            }
            Tag::GPSLatitude => gps_lat = Some(&f.value),
            Tag::GPSLongitude => gps_lon = Some(&f.value),
            Tag::GPSLatitudeRef => gps_lat_ref = ascii_first(&f.value),
            Tag::GPSLongitudeRef => gps_lon_ref = ascii_first(&f.value),
            Tag::GPSAltitude => gps_alt = Some(&f.value),
            Tag::Make => {
                if make.is_none() {
                    make = ascii_first(&f.value);
                }
            }
            Tag::Model => {
                if model.is_none() {
                    model = ascii_first(&f.value);
                }
            }
            _ => {}
        }
    }

    let Some(root) = out.as_object_mut() else {
        return;
    };

    if let Some(asc) = datetime_raw {
        if let Some(rfc) = parse_exif_datetime(&asc) {
            root.insert("dateTime".to_string(), Value::String(rfc));
            root.insert("dateSource".to_string(), json!("exif"));
        }
    }

    if let (Some(lat_v), Some(lon_v), Some(lref), Some(oref)) = (
        gps_lat,
        gps_lon,
        gps_lat_ref.as_deref(),
        gps_lon_ref.as_deref(),
    ) {
        let lat_ok = lref.eq_ignore_ascii_case("N");
        let lon_ok = oref.eq_ignore_ascii_case("E");
        if let (Some((d1, m1, s1)), Some((d2, m2, s2))) =
            (dms_triple(lat_v), dms_triple(lon_v))
        {
            let lat = signed_decimal(d1, m1, s1, lat_ok);
            let lon = signed_decimal(d2, m2, s2, lon_ok);
            let alt = gps_alt.and_then(|v| {
                if let ExifValue::Rational(parts) = v {
                    let r = parts.first()?;
                    Some(r.num as f64 / f64::from(r.denom.max(1)))
                } else {
                    None
                }
            });
            let mut gps = Map::new();
            gps.insert("latitude".to_string(), json!(lat));
            gps.insert("longitude".to_string(), json!(lon));
            if let Some(a) = alt {
                gps.insert("altitude".to_string(), json!(a));
            }
            root.insert("gpsInfo".to_string(), Value::Object(gps));
        }
    }

    if make.is_some() || model.is_some() {
        let mut cam = Map::new();
        if let Some(s) = make {
            cam.insert("make".to_string(), json!(s));
        }
        if let Some(s) = model {
            cam.insert("model".to_string(), json!(s));
        }
        root.insert("cameraInfo".to_string(), Value::Object(cam));
    }
}

/// 若文件含可读 EXIF，向 `out` 写入 `dateTime`（RFC3339）、`dateSource: exif`、`gpsInfo`、`cameraInfo`
pub(crate) fn enrich_from_exif(path: &Path, out: &mut Value) {
    let bytes = match read_file_bytes(path) {
        Some(b) => b,
        None => return,
    };
    let mut cursor = Cursor::new(bytes);
    let exif = match Reader::new().read_from_container(&mut cursor) {
        Ok(e) => e,
        Err(_) => return,
    };
    apply_parsed(&exif, out);
}
