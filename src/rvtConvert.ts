// Runs rvtWorker in a worker thread and returns the IFC4 STEP text.
import * as path from "path";
import { Worker } from "worker_threads";

export interface RvtConvertProgress {
  stage: string;
  done: number;
  total: number | null;
}

export interface RvtConvertResult {
  step: string;
  diagnostics: unknown;
}

/**
 * Converts .rvt bytes to IFC4 (STEP text) in a worker thread.
 * `mode`: "geometry" (full) or "scaffold" (structure only, fast).
 * `signal`: abort → terminates the worker immediately (e.g. tab closed mid-way).
 */
export function convertRvtToIfc(
  bytes: Uint8Array,
  mode: "scaffold" | "typed-no-geometry" | "geometry" | "strict",
  onProgress: (p: RvtConvertProgress) => void,
  signal?: AbortSignal
): Promise<RvtConvertResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("RVT conversion cancelled"));
      return;
    }
    const workerPath = path.join(__dirname, "worker-rvt.js");
    const worker = new Worker(workerPath, {
      workerData: { bytes: Buffer.from(bytes), mode, largeModel: false },
      resourceLimits: { maxOldGenerationSizeMb: 4096 },
    });

    signal?.addEventListener(
      "abort",
      () => {
        reject(new Error("RVT conversion cancelled"));
        void worker.terminate();
      },
      { once: true }
    );

    worker.on("message", (msg: { type: string } & Record<string, unknown>) => {
      switch (msg.type) {
        case "progress":
          onProgress({
            stage: msg.stage as string,
            done: msg.done as number,
            total: msg.total as number | null,
          });
          break;
        case "done":
          resolve({ step: msg.step as string, diagnostics: msg.diagnostics });
          worker.terminate();
          break;
        case "error":
          reject(new Error(msg.message as string));
          worker.terminate();
          break;
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`rvt conversion worker exited with code ${code}`));
    });
  });
}
