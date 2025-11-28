// Global type declarations for Jest tests
// This file provides type declarations for Vite-specific imports

declare module "*?nodeWorker" {
    import type { Worker } from "worker_threads";
    const createWorker: (options?: { workerData?: unknown }) => Worker;
    export default createWorker;
}

