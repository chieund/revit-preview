// Worker thread: converts .rvt → IFC4 with rvt-wasm. Runs off the main thread
// so the extension host stays responsive during parsing (can take 20-60 s).
import { parentPort, workerData } from "worker_threads";
// externalized in esbuild — resolved at runtime from dist/rvtwasm/
import * as rvt from "./rvtwasm/rvt.js";

interface WorkerData {
  bytes: Uint8Array;
  mode: "scaffold" | "typed-no-geometry" | "geometry" | "strict";
  largeModel: boolean;
}

const data = workerData as WorkerData;

function report(msg: unknown): void {
  parentPort!.postMessage(msg);
}

try {
  // check the Revit version first: metadata only, very fast
  const meta = rvt.fileMetadata(data.bytes);
  const version = Number(meta.revit_version) || 0;

  if (data.mode === "geometry" && version < 2023) {
    report({
      type: "error",
      message:
        `This file was saved by Revit ${version}. Direct 3D decoding currently ` +
        `supports Revit 2023–2025 projects (2026/2027 experimental). ` +
        `For older files, use Revit's File → Export → IFC and open the .ifc.`,
    });
    process.exit(0);
  }

  const { model, diagnostics } = rvt.openRvtBytesWithDiagnosticsModeAndOpenLimits(
    data.bytes,
    data.mode,
    { largeModel: data.largeModel },
    (stage: string, done: number, total: number | null) =>
      report({ type: "progress", stage, done, total })
  );

  report({ type: "progress", stage: "write-ifc", done: 0, total: null });
  const step = rvt.modelToIfcStep(model);
  report({ type: "done", step, diagnostics });
} catch (e: unknown) {
  report({ type: "error", message: e instanceof Error ? e.message : String(e) });
}
