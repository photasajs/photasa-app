// Type declaration for thumbnail-worker?nodeWorker in Jest tests
declare module "../../thumbnail/thumbnail-worker?nodeWorker" {
    import type { Worker } from "worker_threads";
    const createWorker: (options?: { workerData?: unknown }) => Worker;
    export default createWorker;
}

