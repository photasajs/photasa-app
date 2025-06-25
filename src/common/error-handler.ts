import { Logger } from "log4js";

// Custom error classes
export class PhotasaError extends Error {
    constructor(
        message: string,
        public code: string,
        public details?: unknown,
    ) {
        super(message);
        this.name = "PhotasaError";
    }
}

export class FileSystemError extends PhotasaError {
    constructor(message: string, details?: unknown) {
        super(message, "FILE_SYSTEM_ERROR", details);
        this.name = "FileSystemError";
    }
}

export class ConfigError extends PhotasaError {
    constructor(message: string, details?: unknown) {
        super(message, "CONFIG_ERROR", details);
        this.name = "ConfigError";
    }
}

export class WorkerError extends PhotasaError {
    constructor(message: string, details?: unknown) {
        super(message, "WORKER_ERROR", details);
        this.name = "WorkerError";
    }
}

export class ValidationError extends PhotasaError {
    constructor(message: string, details?: unknown) {
        super(message, "VALIDATION_ERROR", details);
        this.name = "ValidationError";
    }
}

// Error handling utilities
export function handleError(error: unknown, logger: Logger, context?: string): PhotasaError {
    if (error instanceof PhotasaError) {
        logger.error(`${context ? `[${context}] ` : ""}${error.message}`, {
            code: error.code,
            details: error.details,
        });
        return error;
    }

    if (error instanceof Error) {
        const photasaError = new PhotasaError(error.message, "UNKNOWN_ERROR", {
            originalError: error,
        });
        logger.error(`${context ? `[${context}] ` : ""}${error.message}`, {
            code: photasaError.code,
            details: photasaError.details,
        });
        return photasaError;
    }

    const photasaError = new PhotasaError("An unknown error occurred", "UNKNOWN_ERROR", {
        originalError: error,
    });
    logger.error(`${context ? `[${context}] ` : ""}An unknown error occurred`, {
        code: photasaError.code,
        details: photasaError.details,
    });
    return photasaError;
}

// Error recovery utilities
export async function retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delay = 1000,
    logger: Logger,
    context?: string,
): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            logger.warn(
                `${context ? `[${context}] ` : ""}Operation failed (attempt ${attempt}/${maxRetries})`,
                { error: lastError },
            );

            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, delay * attempt));
            }
        }
    }

    throw lastError;
}

// Error reporting utilities
export function formatErrorForUI(error: PhotasaError): { message: string; code: string } {
    return {
        message: error.message,
        code: error.code,
    };
}

// Error validation utilities
export function isValidError(error: unknown): error is PhotasaError {
    return (
        error instanceof Error &&
        "code" in error &&
        typeof (error as PhotasaError).code === "string"
    );
}

// Error mapping utilities
export function mapToPhotasaError(error: unknown): PhotasaError {
    if (error instanceof PhotasaError) {
        return error;
    }

    if (error instanceof Error) {
        // Map common error types to specific PhotasaError classes
        if (error.name === "ENOENT" || error.name === "EACCES") {
            return new FileSystemError(error.message, { originalError: error });
        }

        return new PhotasaError(error.message, "UNKNOWN_ERROR", { originalError: error });
    }

    return new PhotasaError("An unknown error occurred", "UNKNOWN_ERROR", { originalError: error });
}
