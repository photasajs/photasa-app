use std::io;
use std::path::{Path, PathBuf};

fn main() {
    if std::env::var("DOCS_RS").is_ok() {
        // Don't link with libheif in case of building documentation for docs.rs.
        return;
    }

    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=wrapper.h");

    // Photasa policy (RFC 0103): embedded-libheif on all platforms — no vcpkg in CI.
    #[cfg(all(
        target_os = "windows",
        target_env = "msvc",
        feature = "embedded-libheif"
    ))]
    {
        let include_paths = find_libheif();
        #[cfg(feature = "use-bindgen")]
        run_bindgen(&include_paths);
        #[cfg(not(feature = "use-bindgen"))]
        let _ = include_paths;
        return;
    }

    #[cfg(all(
        target_os = "windows",
        target_env = "msvc",
        not(feature = "embedded-libheif")
    ))]
    {
        let include_paths: Vec<String> = Vec::new();
        install_libheif_by_vcpkg();
        #[cfg(feature = "use-bindgen")]
        run_bindgen(&include_paths);
        return;
    }

    #[cfg(not(all(target_os = "windows", target_env = "msvc")))]
    {
        let include_paths = find_libheif();
        #[cfg(feature = "use-bindgen")]
        run_bindgen(&include_paths);
        #[cfg(not(feature = "use-bindgen"))]
        let _ = include_paths;
    }
}

const LIBDE265_FIND_ANCHOR: &str = "if (WITH_LIBDE265)\n    find_package(LIBDE265)\nendif()";

/// Windows checkout 可能是 CRLF；补丁按 LF 锚点匹配，需先归一化。
fn normalize_cmake_text(raw: &str) -> String {
    raw.replace("\r\n", "\n").replace('\r', "\n")
}

/// CMake 双引号字符串里反斜杠是转义符（`D:\a\...` 会坏），统一用正斜杠。
fn cmake_quoted_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn patch_libde265_minimum_cmake(cmake_lists: &Path) {
    let mut contents = normalize_cmake_text(
        &std::fs::read_to_string(cmake_lists)
            .unwrap_or_else(|err| panic!("failed to read {}: {err}", cmake_lists.display())),
    );
    contents = contents.replace(
        "cmake_minimum_required (VERSION 3.3.2)",
        "cmake_minimum_required (VERSION 3.5)",
    );
    std::fs::write(cmake_lists, contents)
        .unwrap_or_else(|err| panic!("failed to write {}: {err}", cmake_lists.display()));
}

fn apply_libde265_embed_patch(contents: &mut String, libde265_source_dir: &str) {
    if contents.contains("add_subdirectory(\"${LIBDE265_SOURCE_DIR}\"") {
        return;
    }

    if !contents.contains(LIBDE265_FIND_ANCHOR) {
        panic!(
            "failed to patch libheif for embedded libde265: anchor not found \
             (check vendor/CMakeLists.txt or line endings)"
        );
    }

    let new_find = format!(
        "if (WITH_LIBDE265)\n    \
         set(BUILD_SHARED_LIBS OFF CACHE BOOL \"\" FORCE)\n    \
         set(ENABLE_SDL OFF CACHE BOOL \"\" FORCE)\n    \
         set(ENABLE_DECODER OFF CACHE BOOL \"\" FORCE)\n    \
         set(ENABLE_ENCODER OFF CACHE BOOL \"\" FORCE)\n    \
         set(LIBDE265_SOURCE_DIR \"{libde265_source_dir}\")\n    \
         set(LIBDE265_BINARY_DIR \"${{CMAKE_CURRENT_BINARY_DIR}}/libde265_build\")\n    \
         add_subdirectory(\"${{LIBDE265_SOURCE_DIR}}\" \"${{LIBDE265_BINARY_DIR}}\" EXCLUDE_FROM_ALL)\n    \
         set(LIBDE265_FOUND TRUE)\n    \
         set(LIBDE265_INCLUDE_DIR \"${{LIBDE265_SOURCE_DIR}}\")\n    \
         set(LIBDE265_INCLUDE_DIRS \"${{LIBDE265_SOURCE_DIR}}\" \"${{LIBDE265_BINARY_DIR}}\")\n    \
         set(LIBDE265_LIBRARY de265)\n    \
         set(LIBDE265_LIBRARIES de265)\n    \
         set(HAVE_LIBDE265 TRUE)\n\
         endif()"
    );
    *contents = contents.replace(LIBDE265_FIND_ANCHOR, &new_find);
}

#[allow(dead_code)]
fn prepare_libheif_src() -> PathBuf {
    let out_path = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let crate_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let libheif_dir = crate_dir.join("vendor/libheif");
    let dst_dir = out_path.join("libheif");
    copy_dir_all(libheif_dir, &dst_dir).unwrap();

    // 复制 vendored libde265 源码到 OUT_DIR，供 add_subdirectory 使用
    let libde265_src = crate_dir.join("vendor/libde265");
    let libde265_dst = out_path.join("libde265");
    if !libde265_src.exists() {
        panic!(
            "embedded libde265 vendor sources missing at {}",
            libde265_src.display()
        );
    }
    copy_dir_all(libde265_src, &libde265_dst).unwrap();
    patch_libde265_minimum_cmake(&libde265_dst.join("CMakeLists.txt"));

    // Patch CMakeLists.txt:
    // 1. 禁用 heifio（示例程序）
    // 2. 将 find_package(LIBDE265) 替换为 add_subdirectory，零系统依赖
    let cmake_lists_path = dst_dir.join("CMakeLists.txt");
    let mut contents = normalize_cmake_text(
        &std::fs::read_to_string(&cmake_lists_path)
            .expect("failed to read libheif/CMakeLists.txt"),
    );
    contents = contents.replace("add_subdirectory(heifio)", "");

    let libde265_dst_str = cmake_quoted_path(&libde265_dst);
    apply_libde265_embed_patch(&mut contents, &libde265_dst_str);

    std::fs::write(&cmake_lists_path, contents).expect("failed to write libheif/CMakeLists.txt");
    dst_dir
}

#[cfg(feature = "embedded-libheif")]
fn compile_libheif() -> String {
    use std::path::PathBuf;

    let out_path = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    let libheif_dir = prepare_libheif_src();

    let mut build_config = cmake::Config::new(libheif_dir);
    build_config.out_dir(out_path.join("libheif_build"));
    build_config.define("CMAKE_INSTALL_LIBDIR", "lib");

    // MSVC 多配置生成器在 Cargo Debug 下用 --config Debug 时，内嵌 libde265 的
    // 静态库常落在 build 树而非 install 前缀；Release 产物与 Rust debug 链接兼容。
    #[cfg(all(target_os = "windows", target_env = "msvc"))]
    build_config.profile("Release");

    // Disable some options
    for key in [
        "BUILD_SHARED_LIBS",
        "BUILD_TESTING",
        "WITH_GDK_PIXBUF",
        "WITH_EXAMPLES",
        "WITH_EXAMPLE_HEIF_THUMB",
        "WITH_EXAMPLE_HEIF_VIEW",
        "ENABLE_EXPERIMENTAL_FEATURES",
        "ENABLE_PLUGIN_LOADING",
        "BUILD_DOCUMENTATION",
        // 零系统依赖：禁用 libsharpyuv，避免 libheif.pc 的 Requires.private 依赖系统 pkg-config
        "WITH_LIBSHARPYUV",
    ] {
        build_config.define(key, "OFF");
    }

    // Enable some options
    build_config.define("WITH_REDUCED_VISIBILITY", "ON");

    // List of encoders and decoders that have corresponding plugins
    let encoders_decoders = [
        "AOM_DECODER",
        "AOM_ENCODER",
        "DAV1D",
        "LIBDE265",
        "RAV1E",
        "SvtEnc",
        "X264",
        "X265",
        "JPEG_DECODER",
        "JPEG_ENCODER",
        "KVAZAAR",
        "OPENJPH_ENCODER",
        "OpenJPEG_DECODER",
        "OpenJPEG_ENCODER",
        "OPEN_JPH_ENCODER",
        "FFMPEG_DECODER",
        "OpenH264_DECODER",
        "UVG266",
        "VVDEC",
        "VVENC",
    ];

    let disabled_enc_dec = [
        // LIBDE265 通过 vendored 源码内嵌构建，此处保持启用
        // 其余全部关闭，零系统依赖
        "AOM_DECODER",
        "AOM_ENCODER",
        "DAV1D",
        "RAV1E",
        "SvtEnc",
        "X264",
        "X265",
        "JPEG_DECODER",
        "JPEG_ENCODER",
        "KVAZAAR",
        "OPENJPH_ENCODER",
        "OpenJPEG_DECODER",
        "OpenJPEG_ENCODER",
        "OPEN_JPH_ENCODER",
        "FFMPEG_DECODER",
        "OpenH264_DECODER",
        "UVG266",
        "VVDEC",
        "VVENC",
    ];

    // Enable or disable encoders and decoders
    for key in encoders_decoders {
        let v = if disabled_enc_dec.contains(&key) {
            "OFF"
        } else {
            "ON"
        };
        build_config.define(format!("WITH_{}", key), v);

        // Disable external plugin
        build_config.define(format!("WITH_{}_PLUGIN", key), "OFF");
    }

    let libheif_build = build_config.build();
    install_embedded_libde265_pkg_config(&libheif_build, &out_path);

    libheif_build
        .join("lib/pkgconfig")
        .to_string_lossy()
        .to_string()
}

/// 内嵌 libde265 不会随 cmake install 落到 lib/ 与 pkgconfig/，但 libheif.pc 的
/// Requires.private 仍引用 libde265；CI 无系统 libde265-dev 时 pkg-config --static 会失败。
fn install_embedded_libde265_pkg_config(libheif_build: &Path, out_path: &Path) {
    let search_roots = [libheif_build, out_path];
    let Some(de265_archive) = find_libde265_static_library(&search_roots) else {
        panic!(
            "embedded libde265 static library not found under {} or {} ({})",
            libheif_build.display(),
            out_path.display(),
            diagnose_missing_de265_archive(&search_roots)
        );
    };

    let lib_dir = libheif_build.join("lib");
    let pkg_dir = lib_dir.join("pkgconfig");
    std::fs::create_dir_all(&pkg_dir).expect("failed to create pkgconfig directory");

    let installed_de265 = lib_dir.join(static_library_filename("de265"));
    if de265_archive != installed_de265 {
        std::fs::copy(&de265_archive, &installed_de265)
            .unwrap_or_else(|err| panic!("failed to copy {}: {err}", de265_archive.display()));
    }

    // vendored 头文件在 OUT_DIR/libde265（见 prepare_libheif_src）
    let de265_include_dir = out_path.join("libde265");
    let prefix = libheif_build.to_string_lossy();
    let include_dir = de265_include_dir.to_string_lossy();
    let libde265_pc = format!(
        "prefix={prefix}\n\
         exec_prefix=${{prefix}}\n\
         libdir=${{prefix}}/lib\n\
         includedir={include_dir}\n\
         \n\
         Name: libde265\n\
         Description: H.265/HEVC video decoder (embedded).\n\
         URL: https://github.com/strukturag/libde265\n\
         Version: 1.0.15\n\
         Requires:\n\
         Libs: -L${{libdir}} -lde265\n\
         Libs.private:\n\
         Cflags: -I${{includedir}}\n"
    );
    std::fs::write(pkg_dir.join("libde265.pc"), libde265_pc).expect("failed to write libde265.pc");
}

fn static_library_filename(stem: &str) -> String {
    if cfg!(all(target_os = "windows", target_env = "msvc")) {
        format!("{stem}.lib")
    } else {
        format!("lib{stem}.a")
    }
}

fn find_libde265_static_library(search_roots: &[&Path]) -> Option<PathBuf> {
    for root in search_roots {
        if let Some(path) = find_de265_archive_under(root) {
            return Some(path);
        }
    }
    None
}

/// 在 MSVC 上可能是 `libde265.lib`、`de265.lib`（import lib）或 Debug 后缀变体。
fn find_de265_archive_under(root: &Path) -> Option<PathBuf> {
    for name in static_library_candidates("de265") {
        if let Some(path) = find_file_named(root, &name) {
            return Some(path);
        }
    }

    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = std::fs::read_dir(&dir).ok()?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if is_de265_static_library_file_name(&path) {
                return Some(path);
            }
        }
    }
    None
}

fn is_de265_static_library_file_name(path: &Path) -> bool {
    let Some(name) = path.file_name() else {
        return false;
    };
    let lower = name.to_string_lossy().to_ascii_lowercase();
    if !(lower.ends_with(".lib") || lower.ends_with(".a")) {
        return false;
    }
    if lower.contains("heif") && !lower.contains("de265") {
        return false;
    }
    lower.contains("de265")
}

fn static_library_candidates(stem: &str) -> Vec<String> {
    if cfg!(all(target_os = "windows", target_env = "msvc")) {
        vec![
            format!("lib{stem}.lib"),
            format!("{stem}.lib"),
            format!("lib{stem}d.lib"),
            format!("{stem}d.lib"),
            format!("lib{stem}.a"),
        ]
    } else {
        vec![format!("lib{stem}.a"), format!("{stem}.a")]
    }
}

fn find_file_named(root: &Path, file_name: &str) -> Option<PathBuf> {
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let entries = std::fs::read_dir(&dir).ok()?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else if path.file_name().is_some_and(|name| name == file_name) {
                return Some(path);
            }
        }
    }
    None
}

fn diagnose_missing_de265_archive(search_roots: &[&Path]) -> String {
    let mut archives = Vec::new();
    for root in search_roots {
        collect_static_library_paths(root, &mut archives, 32);
    }
    if archives.is_empty() {
        return "no .lib/.a archives under search roots".to_string();
    }
    archives.sort();
    archives.dedup();
    format!(
        "sample archives: {}",
        archives
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    )
}

fn collect_static_library_paths(root: &Path, out: &mut Vec<PathBuf>, limit: usize) {
    if out.len() >= limit {
        return;
    }
    let entries = match std::fs::read_dir(root) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if out.len() >= limit {
            return;
        }
        let path = entry.path();
        if path.is_dir() {
            collect_static_library_paths(&path, out, limit);
        } else if is_static_archive_file_name(&path) {
            out.push(path);
        }
    }
}

fn is_static_archive_file_name(path: &Path) -> bool {
    let Some(name) = path.file_name() else {
        return false;
    };
    let lower = name.to_string_lossy().to_ascii_lowercase();
    lower.ends_with(".lib") || lower.ends_with(".a")
}

fn find_libheif() -> Vec<String> {
    #[allow(unused_mut)]
    let mut config = system_deps::Config::new();

    #[cfg(feature = "embedded-libheif")]
    {
        std::env::set_var("SYSTEM_DEPS_LIBHEIF_BUILD_INTERNAL", "always");
        config = config.add_build_internal("libheif", |lib, version| {
            let pc_file_path = compile_libheif();
            system_deps::Library::from_internal_pkg_config(pc_file_path, lib, version)
        });
    }

    use system_deps::Error;

    match config.probe() {
        Ok(deps) => deps
            .all_include_paths()
            .iter()
            .filter_map(|p| p.to_str())
            .map(|p| p.to_string())
            .collect(),
        Err(err) => {
            let err_msg = match &err {
                Error::InvalidMetadata(msg) => {
                    if msg.contains("No version") && msg.contains("libheif") {
                        "You MUST enable one of the crate features to specify \
                    minimal supported version of 'libheif' API (e.g. v1_17)."
                            .to_string()
                    } else {
                        err.to_string()
                    }
                }
                _ => err.to_string(),
            };
            println!("cargo:error={err_msg}");
            std::process::exit(1);
        }
    }
}

#[cfg(all(target_os = "windows", target_env = "msvc"))]
fn install_libheif_by_vcpkg() {
    let vcpkg_lib = vcpkg::Config::new()
        .emit_includes(true)
        .find_package("libheif");
    if let Err(err) = vcpkg_lib {
        println!("cargo:warning={}", err);
        std::process::exit(1);
    }
}

#[cfg(feature = "use-bindgen")]
fn run_bindgen(include_paths: &[String]) {
    let mut base_builder = bindgen::Builder::default()
        .header("wrapper.h")
        .generate_comments(true)
        .formatter(bindgen::Formatter::Rustfmt)
        .generate_cstr(true)
        .disable_name_namespacing()
        .array_pointers_in_arguments(true)
        .ctypes_prefix("libc")
        .allowlist_function("heif_.*")
        .allowlist_type("heif_.*")
        .size_t_is_usize(true)
        .clang_args([
            "-fparse-all-comments",
            "-fretain-comments-from-system-headers",
        ]);

    for path in include_paths {
        base_builder = base_builder.clang_arg(format!("-I{path}"));
    }

    // Don't derive Copy and Clone for structures with pointers
    // and which represents shared_ptr from C++.
    for struct_name in [
        "heif_plugin_info",
        "heif_decoding_options",
        "heif_encoding_options",
        "heif_property_user_description",
        "heif_reader_range_request_result",
        "heif_entity_group",
        "heif_depth_representation_info",
        "heif_camera_extrinsic_matrix",
        "heif_track",
        "heif_raw_sequence_sample",
        "heif_track_options",
        "heif_sequence_encoding_options",
        "heif_context",
        "heif_image_handle",
        "heif_decoder_plugin",
        "heif_encoder_plugin",
        "heif_image",
        "heif_scaling_options",
        "heif_encoder",
        "heif_reading_options",
        "heif_encoder_descriptor",
        "heif_encoder_parameter",
        "heif_decoder_descriptor",
        "heif_region_item",
        "heif_region",
    ] {
        base_builder = base_builder.no_copy(struct_name);
    }

    // The main module
    // Finish the builder and generate the bindings.
    let bindings = base_builder
        .clone()
        .generate()
        .expect("Unable to generate bindings");

    // Write the bindings to the $OUT_DIR/bindings.rs file.
    let out_path = PathBuf::from(std::env::var("OUT_DIR").unwrap());
    bindings
        .write_to_file(out_path.join("bindings.rs"))
        .expect("Couldn't write bindings.rs!");

    // Create linker_test.rs module for testing cases when not all
    // functions from *.h files are really available in libheif.
    let code = bindings.to_string();
    let mut func_names = Vec::new();
    for line in code.lines() {
        if !line.contains("pub fn ") {
            continue;
        }
        let line = line.trim();
        let res: Vec<&str> = line.split(&[' ', '(']).collect();
        if res.len() > 3 {
            if let &["pub", "fn", name] = &res[..3] {
                func_names.push(name)
            }
        }
    }

    let mut result = vec![
        "use super::*;\n\n",
        "#[test]\n",
        "fn is_all_functions_exists_in_libheif() {\n",
        "    let fn_pointers = [\n",
    ];
    for name in func_names {
        result.push("        ");
        result.push(name);
        result.push(" as *const fn(),\n")
    }
    result.extend(vec![
        "    ];\n",
        "    for pointer in fn_pointers.iter() {\n",
        "        assert!(!pointer.is_null());\n",
        "    }\n",
        "}\n",
    ]);
    let test_module = result.join("");
    let test_path = out_path.join("linker_test.rs");
    std::fs::write(&test_path, test_module).expect("Couldn't write test module!");

    let bindings = base_builder
        .layout_tests(false)
        .generate()
        .expect("Unable to generate bindings without tests");
    bindings
        .write_to_file(out_path.join("bindings_wo_tests.rs"))
        .expect("Couldn't write bindings_wo_tests.rs!");
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> io::Result<()> {
    std::fs::create_dir_all(&dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_cmake_text_strips_crlf() {
        assert_eq!(normalize_cmake_text("a\r\nb\rc"), "a\nb\nc");
    }

    #[test]
    fn cmake_quoted_path_uses_forward_slashes_on_windows_paths() {
        let path = Path::new(r"D:\a\photasa-app\out\libde265");
        assert_eq!(cmake_quoted_path(path), "D:/a/photasa-app/out/libde265");
    }

    #[test]
    fn apply_libde265_embed_patch_replaces_lf_and_crlf_anchors() {
        let body = format!("prefix\n{LIBDE265_FIND_ANCHOR}\nsuffix");
        for input in [body.clone(), body.replace('\n', "\r\n")] {
            let mut contents = normalize_cmake_text(&input);
            apply_libde265_embed_patch(&mut contents, "D:/out/libde265");
            assert!(contents.contains("add_subdirectory(\"${LIBDE265_SOURCE_DIR}\""));
            assert!(!contents.contains("find_package(LIBDE265)"));
        }
    }
}
