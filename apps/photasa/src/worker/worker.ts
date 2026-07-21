// @/src/sw/worker.ts
/// <reference lib="webworker" />

// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare const self: DedicatedWorkerGlobalScope;

import { blockingFunc } from "./util";

export const someRPCFunc = (): number => {
    return blockingFunc();
};
