#!/usr/bin/env node
import { Command } from "commander";
import { setupFfmpeg } from "./commands/setup";
import { validateFfmpeg } from "./commands/validate";

const program = new Command();

program
    .name("photasa-cli")
    .description("CLI tools for Photasa setup and maintenance")
    .version("0.0.1");

program
    .command("setup-ffmpeg")
    .description("Download and install FFmpeg binaries")
    .action(async () => {
        await setupFfmpeg();
    });

program
    .command("validate-ffmpeg")
    .description("Validate FFmpeg installation")
    .option("--dist <path>", "Path to distribution folder for production check")
    .option("-v, --verbose", "Enable verbose logging")
    .action(async (options) => {
        await validateFfmpeg(options);
    });

program
    .command("validate-heif")
    .description("Validate HEIF WASM module integration")
    .option("-v, --verbose", "Enable verbose logging")
    .action(async (options) => {
        const { validateHeif } = await import("./commands/validate");
        await validateHeif(options);
    });

program
    .command("validate")
    .description("Validate all integrations (FFmpeg, HEIF)")
    .option("-v, --verbose", "Enable verbose logging")
    .action(async (options) => {
        const { validateFfmpeg, validateHeif } = await import("./commands/validate");
        console.log("Validating all components...\n");
        await validateFfmpeg(options);
        console.log("");
        await validateHeif(options);
    });

program.parse();
