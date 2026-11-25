// Chụp screenshot marketplace: chạy harness.html (webview thật + model IFC thật)
// trong headless Chrome với WebGL software rendering.
const puppeteer = require("puppeteer");
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "docs", "screenshots");
const PORT = 8123;
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".ifc": "application/octet-stream",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/scripts/harness.html";
    const file = path.join(root, p);
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  });
  await new Promise((r) => server.listen(PORT, r));

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console]", m.text());
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });

  // chờ parse xong (overlay ẩn) — timeout dài cho lần init WASM đầu
  await page.waitForFunction(
    () => { const el = document.querySelector(".ifc-loading"); return el && el.hidden === true; },
    { timeout: 180000 }
  );
  await sleep(2500);

  // zoom sát model cho ảnh marketplace (scroll-wheel qua OrbitControls)
  const cbox = await (await page.$("canvas")).boundingBox();
  await page.mouse.move(cbox.x + cbox.width * 0.5, cbox.y + cbox.height * 0.55);
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel({ deltaY: -240 });
    await sleep(120);
  }
  await sleep(800);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1) 3D view chính
  await page.screenshot({ path: path.join(OUT_DIR, "viewer-3d.png") });
  console.log("OK viewer-3d.png");

  // 2) Sidebar Elements mở
  await page.click("#btn-elements");
  await sleep(500);
  await page.screenshot({ path: path.join(OUT_DIR, "viewer-elements.png") });
  console.log("OK viewer-elements.png");

  // 3) Chọn phần tử → inspector. Thử vài điểm click cho tới khi inspector hiện
  const canvas = await page.$("canvas");
  const box = await canvas.boundingBox();
  const points = [
    [0.52, 0.52], [0.5, 0.5], [0.55, 0.45], [0.48, 0.55], [0.6, 0.6], [0.45, 0.6],
  ];
  let selected = false;
  for (const [fx, fy] of points) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await sleep(350);
    selected = await page.evaluate(
      () => { const el = document.querySelector(".ifc-inspector"); return el && el.hidden === false; }
    );
    if (selected) break;
  }
  if (selected) {
    await page.screenshot({ path: path.join(OUT_DIR, "viewer-inspector.png") });
    console.log("OK viewer-inspector.png");
  } else {
    console.log("WARN: không chọn được phần tử nào — bỏ qua ảnh inspector");
  }

  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
