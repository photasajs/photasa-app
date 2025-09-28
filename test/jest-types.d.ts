/**
 * Type declarations for Jest test environment
 */

declare namespace NodeJS {
    interface Process {
        resourcesPath?: string;
    }
}
