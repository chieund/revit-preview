// Code chạy BÊN TRONG webview (môi trường browser): three.js + web-ifc
// Bố cục UI được dựng bằng DOM API theo phong cách của dwg-previewer:
// toolbar trên → workspace (canvas + sidebar) → statusbar dưới.
import { WEBVIEW_STYLES } from "./styles";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as WebIFC from "web-ifc";

declare function acquireVsCodeApi(): { postMessage(msg: unknown): void };
const vscode = acquireVsCodeApi();

// ---------- inject styles ----------
const styleEl = document.createElement("style");
styleEl.textContent = WEBVIEW_STYLES;
document.head.appendChild(styleEl);

// ---------- dựng khung UI ----------
const root = document.getElementById("root") as HTMLDivElement;
root.innerHTML = `
  <div class="ifc-toolbar">
    <button class="ifc-tool-button" id="btn-fit" title="Fit model to view">⌂ Fit</button>
    <button class="ifc-tool-button" id="btn-wireframe" title="Toggle wireframe">☰ Wireframe</button>
    <button class="ifc-tool-button ifc-active" id="btn-grid" title="Toggle grid"># Grid</button>
    <button class="ifc-tool-button" id="btn-elements" title="Element list by type">▦ Elements</button>
    <div class="ifc-banner" hidden>
      <span class="ifc-banner-text"></span>
      <button class="ifc-banner-dismiss" title="Đóng">✕</button>
    </div>
  </div>
  <div class="ifc-workspace">
    <div class="ifc-canvas" id="canvas-host">
      <div class="ifc-inspector" hidden>
        <div class="ifc-inspector-header">
          <span class="ifc-inspector-title"></span>
          <button class="ifc-inspector-close" title="Close">✕</button>
        </div>
        <table class="ifc-inspector-table"></table>
      </div>
      <div class="ifc-empty" hidden>
        <div class="ifc-empty-title">No geometry found</div>
        <div class="ifc-empty-detail">This IFC file may have been exported schema-only.
        Re-export from Revit with the "IFC 4 Design Transfer View" MVD to keep the 3D geometry.</div>
      </div>
    </div>
    <div class="ifc-sidebar" hidden>
      <div class="ifc-elements">
        <div class="ifc-elements-header"><span class="ifc-elements-title">Elements</span></div>
        <input class="ifc-elements-filter" placeholder="Filter element types…">
        <div class="ifc-elements-body"></div>
      </div>
    </div>
  </div>
  <div class="ifc-statusbar">
    <span class="ifc-status-hint">Left-drag: orbit · Scroll: zoom · Right-drag: pan · Click: select element</span>
    <span class="ifc-status-spacer"></span>
    <span class="ifc-status-selection"></span>
    <span class="ifc-status-info"></span>
  </div>
  <div class="ifc-loading">
    <div class="ifc-spinner"></div>
    <span class="ifc-loading-text">Loading model…</span>
  </div>
`;

const canvasHost = document.getElementById("canvas-host") as HTMLElement;
const sidebar = root.querySelector(".ifc-sidebar") as HTMLElement;
const elementsBody = root.querySelector(".ifc-elements-body") as HTMLElement;
const elementsFilter = root.querySelector(".ifc-elements-filter") as HTMLInputElement;
const inspector = root.querySelector(".ifc-inspector") as HTMLElement;
const inspectorTitle = inspector.querySelector(".ifc-inspector-title") as HTMLElement;
const inspectorTable = inspector.querySelector(".ifc-inspector-table") as HTMLElement;
const inspectorClose = inspector.querySelector(".ifc-inspector-close") as HTMLButtonElement;
const emptyState = root.querySelector(".ifc-empty") as HTMLElement;
const loading = root.querySelector(".ifc-loading") as HTMLElement;
const loadingText = root.querySelector(".ifc-loading-text") as HTMLElement;
const banner = root.querySelector(".ifc-banner") as HTMLElement;
const bannerText = banner.querySelector(".ifc-banner-text") as HTMLElement;
const statusInfo = root.querySelector(".ifc-status-info") as HTMLElement;
const statusSelection = root.querySelector(".ifc-status-selection") as HTMLElement;
const extVersion = (document.body as HTMLElement).dataset.extVersion ?? "v?";

function showBanner(text: string): void {
  bannerText.textContent = text;
  banner.hidden = false;
}
banner.querySelector(".ifc-banner-dismiss")?.addEventListener("click", () => {
  banner.hidden = true;
});

// Bắt mọi lỗi rơi ngoài try/catch để không bao giờ kẹt ở màn loading im lặng
window.addEventListener("error", (e) => {
  loading.hidden = true;
  showBanner(`Webview error: ${e.message}`);
});
window.addEventListener("unhandledrejection", (e) => {
  loading.hidden = true;
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
  showBanner(`Webview error: ${reason}`);
});

// ---------- three.js scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e1e1e);

const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
canvasHost.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.8);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const grid = new THREE.GridHelper(100, 100, 0x555555, 0x333333);
scene.add(grid);

const resize = (): void => {
  const w = canvasHost.clientWidth;
  const h = canvasHost.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
};
new ResizeObserver(resize).observe(canvasHost);
resize();

const animate = (): void => {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
};
animate();

// ---------- nhận file IFC từ extension host ----------
const wasmDir = (document.body as HTMLElement).dataset.wasmDir ?? "";
let modelBuffer: Uint8Array | null = null;
let received = 0;
let expected = 0;

const base64ToBytes = (b64: string): Uint8Array => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

window.addEventListener("message", async (event) => {
  const msg = event.data;
  switch (msg.type) {
    case "modelMeta": {
      expected = msg.chunks;
      received = 0;
      loadingText.textContent = `Loading ${msg.name}… (extension v${extVersion})`;
      break;
    }
    case "convertProgress": {
      const pct = msg.total ? ` (${Math.round((msg.done / msg.total) * 100)}%)` : "";
      loadingText.textContent = `Converting Revit model: ${msg.stage}${pct}`;
      break;
    }
    case "convertError": {
      loading.hidden = true;
      showBanner(`Cannot read this .rvt: ${msg.message}`);
      break;
    }
    case "modelChunk": {
      const bytes = base64ToBytes(msg.data);
      modelBuffer = modelBuffer ? concat(modelBuffer, bytes) : bytes;
      received++;
      break;
    }
    case "modelDone": {
      if (!modelBuffer) return;
      loadingText.textContent = "Parsing IFC (first run may take a few seconds)…";
      // nhường UI thở 1 frame trước khi chạy WASM
      await new Promise((r) => requestAnimationFrame(r));
      try {
        await buildModel(modelBuffer);
      } catch (e: unknown) {
        loading.hidden = true;
        showBanner(`IFC parse error: ${e instanceof Error ? e.message : String(e)}`);
        console.error(e);
      }
      break;
    }
  }
});

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// ---------- parse IFC + dựng scene ----------
interface TypeGroup {
  typeCode: number;
  label: string;
  color: THREE.Color;
  nodes: THREE.Mesh[];
  elementIds: Set<number>;
  visible: boolean;
  triangles: number;
}

const typeGroups = new Map<number, TypeGroup>();
const nodesByElement = new Map<number, THREE.Mesh[]>();
const modelGroup = new THREE.Group();
scene.add(modelGroup);

/** English labels for common IFC element types. */
const TYPE_LABELS_EN: Record<string, string> = {
  WALL: "Wall",
  WALLSTANDARDCASE: "Wall (standard)",
  SLAB: "Slab",
  COLUMN: "Column",
  BEAM: "Beam",
  DOOR: "Door",
  WINDOW: "Window",
  STAIR: "Stair",
  RAILING: "Railing",
  ROOF: "Roof",
  COVERING: "Covering",
  SITE: "Site",
  BUILDING: "Building",
  STAIRFLIGHT: "Stair flight",
  CURTAINWALL: "Curtain wall",
  PLATE: "Plate",
  MEMBER: "Structural member",
  FOOTING: "Footing",
  PILE: "Pile",
  SPACE: "Space",
  FURNISHINGELEMENT: "Furniture",
  SANITARYTERMINAL: "Sanitary terminal",
};

/** IFCWALLSTANDARDCASE -> "Wall (standard)" / "Member" -> "Structural member". */
function prettyType(typeCode: number, ifcAPI: WebIFC.IfcAPI): string {
  const raw = ifcAPI.GetNameFromTypeCode(typeCode) ?? `Type ${typeCode}`;
  const bare = raw.replace(/^IFC/i, "");
  const spaced = bare.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return TYPE_LABELS_EN[bare.toUpperCase()] ?? (spaced || raw);
}

function groupOf(typeCode: number, ifcAPI: WebIFC.IfcAPI): TypeGroup {
  let g = typeGroups.get(typeCode);
  if (!g) {
    g = {
      typeCode,
      label: prettyType(typeCode, ifcAPI),
      color: new THREE.Color(0x888888),
      nodes: [],
      elementIds: new Set(),
      visible: true,
      triangles: 0,
    };
    typeGroups.set(typeCode, g);
  }
  return g;
}

let projectName = "(không rõ)";
let totalMeshCount = 0;
let totalTriangles = 0;

async function buildModel(buffer: Uint8Array): Promise<void> {
  const ifcAPI = new WebIFC.IfcAPI();
  ifcAPI.SetWasmPath(wasmDir, true);
  // forceSingleThread=true: webview không đảm bảo crossOriginIsolated, nhánh
  // multithread của web-ifc sẽ kẹt vĩnh viễn khi pthread không tạo được.
  await ifcAPI.Init(undefined, true);

  const modelID = ifcAPI.OpenModel(buffer, {
    COORDINATE_TO_ORIGIN: true, // đặt model về gốc tọa độ
  });

  // --- tên dự án ---
  try {
    const projIds = ifcAPI.GetLineIDsWithType(modelID, WebIFC.IFCPROJECT);
    if (projIds.size() > 0) {
      const proj = ifcAPI.GetLine(modelID, projIds.get(0));
      projectName = proj.Name?.value ?? proj.LongName?.value ?? "(không rõ)";
    }
  } catch {
    // bỏ qua
  }

  // --- thu thập geometry, nhóm theo loại phần tử ---
  ifcAPI.StreamAllMeshes(modelID, (flatMesh) => {
    const typeCode = Number(ifcAPI.GetLineType(modelID, flatMesh.expressID)) || 0;
    const group = groupOf(typeCode, ifcAPI);
    group.elementIds.add(flatMesh.expressID);

    for (let i = 0; i < flatMesh.geometries.size(); i++) {
      const placedGeom = flatMesh.geometries.get(i);

      const geom = ifcAPI.GetGeometry(modelID, placedGeom.geometryExpressID);
      const verts = ifcAPI.GetVertexArray(geom.GetVertexData(), geom.GetVertexDataSize());
      const idx = ifcAPI.GetIndexArray(geom.GetIndexData(), geom.GetIndexDataSize());

      // vertex buffer của web-ifc: [x,y,z,nx,ny,nz] * n
      const positions = new Float32Array((verts.length / 6) * 3);
      for (let v = 0, j = 0; v < verts.length; v += 6, j += 3) {
        positions[j] = verts[v];
        positions[j + 1] = verts[v + 1];
        positions[j + 2] = verts[v + 2];
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
      geometry.computeVertexNormals();

      const c = placedGeom.color ?? { x: 0.8, y: 0.8, z: 0.8, w: 1 };
      const meshColor = new THREE.Color(c.x, c.y, c.z);
      const material = new THREE.MeshLambertMaterial({
        color: meshColor,
        transparent: c.w < 1,
        opacity: c.w,
        side: THREE.DoubleSide,
      });

      const node = new THREE.Mesh(geometry, material);
      node.applyMatrix4(new THREE.Matrix4().fromArray(placedGeom.flatTransformation));
      node.userData = { expressID: flatMesh.expressID, typeCode };
      modelGroup.add(node);

      group.nodes.push(node);
      group.color.lerp(meshColor, 0.2);
      group.triangles += idx.length / 3;
      totalTriangles += idx.length / 3;

      const list = nodesByElement.get(flatMesh.expressID) ?? [];
      list.push(node);
      nodesByElement.set(flatMesh.expressID, list);
    }
    totalMeshCount++;
  });

  // lưu property rút gọn của từng phần tử trước khi đóng model
  collectProps(modelID, ifcAPI);

  ifcAPI.CloseModel(modelID);
  ifcAPI.Dispose();

  // --- trạng thái hiển thị ---
  if (totalMeshCount === 0) {
    loading.hidden = true;
    emptyState.hidden = false;
    statusInfo.textContent = projectName;
    return;
  }

  buildElementsPanel();
  fitCamera();
  loading.hidden = true;
  updateStatusBar();
  vscode.postMessage({ type: "status", text: `Revit Preview: ${totalMeshCount} meshes, ${totalTriangles.toLocaleString()} triangles` });
}

// ---------- camera ----------
function fitCamera(): void {
  const box = new THREE.Box3().setFromObject(modelGroup);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) || 10;
  camera.position.set(center.x + radius, center.y + radius * 0.8, center.z + radius);
  controls.target.copy(center);
  controls.update();
  camera.near = radius / 1000;
  camera.far = radius * 20;
  camera.updateProjectionMatrix();
  grid.scale.setScalar(radius / 5);
  grid.position.set(center.x, box.min.y, center.z);
}

// ---------- panel Phần tử (sidebar) ----------
const SWATCH = () => document.createElement("span");

function buildElementsPanel(): void {
  elementsBody.textContent = "";
  const sorted = [...typeGroups.values()].sort((a, b) => b.elementIds.size - a.elementIds.size);

  for (const g of sorted) {
    const row = document.createElement("div");
    row.className = "ifc-elements-row";
    row.dataset.typeCode = String(g.typeCode);

    const eye = document.createElement("button");
    eye.className = "ifc-eye on";
    eye.title = "Show/hide this type";
    eye.textContent = "◉";

    const swatch = SWATCH();
    swatch.className = "ifc-swatch";
    swatch.style.background = `#${g.color.getHexString()}`;

    const name = document.createElement("span");
    name.className = "ifc-elements-name";
    name.textContent = g.label;

    const count = document.createElement("span");
    count.className = "ifc-elements-count";
    count.textContent = `${g.elementIds.size}`;

    const isolate = document.createElement("button");
    isolate.className = "ifc-isolate";
    isolate.title = "Isolate this type";
    isolate.textContent = "⌖";

    row.append(eye, swatch, name, count, isolate);
    elementsBody.appendChild(row);

    const syncEye = (): void => {
      eye.classList.toggle("on", g.visible);
      name.classList.toggle("ifc-hidden", !g.visible);
    };
    eye.addEventListener("click", () => {
      g.visible = !g.visible;
      applyGroupVisibility(g);
      syncEye();
    });
    isolate.addEventListener("click", () => {
      const onlyThis = [...typeGroups.values()].filter((x) => x.visible).length === 1 && g.visible;
      for (const other of typeGroups.values()) {
        other.visible = onlyThis ? true : other === g;
        applyGroupVisibility(other);
      }
      for (const other of sorted) {
        const otherRow = elementsBody.querySelector(`[data-type-code="${other.typeCode}"]`);
        otherRow?.querySelector(".ifc-eye")?.classList.toggle("on", other.visible);
        otherRow?.querySelector(".ifc-elements-name")?.classList.toggle("ifc-hidden", !other.visible);
      }
    });
  }
}

function applyGroupVisibility(g: TypeGroup): void {
  for (const node of g.nodes) node.visible = g.visible;
}

elementsFilter.addEventListener("input", () => {
  const q = elementsFilter.value.trim().toLowerCase();
  let anyMatch = false;
  for (const row of Array.from(elementsBody.children) as HTMLElement[]) {
    const name = row.querySelector(".ifc-elements-name")?.textContent?.toLowerCase() ?? "";
    const match = !q || name.includes(q);
    row.style.display = match ? "" : "none";
    if (match) anyMatch = true;
  }
  let nomatch = elementsBody.querySelector(".ifc-elements-nomatch") as HTMLElement | null;
  if (!anyMatch) {
    if (!nomatch) {
      nomatch = document.createElement("div");
      nomatch.className = "ifc-elements-nomatch";
      nomatch.textContent = "No matching type";
      elementsBody.appendChild(nomatch);
    }
  } else {
    nomatch?.remove();
  }
});

// ---------- chọn phần tử (picking + inspector) ----------
const highlightMaterial = new THREE.MeshBasicMaterial({
  color: 0xffcc00,
  transparent: true,
  opacity: 0.9,
  side: THREE.DoubleSide,
});
let selectedExpressID: number | null = null;
/** material gốc của các node đang được highlight, để trả lại khi bỏ chọn. */
const highlightedOriginals = new Map<THREE.Mesh, THREE.Material>();

function clearSelection(): void {
  for (const [node, material] of highlightedOriginals) {
    node.material = material as THREE.Material;
  }
  highlightedOriginals.clear();
  selectedExpressID = null;
  inspector.hidden = true;
  statusSelection.textContent = "";
}

function selectElement(expressID: number, ifcProps: () => Record<string, string>): void {
  clearSelection();
  const nodes = nodesByElement.get(expressID) ?? [];
  for (const node of nodes) {
    highlightedOriginals.set(node, node.material as THREE.Material);
    node.material = highlightMaterial;
  }
  selectedExpressID = expressID;

  const props = ifcProps();
  inspectorTitle.textContent = props["Type"] ?? "Element";
  inspectorTable.textContent = "";
  for (const [label, value] of Object.entries(props)) {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.className = "ifc-inspector-label";
    tdLabel.textContent = label;
    const tdValue = document.createElement("td");
    tdValue.textContent = value;
    tr.append(tdLabel, tdValue);
    inspectorTable.appendChild(tr);
  }
  inspector.hidden = false;
  statusSelection.textContent = `Selected: ${props["Type"] ?? "?"} #${expressID}`;
}

// raycaster trên pointer click (không tính drag)
let downPos: { x: number; y: number } | null = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (e.button === 0) downPos = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener("pointerup", (e) => {
  if (e.button !== 0 || !downPos) return;
  const moved = Math.abs(e.clientX - downPos.x) + Math.abs(e.clientY - downPos.y);
  downPos = null;
  if (moved > 4) return; // đó là drag của OrbitControls, không phải click

  const rect = renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(modelGroup.children, false);
  if (hits.length === 0) {
    clearSelection();
    return;
  }
  const expressID = (hits[0].object as THREE.Mesh).userData.expressID as number;
  // ifcAPI đã Dispose sau parse — property đọc từ snapshot đã lưu lúc parse
  selectElement(expressID, () => propsSnapshot.get(expressID) ?? { "Type": "?" });
});

/** Property rút gọn của từng phần tử, lưu lúc parse vì model đóng sau đó. */
const propsSnapshot = new Map<number, Record<string, string>>();

function snapshotProps(modelID: number, ifcAPI: WebIFC.IfcAPI, expressID: number): void {
  try {
    const line = ifcAPI.GetLine(modelID, expressID);
  const props: Record<string, string> = {
    "Type": prettyType(Number(ifcAPI.GetLineType(modelID, expressID)) || 0, ifcAPI),
  };
  const val = (v: unknown): string | undefined => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "object" && v !== null && "value" in (v as Record<string, unknown>)) {
      const inner = (v as { value: unknown }).value;
      return inner === null || inner === undefined ? undefined : String(inner);
    }
    return typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : undefined;
  };
  const globalId = val(line.GlobalId);
  if (globalId) props["GlobalId"] = globalId;
  const name = val(line.Name);
  if (name) props["Name"] = name;
    const tag = val(line.Tag);
    if (tag) props["Tag"] = tag;
    // vài property primitive khác nếu có
    for (const [k, v] of Object.entries(line)) {
      if (["GlobalId", "Name", "Tag", "type", "expressID", "OwnerHistory"].includes(k)) continue;
      const s = val(v);
      if (s !== undefined && Object.keys(props).length < 10) props[k] = s;
    }
    propsSnapshot.set(expressID, props);
  } catch {
    // bỏ qua phần tử lỗi
  }
}

// snapshot property khi parse: gọi sau StreamAllMeshes cho mỗi element
const collectProps = (modelID: number, ifcAPI: WebIFC.IfcAPI): void => {
  for (const expressID of nodesByElement.keys()) snapshotProps(modelID, ifcAPI, expressID);
};

// ---------- toolbar ----------
document.getElementById("btn-fit")?.addEventListener("click", fitCamera);

const wireframeButton = document.getElementById("btn-wireframe") as HTMLButtonElement | null;
wireframeButton?.addEventListener("click", () => {
  const on = !wireframeButton.classList.contains("ifc-active");
  wireframeButton.classList.toggle("ifc-active", on);
  for (const g of typeGroups.values()) {
    for (const node of g.nodes) {
      (node.material as THREE.MeshLambertMaterial).wireframe = on;
    }
  }
  highlightMaterial.wireframe = on;
});

const gridButton = document.getElementById("btn-grid") as HTMLButtonElement | null;
gridButton?.addEventListener("click", () => {
  grid.visible = !grid.visible;
  gridButton.classList.toggle("ifc-active", grid.visible);
});

const elementsButton = document.getElementById("btn-elements") as HTMLButtonElement | null;
elementsButton?.addEventListener("click", () => {
  const open = !elementsButton.classList.contains("ifc-active");
  elementsButton.classList.toggle("ifc-active", open);
  sidebar.hidden = !open;
  resize();
});

inspectorClose.addEventListener("click", clearSelection);

// ---------- statusbar ----------
function updateStatusBar(): void {
  const groups = typeGroups.size;
  statusInfo.textContent = `${projectName} · ${groups} types · ${totalMeshCount} meshes · ${totalTriangles.toLocaleString()} △`;
}

// lưu props ngay sau parse: nối collectProps vào buildModel qua hook
// (được gọi trong buildModel sau StreamAllMeshes — xem dưới)

// yêu cầu extension host gửi file
vscode.postMessage({ type: "requestModel" });
