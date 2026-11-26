// Build script: bundle extension + worker + webview, copy wasm files.
// rvt-wasm (the .rvt reader) is externalized — copied as-is to dist/rvtwasm/.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");

const nodeCommon = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  logLevel: "info",
  external: ["vscode", "./rvtwasm/*"],
};

const extensionOptions = {
  ...nodeCommon,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
};

const workerOptions = {
  ...nodeCommon,
  entryPoints: ["src/rvtWorker.ts"],
  outfile: "dist/worker-rvt.js",
};

const webviewOptions = {
  entryPoints: ["webview/main.ts"],
  bundle: true,
  outfile: "media/webview.js",
  format: "iife",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
};

function copyWasm() {
  const destDir = path.join(__dirname, "media");
  const src = path.join(__dirname, "node_modules", "web-ifc", "web-ifc.wasm");
  if (fs.existsSync(src)) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, "web-ifc.wasm"));
    console.log("Copied web-ifc.wasm -> media/");
  } else {
    console.warn("WARN: node_modules/web-ifc/web-ifc.wasm not found (run npm install first)");
  }
}

// rvt-wasm (nodejs target) -> dist/rvtwasm/: it is external to the bundle, so the
// runtime require("./rvtwasm/rvt.js") resolves to this location.
function copyRvtWasm() {
  const srcDir = path.join(__dirname, "vendor", "rvt-wasm");
  const destDir = path.join(__dirname, "dist", "rvtwasm");
  if (!fs.existsSync(srcDir)) {
    console.warn("WARN: vendor/rvt-wasm not found — .rvt support disabled");
    return;
  }
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of fs.readdirSync(srcDir)) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  }
  console.log("Copied rvt-wasm -> dist/rvtwasm/");
}

async function main() {
  copyWasm();
  copyRvtWasm();
  const contexts = await Promise.all([
    esbuild.context(extensionOptions),
    esbuild.context(workerOptions),
    esbuild.context(webviewOptions),
  ]);

  if (watch) {
    await Promise.all(contexts.map((c) => c.watch()));
    console.log("Watching for changes...");
  } else {
    await Promise.all(contexts.map((c) => c.rebuild()));
    await Promise.all(contexts.map((c) => c.dispose()));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
