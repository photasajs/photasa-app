# extract_metadata golden fixtures（RFC 0112）

本目录存放 **可提交** 的小型媒体样本；期望 JSON 在 `golden/*.json`。

## 目录

| 文件                    | 用途                                       |
| ----------------------- | ------------------------------------------ |
| `minimal-no-exif.jpg`   | 无 EXIF，验证 `dateSource: file_modified`  |
| `nikon-exif-sample.jpg` | Nikon 标准 EXIF + lens/ISO/曝光            |
| `canon-exif-sample.jpg` | Canon 标准 EXIF                            |
| `sony-exif-sample.jpg`  | Sony 标准 EXIF                             |
| `sample-video.mp4`      | 短 H.264，验证 codec/duration/resolution   |
| `corrupt-video.mp4`     | 损坏容器，验证 Rust 回退（仅 type/format） |

## 从 Electron 生成 golden（一次性）

1. 将同一 fixture 放入 Electron 可访问路径。
2. 调用 `window.api.extractMetadata({ filePath, fileType })` 或 import worker `extract_metadata`。
3. 去掉 volatile 字段：`path`、`name`、`size`、`modifiedTime`、`createdTime`；`dateTime` 只保留日期前缀写入 `expectDateTimePrefix`。
4. 将子集写入 `golden/<fixture-stem>.json` 的 `expect` 字段。

## 从 Rust 刷新期望（开发）

```bash
cd apps/photasa/src-tauri
cargo test dump_fixture_output_for_golden_authoring -- --ignored --nocapture
```

对照输出更新 `golden/*.json`（勿提交绝对路径）。

## 运行 golden 测试

```bash
cargo test golden_ -- --nocapture
```

## 重新生成 JPEG fixture（Pillow）

```bash
python3 scripts/generate-metadata-fixtures.py   # 见仓库内脚本或 TASK_TRACKING 备注
```

当前 fixture 由 Pillow 生成（2026-06-08），模拟 libjpeg/Pillow 写入 `Context::Tiff` 的 Exif 标签；Rust 按 **tag number** 匹配以对齐 Electron/exifr 行为。
