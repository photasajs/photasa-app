import { defineConfig } from "vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        lib: {
            entry: resolve(__dirname, "src/cli/index.tsx"),
            fileName: "cli",
            formats: ["es"],
        },
        rollupOptions: {
            external: [
                "react",
                "ink",
                "commander",
                "chalk",
                "fs",
                "path",
                "js-yaml",
                "@zouwu-wf/workflow",
                "events",
                "process",
                "child_process",
                "util",
                "os",
                "assert",
                "stream",
                "buffer",
                "url",
                "glob",
                "ink-gradient",
                "ink-big-text",
                /^node:.*/,
            ],
            output: {
                banner: "#!/usr/bin/env node",
            },
        },
        target: "node16",
        outDir: "dist",
        emptyOutDir: true,
    },
});
