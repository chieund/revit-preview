// Type declarations for the vendored rvt-rs WASM build (Apache-2.0).
// Runtime files live at dist/rvtwasm/ (copied from vendor/rvt-wasm by esbuild.js);
// this module is marked external to esbuild, so these import specifiers
// resolve at runtime, not at bundle time.
declare module "./rvtwasm/rvt.js" {
  export interface FileMetadata {
    revit_version: number;
    build?: string;
    title?: string;
    last_saved?: string;
    workshared?: boolean;
    [key: string]: unknown;
  }

  export interface Diagnostics {
    schema_version?: string;
    mode?: string;
    warnings?: string[];
    skipped?: unknown;
    unsupported_features?: unknown;
    [key: string]: unknown;
  }

  export function fileMetadata(bytes: Uint8Array): FileMetadata;
  export function openRvtBytesWithDiagnosticsModeAndOpenLimits(
    bytes: Uint8Array,
    mode: "scaffold" | "typed-no-geometry" | "geometry" | "strict",
    limits: { largeModel?: boolean; maxStreamBytes?: number; maxInflateBytes?: number; savedMeshes?: boolean; phase?: string | number } | null,
    progress?: (stage: string, done: number, total: number | null) => void
  ): { model: unknown; diagnostics: Diagnostics };
  export function modelToIfcStep(model: unknown): string;
}
