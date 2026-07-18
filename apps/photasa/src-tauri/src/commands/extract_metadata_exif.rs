//! JPEG/TIFF EXIF enrichment for `extract_metadata`（`kamadak-exif`，对齐常见 EXIF 标签）

use chrono::{DateTime, Datelike, Local, NaiveDateTime, Utc};
use exif::{Exif, Reader, Value as ExifValue};

/// EXIF tag numbers（按 number 匹配，兼容 Pillow 等写入 `Context::Tiff` 的 Exif 标签）
mod exif_tag_no {
    pub const DATE_TIME: u16 = 0x0132;
    pub const MAKE: u16 = 0x010f;
    pub const MODEL: u16 = 0x0110;
    pub const EXPOSURE_TIME: u16 = 0x829a;
    pub const F_NUMBER: u16 = 0x829d;
    pub const PHOTOGRAPHIC_SENSITIVITY: u16 = 0x8827;
    pub const RECOMMENDED_EXPOSURE_INDEX: u16 = 0x9212;
    pub const ISO_SPEED: u16 = 0x8833;
    pub const STANDARD_OUTPUT_SENSITIVITY: u16 = 0x8830;
    pub const FOCAL_LENGTH: u16 = 0x920a;
    pub const DATE_TIME_ORIGINAL: u16 = 0x9003;
    pub const DATE_TIME_DIGITIZED: u16 = 0x9004;
    pub const GPS_LATITUDE_REF: u16 = 0x0001;
    pub const GPS_LATITUDE: u16 = 0x0002;
    pub const GPS_LONGITUDE_REF: u16 = 0x0003;
    pub const GPS_LONGITUDE: u16 = 0x0004;
    pub const GPS_ALTITUDE: u16 = 0x0006;
    pub const LENS_MODEL: u16 = 0xa434;
}
use exif_tag_no as etn;
use serde_json::{json, Map, Value};
use std::fs::File;
use std::io::{Cursor, Read};
use std::path::Path;
use std::time::SystemTime;

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
    if positive_ref {
        v
    } else {
        -v
    }
}

fn parse_exif_datetime(s: &str) -> Option<String> {
    let naive = NaiveDateTime::parse_from_str(s.trim(), "%Y:%m:%d %H:%M:%S").ok()?;
    let local = naive.and_local_timezone(Local).single()?;
    Some(local.to_rfc3339())
}

/// 读取 EXIF 中第一个 rational / double / 整数，转为浮点（Pillow 等写入 `Double` 而非 `Rational`）
fn first_numeric_as_f64(v: &ExifValue) -> Option<f64> {
    match v {
        ExifValue::Rational(parts) => {
            let r = parts.first()?;
            let d = r.denom.max(1);
            Some(f64::from(r.num) / f64::from(d))
        }
        ExifValue::Double(parts) => parts.first().copied(),
        ExifValue::Short(parts) => parts.first().map(|&x| f64::from(x)),
        ExifValue::Long(parts) => parts.first().map(|&x| f64::from(x)),
        _ => None,
    }
}

/// 读取 EXIF 中第一个 rational，转为 `num/denom` 浮点（用于焦距、光圈、`ExposureTime` 秒数等）
fn first_rational_as_f64(v: &ExifValue) -> Option<f64> {
    first_numeric_as_f64(v)
}

/// ISO / 感光度：常见为 `PhotographicSensitivity` Short，部分机型为 Long
fn iso_from_exif_value(v: &ExifValue) -> Option<u32> {
    match v {
        ExifValue::Short(parts) => parts.first().map(|&x| u32::from(x)),
        ExifValue::Long(parts) => parts.first().copied(),
        _ => None,
    }
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
    let mut lens: Option<String> = None;
    let mut iso_primary: Option<u32> = None;
    let mut iso_fallback: Option<u32> = None;
    let mut focal_mm: Option<f64> = None;
    let mut aperture: Option<f64> = None;
    let mut shutter_sec: Option<f64> = None;

    for f in exif.fields() {
        match f.tag.number() {
            etn::DATE_TIME_ORIGINAL | etn::DATE_TIME_DIGITIZED | etn::DATE_TIME => {
                if datetime_raw.is_none() {
                    datetime_raw = ascii_first(&f.value);
                }
            }
            etn::GPS_LATITUDE => gps_lat = Some(&f.value),
            etn::GPS_LONGITUDE => gps_lon = Some(&f.value),
            etn::GPS_LATITUDE_REF => gps_lat_ref = ascii_first(&f.value),
            etn::GPS_LONGITUDE_REF => gps_lon_ref = ascii_first(&f.value),
            etn::GPS_ALTITUDE => gps_alt = Some(&f.value),
            etn::MAKE => {
                if make.is_none() {
                    make = ascii_first(&f.value);
                }
            }
            etn::MODEL => {
                if model.is_none() {
                    model = ascii_first(&f.value);
                }
            }
            etn::LENS_MODEL => {
                if lens.is_none() {
                    lens = ascii_first(&f.value);
                }
            }
            etn::PHOTOGRAPHIC_SENSITIVITY | etn::RECOMMENDED_EXPOSURE_INDEX => {
                if iso_primary.is_none() {
                    iso_primary = iso_from_exif_value(&f.value);
                }
            }
            etn::ISO_SPEED | etn::STANDARD_OUTPUT_SENSITIVITY => {
                if iso_fallback.is_none() {
                    iso_fallback = iso_from_exif_value(&f.value);
                }
            }
            etn::FOCAL_LENGTH => {
                if focal_mm.is_none() {
                    focal_mm = first_rational_as_f64(&f.value);
                }
            }
            etn::F_NUMBER => {
                if aperture.is_none() {
                    aperture = first_rational_as_f64(&f.value);
                }
            }
            etn::EXPOSURE_TIME => {
                if shutter_sec.is_none() {
                    shutter_sec = first_rational_as_f64(&f.value);
                }
            }
            _ => {}
        }
    }

    let iso = iso_primary.or(iso_fallback);

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
        if let (Some((d1, m1, s1)), Some((d2, m2, s2))) = (dms_triple(lat_v), dms_triple(lon_v)) {
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

    let has_camera_info = make.is_some()
        || model.is_some()
        || lens.is_some()
        || iso.is_some()
        || focal_mm.is_some()
        || aperture.is_some()
        || shutter_sec.is_some();
    if has_camera_info {
        let mut cam = Map::new();
        if let Some(s) = make {
            cam.insert("make".to_string(), json!(s));
        }
        if let Some(s) = model {
            cam.insert("model".to_string(), json!(s));
        }
        if let Some(s) = lens {
            cam.insert("lens".to_string(), json!(s));
        }
        if let Some(i) = iso {
            cam.insert("iso".to_string(), json!(i));
        }
        if let Some(f) = focal_mm {
            cam.insert("focalLength".to_string(), json!(f));
        }
        if let Some(a) = aperture {
            cam.insert("aperture".to_string(), json!(a));
        }
        if let Some(s) = shutter_sec {
            cam.insert("shutterSpeed".to_string(), json!(s));
        }
        root.insert("cameraInfo".to_string(), Value::Object(cam));
    }
}

/// 读取 EXIF 中 `DateTimeOriginal` / `DateTime`，解析为本地时区时刻（与 preload `checkExifDate` 一致）
fn read_exif_capture_local(path: &Path) -> Option<DateTime<Local>> {
    let buf = read_file_bytes(path)?;
    let mut cursor = Cursor::new(buf);
    let exif = Reader::new().read_from_container(&mut cursor).ok()?;
    let mut datetime_raw: Option<String> = None;
    for f in exif.fields() {
        match f.tag.number() {
            etn::DATE_TIME_ORIGINAL | etn::DATE_TIME_DIGITIZED | etn::DATE_TIME => {
                if datetime_raw.is_none() {
                    datetime_raw = ascii_first(&f.value);
                }
            }
            _ => {}
        }
    }
    let asc = datetime_raw?;
    let naive = NaiveDateTime::parse_from_str(asc.trim(), "%Y:%m:%d %H:%M:%S").ok()?;
    naive.and_local_timezone(Local).single()
}

/// RFC 0093：与 Electron `preload/exif-helper.resolveExifDate` + `moment(..., "YYYY/YYYYMMDD")` 一致。
/// 仅**图片**写入 `年/年日月日` 子目录（`apps/desktop/src/preload/__tests__/exif-helper.spec.ts` 的 `^\d{4}/\d{8}$`）；**视频**返回 `None`，文件落在目标根目录（与 preload 中 `checkExifDate` 拒识视频后 `targetName` 为空一致）。
pub(crate) fn legacy_import_target_name(
    path: &Path,
    is_image: bool,
    meta: &std::fs::Metadata,
) -> Option<String> {
    if !is_image {
        return None;
    }
    let local_dt: DateTime<Local> = if let Some(dt) = read_exif_capture_local(path) {
        dt
    } else {
        let st: SystemTime = meta.created().ok().or_else(|| meta.modified().ok())?;
        let utc: DateTime<Utc> = st.into();
        utc.with_timezone(&Local)
    };
    Some(format!("{}/{}", local_dt.year(), local_dt.format("%Y%m%d")))
}

/// 若文件含可读 EXIF，向 `out` 写入 `dateTime`（RFC3339）、`dateSource: exif`、`gpsInfo`、`cameraInfo`（含 lens / iso / focalLength / aperture / shutterSpeed 等，对齐 `@photasa/common` 的 `CameraInfo`）
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

#[cfg(test)]
mod tests {
    use super::*;
    use exif::Rational;
    use regex::Regex;
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    #[test]
    fn legacy_import_target_name_video_returns_none() {
        let dir = std::env::temp_dir().join(format!("photasa-legacy-vid-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("mkdir");
        let p = dir.join("clip.mp4");
        fs::write(&p, []).expect("write");
        let meta = fs::metadata(&p).expect("meta");
        assert!(legacy_import_target_name(&p, false, &meta).is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn legacy_import_target_name_image_matches_yyyy_slash_yyyymmdd() {
        let dir = std::env::temp_dir().join(format!("photasa-legacy-img-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).expect("mkdir");
        let p = dir.join("n.jpg");
        // 最小 JPEG SOI/EOI，无 EXIF，应回退到文件元数据时间
        fs::write(&p, [0xff, 0xd8, 0xff, 0xd9]).expect("write");
        let meta = fs::metadata(&p).expect("meta");
        let name = legacy_import_target_name(&p, true, &meta).expect("target name");
        assert!(
            Regex::new(r"^\d{4}/\d{8}$").unwrap().is_match(&name),
            "unexpected {name}"
        );
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn first_rational_as_f64_exposure_one_two_fiftieth() {
        let v = ExifValue::Rational(vec![Rational { num: 1, denom: 250 }]);
        let sec = first_rational_as_f64(&v).expect("rational");
        assert!((sec - (1.0 / 250.0)).abs() < 1e-9);
    }

    #[test]
    fn first_numeric_as_f64_reads_double_exposure() {
        let v = ExifValue::Double(vec![0.004]);
        assert!((first_numeric_as_f64(&v).unwrap() - 0.004).abs() < 1e-9);
    }

    #[test]
    fn nikon_fixture_photographic_sensitivity_tag_matches() {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/metadata/nikon-exif-sample.jpg");
        let mut f = File::open(&path).expect("open");
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).expect("read");
        let mut cursor = Cursor::new(buf);
        let exif = Reader::new()
            .read_from_container(&mut cursor)
            .expect("exif");
        let mut found = false;
        for field in exif.fields() {
            if field.tag.number() == etn::PHOTOGRAPHIC_SENSITIVITY {
                found = true;
                assert_eq!(iso_from_exif_value(&field.value), Some(400));
            }
        }
        assert!(found, "PhotographicSensitivity tag missing");
    }

    #[test]
    fn enrich_fixture_jpegs_match_golden_camera_fields() {
        let cases: &[(&str, &str, u32, f64, f64, f64)] = &[
            (
                "nikon-exif-sample.jpg",
                "NIKON CORPORATION",
                400,
                70.0,
                2.8,
                0.004,
            ),
            ("canon-exif-sample.jpg", "Canon", 800, 50.0, 5.6, 0.00625),
            ("sony-exif-sample.jpg", "SONY", 200, 35.0, 4.0, 0.002),
        ];
        for (file, make, iso, focal, aperture, shutter) in cases {
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("tests/fixtures/metadata")
                .join(file);
            let mut out = json!({ "dateSource": "file_modified" });
            enrich_from_exif(&path, &mut out);
            assert_eq!(
                out.get("dateSource").and_then(|v| v.as_str()),
                Some("exif"),
                "{file} dateSource"
            );
            let cam = out.get("cameraInfo").expect("{file} cameraInfo");
            assert_eq!(cam.get("make").and_then(|v| v.as_str()), Some(*make));
            assert_eq!(
                cam.get("iso").and_then(|v| v.as_u64()),
                Some(u64::from(*iso)),
                "{file} iso"
            );
            assert!(
                (cam.get("focalLength").and_then(|v| v.as_f64()).unwrap() - focal).abs() < 1e-3,
                "{file} focalLength"
            );
            assert!(
                (cam.get("aperture").and_then(|v| v.as_f64()).unwrap() - aperture).abs() < 1e-3,
                "{file} aperture"
            );
            assert!(
                (cam.get("shutterSpeed").and_then(|v| v.as_f64()).unwrap() - shutter).abs() < 1e-6,
                "{file} shutterSpeed"
            );
        }
    }

    #[test]
    fn iso_from_short() {
        let v = ExifValue::Short(vec![400]);
        assert_eq!(iso_from_exif_value(&v), Some(400));
    }

    /// 开发：打印 fixture 内 kamadak 可见标签
    #[test]
    #[ignore]
    fn dump_nikon_fixture_exif_tags() {
        dump_fixture_exif_tags("nikon-exif-sample.jpg");
    }

    #[test]
    #[ignore]
    fn dump_canon_fixture_exif_tags() {
        dump_fixture_exif_tags("canon-exif-sample.jpg");
    }

    fn dump_fixture_exif_tags(name: &str) {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/metadata")
            .join(name);
        let mut f = File::open(&path).expect("open");
        let mut buf = Vec::new();
        f.read_to_end(&mut buf).expect("read");
        let mut cursor = Cursor::new(buf);
        let exif = Reader::new()
            .read_from_container(&mut cursor)
            .expect("exif");
        eprintln!("=== {name} ===");
        for field in exif.fields() {
            eprintln!("{:?} = {:?}", field.tag, field.value);
        }
    }
}
