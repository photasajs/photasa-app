// Global type declarations for Vite ?nodeWorker query parameter in Jest tests
// This allows TypeScript to recognize imports with ?nodeWorker suffix
declare module "*?nodeWorker" {
    import type { Worker } from "worker_threads";
    const createWorker: (options?: { workerData?: unknown }) => Worker;
    export default createWorker;
}

