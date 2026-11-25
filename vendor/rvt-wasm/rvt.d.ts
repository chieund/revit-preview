/* tslint:disable */
/* eslint-disable */

/**
 * Build the scene-graph tree for a model.
 */
export function buildSceneGraph(model: any): any;

/**
 * Build a flat schedule table of the BuildingElements the IFC export
 * writes, each on the storey it puts it on.
 */
export function buildSchedule(model: any): any;

/**
 * Distinct IFC types in the scene — source of truth for the
 * layer-toggle UI.
 */
export function distinctIfcTypes(scene: any): any;

/**
 * Populate the element info panel for a click target.
 */
export function elementInfoPanel(model: any, entity_index: number): any;

/**
 * Document identity — release, worksharing, central model, last saved
 * (time and user), document GUID, save counter, and every
 * `BasicFileInfo` `Key: value` line — as a
 * [`rvt::metadata::FileMetadata`] JS object. Reads only the two
 * identity streams straight from `bytes` (no copy of the file), so it
 * returns instantly on any file size. Errors when `bytes` is not a
 * readable Revit file.
 */
export function fileMetadata(bytes: Uint8Array): any;

/**
 * Render `model` as a glTF 2.0 binary. Returns a `Uint8Array`
 * the frontend feeds into Three.js's `GLTFLoader`.
 */
export function modelToGlb(model: any): Uint8Array;

/**
 * Render `model` as an IFC4 STEP document. Returns the ISO-10303-21
 * text; callers wrap it in a Blob for download.
 */
export function modelToIfcStep(model: any): string;

/**
 * Open an RVT / RFA byte slice with an IFC export quality mode and
 * return `{ model, diagnostics }`.
 *
 * `mode` is one of `scaffold`, `typed-no-geometry`, `geometry`, or
 * `strict`. Stronger modes fail closed when the decoded
 * coverage cannot satisfy the requested bar — the viewer uses this to
 * surface honest confidence rather than over-claiming geometry.
 *
 * Doors and windows are drawn from the meshes Revit saved for them, as
 * `rvt-ifc` does by default, on Revit 2023 to 2027 files.
 */
export function openRvtBytesWithDiagnosticsMode(bytes: Uint8Array, mode: string): any;

/**
 * [`open_rvt_bytes_with_diagnostics_mode`] under the resource limits of
 * `limits`, a JS object
 * `{ largeModel?, maxStreamBytes?, maxInflateBytes?, savedMeshes?, phase? }` or
 * `null` for the defaults. A field left out keeps its default; the first
 * three are `rvt-ifc`'s flags of the same names, resolved by
 * [`rvt::cli::open_limits`] (`largeModel` is `--large-model`, and an
 * explicit byte limit wins over it):
 *
 * - `largeModel: true` reads streams up to 2 GiB and lets a stream inflate
 *   up to the 4 GiB a wasm32 address space holds (`rvt-ifc` gives 8 GiB on
 *   a 64-bit host), and lifts the walker's scan cap the same way.
 * - `maxStreamBytes` caps one stream as stored; a larger stream is not read.
 * - `maxInflateBytes` caps one gzip member's inflated size; a stream's
 *   members together may inflate to this or 1 GiB, whichever is larger.
 *   A value past what a 32-bit `usize` holds saturates at 4 GiB minus 1.
 * - `savedMeshes` (default `true`) draws every element of a Revit 2023 to
 *   2027 file that would be a bounding box from the mesh Revit saved for it,
 *   as `rvt-ifc` does without `--no-saved-meshes`; `false` keeps their
 *   bounding boxes and skips the extra pass over the file's saved graphics.
 * - `phase` (a phase's name, matched exactly first, or its ElementId as a
 *   number) exports that project phase, as `rvt-ifc --phase` does: an element
 *   that does not exist in it, and a room whose own phase is not it, are left
 *   out. Left out, the export is the project's last phase. A phase the file
 *   lacks throws, with the file's phases in the message. The result's
 *   `phases` lists them (`{ id, name? }`, in order, the last being the
 *   default).
 *
 * Byte limits are whole numbers of bytes. A stream a limit keeps from being
 * read is listed in `diagnostics` (the `stream_not_read_resource_limit`
 * skipped item and a `Not read whole:` warning per stream, #1075), and the
 * model is missing what it holds. Unknown fields and fractional, negative
 * or non-finite byte limits throw.
 *
 * `progress`, when given, is a JS function `(stage, done, total)` called as
 * the decoder works: `stage` is a [`Stage`] name as `rvt-gltf --progress`
 * prints it (`schema-parse`, `candidate-scan`, `element-decode`,
 * `partition-scan`, `partition-recovery`, `saved-graphics`, `saved-meshes`),
 * `done` a count and
 * `total` the count it is out of, or `null` where the stage has no
 * denominator yet (#1195). It is called when a stage begins, when it ends,
 * and each time a stage with a total passes another whole percent, so a
 * stage costs at most about a hundred calls. An exception it throws is
 * ignored.
 */
export function openRvtBytesWithDiagnosticsModeAndOpenLimits(bytes: Uint8Array, mode: string, limits: any, progress?: Function | null): any;

/**
 * Quick summary — reads only the cheap metadata (BasicFileInfo +
 * PartAtom + stream inventory) and returns instantly even for
 * multi-hundred-megabyte RFAs. Used by the viewer for the
 * progressive-loading splash before the full model parse
 * completes. Returns a [`rvt::reader::Summary`] as a JS object.
 */
export function quickSummary(bytes: Uint8Array): any;

/**
 * Render `model` as a 2D SVG plan view (sheet). Options control
 * dimensions + labels + background; pass `null` for defaults.
 */
export function renderPlanSvg(model: any, options: any): string;

/**
 * The saved parameters of the elements `ids` (ElementIds), as JSON text:
 * `{ release, release_read, release_experimental, releases_read,
 * releases_measured, elements, unresolved_family_slots,
 * instance_parameters_without_value }`.
 *
 * It is the read `rvt-elements` and Python's `decoded_elements()` list as an
 * element's `parameters` (RE-207, `rvt::research::native_element_parameters`),
 * so each entry of `elements[id]` is the entry those print for that element:
 * name (null for a built-in), `parameter_id`, `kind`, `storage_type`,
 * `value` in internal units with `si_value` and `si_unit` where the unit is
 * known, `level` (`instance` or `type`) and the record it was read from.
 * `release_read` is false, and `elements` empty, for a file of a release
 * outside `releases_read`; `release_experimental` is true for one of
 * `releases_read` that `releases_measured` leaves out. An element whose id has
 * no record is left out of `elements`. The two counts are what the read could
 * not list for these elements.
 *
 * `bytes` is the whole file and is opened here for this call alone, with
 * `limits` as `openRvtBytesWithDiagnosticsModeAndOpenLimits` takes them
 * (`largeModel`, `maxStreamBytes`, `maxInflateBytes`; `null` for the
 * defaults), and dropped when it returns: nothing of the file stays in this
 * instance. The page calls it in a worker of its own, for one element at a
 * time, and ends that worker when it has answered. An id that is not a whole
 * number, a file that is not a Revit file and a file whose parameters cannot
 * be read throw.
 */
export function savedParameters(bytes: Uint8Array, ids: Float64Array, limits: any): string;

/**
 * Spreadsheet schedule of an exported model as CSV
 * ([`rvt::ifc::schedule_csv`]): `kind` is `"elements"` (every building
 * element the IFC export writes, on the storey it puts it on) or `"rooms"`;
 * `metric` switches lengths to metres; `excel`
 * prefixes a UTF-8 byte-order mark so Excel on Windows reads non-ASCII
 * names correctly.
 */
export function scheduleCsv(model: any, kind: string, metric: boolean, excel: boolean): string;
