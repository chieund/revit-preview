// End-to-end smoke test (run after `npm run compile`):
//   1. .rvt → IFC4 with the extension's own worker (dist/worker-rvt.js + rvt-wasm)
//   2. pack the bytes with the extension host's own code (src/modelTransfer.ts)
//      and serialize like VS Code (JSON.stringify, typed arrays → binary) — catches
//      bugs like a Node Buffer turning into {type:"Buffer"} via toJSON() (2.0.1)
//   3. load into the real webview (scripts/harness.html, same CSP as VS Code) in
//      headless Chrome; check meshes render, no errors, and clicking selects
// Usage:  node scripts/smoke.js [file.rvt|file.ifc ...]
// Defaults to the files in samples/ (missing ones are skipped).
const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "samples", ".smoke"); // samples/ is gitignored
const PORT = 8124;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".wasm": "application/wasm" };

const DEFAULT_FILES = [
  "samples/AC20-FZK-Haus.ifc",
  "samples/IfcOpenHouse_IFC4.ifc",
  "samples/rac_basic_2024.rvt",
];

/** Loads src/modelTransfer.ts (the real extension-host code) without VS Code. */
function loadHostTransfer() {
  const out = esbuild.buildSync({
    entryPoints: [path.join(root, "src", "modelTransfer.ts")],
    bundle: true, platform: "node", format: "cjs", write: false,
  });
  const mod = { exports: {} };
  new Function("module", "exports", out.outputFiles[0].text)(mod, mod.exports);
  return mod.exports;
}

/**
 * Serialize like VS Code's webview.postMessage: JSON.stringify with a replacer
 * that keeps only typed arrays/ArrayBuffers as binary. Note toJSON() (e.g. Node
 * Buffer) runs BEFORE the replacer — exactly as in VS Code.
 */
function serializeLikeVsCode(messages) {
  return JSON.stringify(messages, (_k, v) => {
    if (ArrayBuffer.isView(v)) return { $$bin: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString("base64") };
    if (v instanceof ArrayBuffer) return { $$bin: Buffer.from(v).toString("base64") };
    return v;
  });
}

let servedMessages = "[]"; // served at /__messages.json for the harness

function convertRvt(file) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(root, "dist", "worker-rvt.js"), {
      workerData: { bytes: fs.readFileSync(file), mode: "geometry", largeModel: false },
      resourceLimits: { maxOldGenerationSizeMb: 4096 },
    });
    let lastStage = "";
    worker.on("message", (msg) => {
      if (msg.type === "progress" && msg.stage !== lastStage) {
        lastStage = msg.stage;
        process.stdout.write(`    · ${msg.stage}\n`);
      } else if (msg.type === "done") {
        resolve(msg.step);
        void worker.terminate();
      } else if (msg.type === "error") {
        reject(new Error(msg.message));
        void worker.terminate();
      }
    });
    worker.on("error", reject);
  });
}

async function checkInViewer(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // favicon 404s and the like are not viewer errors
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });

  await page.goto(`http://localhost:${PORT}/?messages=/__messages.json`);
  await page.waitForFunction(
    () => document.querySelector(".ifc-loading")?.hidden === true,
    { timeout: 300000 }
  );
  const result = await page.evaluate(() => ({
    status: document.querySelector(".ifc-status-info")?.textContent ?? "",
    banner: document.querySelector(".ifc-banner")?.hidden ? "" :
      document.querySelector(".ifc-banner-text")?.textContent ?? "",
    empty: document.querySelector(".ifc-empty")?.hidden === false,
    stats: window.__viewerStats?.() ?? {},
  }));

  // click a few points and check whether the inspector opens
  const box = await (await page.$("canvas")).boundingBox();
  let selected = false;
  for (const [fx, fy] of [[0.5, 0.5], [0.52, 0.52], [0.45, 0.55], [0.55, 0.45], [0.5, 0.6], [0.6, 0.5]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    selected = await page.evaluate(() => document.querySelector(".ifc-inspector")?.hidden === false);
    if (selected) break;
  }
  await page.close();
  return { ...result, selected, errors };
}

async function main() {
  const files = (process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES)
    .filter((f) => {
      if (fs.existsSync(path.resolve(root, f))) return true;
      console.log(`SKIP ${f} (not found)`);
      return false;
    });
  if (!files.length) throw new Error("No files to test");

  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/__messages.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(servedMessages);
      return;
    }
    if (p === "/") p = "/scripts/harness.html";
    fs.readFile(path.join(root, p), (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(p)] || "application/octet-stream" });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });

  const transfer = loadHostTransfer();
  let failed = 0;
  try {
    for (const f of files) {
      console.log(`\n▶ ${f}`);
      try {
        // like the extension host: .ifc = bytes read from disk, .rvt = Buffer.from(step)
        let bytes = fs.readFileSync(path.resolve(root, f));
        if (f.toLowerCase().endsWith(".rvt")) {
          const t0 = Date.now();
          const step = await convertRvt(path.resolve(root, f));
          if (!step.startsWith("ISO-10303-21")) throw new Error("output is not an IFC STEP file");
          fs.mkdirSync(OUT_DIR, { recursive: true });
          const out = path.join(OUT_DIR, path.basename(f) + ".ifc");
          fs.writeFileSync(out, step);
          console.log(`    converted in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${(step.length / 1e6).toFixed(1)} MB IFC`);
          bytes = Buffer.from(step, "utf8");
        }
        servedMessages = serializeLikeVsCode(transfer.buildModelMessages(path.basename(f), bytes));
        const r = await checkInViewer(browser);
        console.log(`    status:   ${r.status}`);
        console.log(`    selected: ${r.selected}`);
        console.log(`    render:   ${JSON.stringify(r.stats)}`);
        const problems = [...r.errors];
        if (r.banner) problems.push(`banner: ${r.banner}`);
        if (r.empty) problems.push("no geometry rendered");
        if (!/\d+ meshes/.test(r.status) || /\b0 meshes/.test(r.status)) problems.push("no meshes in status bar");
        if (problems.length) {
          failed++;
          console.log(`  ✗ FAIL\n      ${problems.join("\n      ")}`);
        } else {
          console.log("  ✓ PASS");
        }
      } catch (e) {
        failed++;
        console.log(`  ✗ FAIL: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`\n${files.length - failed}/${files.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
