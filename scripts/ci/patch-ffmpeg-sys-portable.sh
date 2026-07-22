#!/usr/bin/env bash
# Patch ffmpeg-sys-next host builds for portable Linux CI.
#
# Upstream build.rs passes --extra-cflags=-march=native -mtune=native when
# HOST==TARGET. rust-cache can restore FFmpeg objects built on a newer runner
# CPU; tests then SIGILL on older hosts. See RFC 0103 / photasa-build CI.
set -euo pipefail

if [[ "${RUNNER_OS:-local}" != "Linux" ]]; then
    echo "skip ffmpeg-sys-next portable patch (${RUNNER_OS:-local})"
    exit 0
fi

CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"
REGISTRY_SRC="${CARGO_HOME}/registry/src"
MARCH_REPLACEMENT="${FFMPEG_CI_MARCH:-x86-64}"
TUNE_REPLACEMENT="${FFMPEG_CI_MTUNE:-generic}"
MANIFEST="apps/photasa/src-tauri/Cargo.toml"

if [[ -f "${MANIFEST}" ]]; then
    cargo fetch --manifest-path "${MANIFEST}"
else
    echo "manifest missing (${MANIFEST}); skipping cargo fetch"
fi

shopt -s nullglob
patched=0
for build_rs in "${REGISTRY_SRC}"/*/ffmpeg-sys-next-*/build.rs; do
    if grep -q 'march=native' "${build_rs}"; then
        sed -i.bak \
            "s/-march=native -mtune=native/-march=${MARCH_REPLACEMENT} -mtune=${TUNE_REPLACEMENT}/g" \
            "${build_rs}"
        echo "patched ${build_rs}"
        patched=1
    fi
done

if [[ "${patched}" -eq 0 ]]; then
    echo "no ffmpeg-sys-next build.rs found to patch under ${REGISTRY_SRC}"
fi

# Drop cached ffmpeg-sys-next OUT_DIR so the next build uses patched configure flags.
rm -rf target/debug/build/ffmpeg-sys-next-* target/release/build/ffmpeg-sys-next-* \
    2>/dev/null || true
