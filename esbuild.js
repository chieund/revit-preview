// Build script: bundle extension + webview, copy wasm của web-ifc vào media/
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");

const extensionOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  logLevel: "info",
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
  const src = path.join(__dirname, "node_modules", "web-ifc", "web-ifc.wasm");
  const destDir = path.join(__dirname, "media");
  if (fs.existsSync(src)) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, path.join(destDir, "web-ifc.wasm"));
    console.log("Copied web-ifc.wasm -> media/");
  } else {
    console.warn("WARN: node_modules/web-ifc/web-ifc.wasm not found (run npm install first)");
  }
}

async function main() {
  copyWasm();
  const ctxExt = await esbuild.context(extensionOptions);
  const ctxWeb = await esbuild.context(webviewOptions);

  if (watch) {
    await Promise.all([ctxExt.watch(), ctxWeb.watch()]);
    console.log("Watching for changes...");
  } else {
    await Promise.all([ctxExt.rebuild(), ctxWeb.rebuild()]);
    await Promise.all([ctxExt.dispose(), ctxWeb.dispose()]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
