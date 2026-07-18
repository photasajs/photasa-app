import ora from "ora";
import chalk from "chalk";
import {
    isFFmpegAvailable,
    getFFmpegVersion,
    getFFprobeVersion,
    configureFFmpeg,
    initializeHeifModule,
} from "@photasa/maliang-bundle";

export async function validateFfmpeg(options: { dist?: string; verbose?: boolean }) {
    const spinner = ora("Checking FFmpeg availability...").start();

    try {
        const isAvailable = isFFmpegAvailable();

        if (isAvailable) {
            // Silence logs unless verbose is true
            const silent = !options.verbose;
            const config = configureFFmpeg(silent);
            spinner.succeed("FFmpeg binaries found");

            if (options.verbose) {
                console.log(chalk.gray(`  FFmpeg: ${config.ffmpegPath}`));
                console.log(chalk.gray(`  FFprobe: ${config.ffprobePath}`));
            }

            const versionSpinner = ora("Checking versions...").start();

            // We can also assume ffprobe version matches or check it similarly if we export a checker.
            // For now, let's just accept ffmpeg version as indicative.
            let version = await getFFmpegVersion();

            if (version && version !== "unknown") {
                versionSpinner.succeed(`FFmpeg Version: ${chalk.green(version)}`);
            } else {
                versionSpinner.warn(
                    `FFmpeg Version: ${chalk.yellow("Unknown (binary works but version string parsing failed)")}`,
                );
            }

            // We can also assume ffprobe version matches or check it similarly if we export a checker.
            // For now, let's just accept ffmpeg version as indicative.
            version = await getFFprobeVersion();

            if (version && version !== "unknown") {
                versionSpinner.succeed(`FFprobe Version: ${chalk.green(version)}`);
            } else {
                versionSpinner.warn(
                    `FFprobe Version: ${chalk.yellow("Unknown (binary works but version string parsing failed)")}`,
                );
            }
        } else {
            spinner.fail("FFmpeg binaries validation failed");
            process.exit(1);
        }

        if (options.dist) {
            const distSpinner = ora(`Checking distribution at ${options.dist}...`).start();
            // Add distribution check logic here if needed, similar to verify-ffmpeg.js
            // For now, basic runtime check is sufficient for core validation.
            distSpinner.info("Distribution check not yet fully implemented in CLI");
        }
    } catch (error: any) {
        spinner.fail("An error occurred during validation");
        console.error(chalk.red(error.message));
        process.exit(1);
    }
}

export async function validateHeif(options: { verbose?: boolean } = {}) {
    const spinner = ora("Initializing HEIF WASM module...").start();
    try {
        // Silence logs unless verbose is true
        const quiet = !options.verbose;
        const module = await initializeHeifModule(quiet);
        if (module && typeof module.decode === "function") {
            spinner.succeed("HEIF WASM module initialized successfully");
            if (options.verbose) {
                console.log(chalk.gray("  Module loaded and decoder is available"));
            }
        } else {
            throw new Error("Module initialized but seems invalid (missing decode function)");
        }
    } catch (error: any) {
        spinner.fail("HEIF WASM validation failed");
        console.error(chalk.red("\nError details:"));
        console.error(chalk.red(error.message));
        if (error.cause) {
            console.error(chalk.gray(error.cause));
        }
        process.exit(1);
    }
}
