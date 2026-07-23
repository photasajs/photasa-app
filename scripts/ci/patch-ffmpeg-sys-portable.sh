#!/usr/bin/env bash
# Patch ffmpeg-sys-next for Photasa CI (Linux + Windows).
#
# Linux: replace -march=native with portable flags (rust-cache SIGILL across runner CPUs).
# Windows/MSVC: skip -march=native entirely — cl.exe rejects GCC-only flags and configure fails.
# See RFC 0103 / photasa-build CI.
set -euo pipefail

RUNNER_OS="${RUNNER_OS:-local}"

if [[ "${RUNNER_OS}" != "Linux" && "${RUNNER_OS}" != "Windows" ]]; then
    echo "skip ffmpeg-sys-next CI patch (${RUNNER_OS})"
    exit 0
fi

CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
REGISTRY_SRC="${CARGO_HOME}/registry/src"
MARCH_REPLACEMENT="${FFMPEG_CI_MARCH:-x86-64}"
TUNE_REPLACEMENT="${FFMPEG_CI_MTUNE:-generic}"
MARCH_NATIVE_LINE='configure.arg("--extra-cflags=-march=native -mtune=native");'
MSVC_GUARDED_LINE='if !cfg!(target_env = "msvc") { configure.arg("--extra-cflags=-march=native -mtune=native"); }'
MANIFEST="apps/photasa/src-tauri/Cargo.toml"

if [[ -f "${MANIFEST}" ]]; then
    cargo fetch --manifest-path "${MANIFEST}"
else
    echo "manifest missing (${MANIFEST}); skipping cargo fetch"
fi

shopt -s nullglob
patched=0
for build_rs in "${REGISTRY_SRC}"/*/ffmpeg-sys-next-*/build.rs; do
    if [[ "${RUNNER_OS}" == "Linux" ]] && grep -q 'march=native' "${build_rs}"; then
        sed -i.bak \
            "s/-march=native -mtune=native/-march=${MARCH_REPLACEMENT} -mtune=${TUNE_REPLACEMENT}/g" \
            "${build_rs}"
        echo "patched Linux portable flags in ${build_rs}"
        patched=1
    elif [[ "${RUNNER_OS}" == "Windows" ]] && grep -q "${MARCH_NATIVE_LINE}" "${build_rs}"; then
        # MSVC toolchain: -march=native breaks ffmpeg configure on windows-latest.
        sed -i.bak "s|${MARCH_NATIVE_LINE}|${MSVC_GUARDED_LINE}|" "${build_rs}"
        echo "patched MSVC -march=native guard in ${build_rs}"
        patched=1
    fi
done

if [[ "${patched}" -eq 0 ]]; then
    echo "no ffmpeg-sys-next build.rs patch applied under ${REGISTRY_SRC}"
fi

# Drop cached ffmpeg-sys-next OUT_DIR so the next build uses patched configure flags.
rm -rf target/debug/build/ffmpeg-sys-next-* target/release/build/ffmpeg-sys-next-* \
    2>/dev/null || true
