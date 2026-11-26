import * as vscode from "vscode";
import { convertRvtToIfc } from "./rvtConvert";

/** Document chỉ đọc: giữ nội dung file dưới dạng bytes (IFC hoặc RVT). */
export class IfcDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri, readonly bytes: Uint8Array) {}
  dispose(): void {
    // nothing to clean up
  }
}

/**
 * CustomReadonlyEditorProvider cho cả hai loại file:
 *  - "ifc": gửi thẳng bytes vào webview (web-ifc render)
 *  - "rvt": chuyển .rvt → IFC4 bằng rvt-wasm (worker thread), rồi gửi như .ifc
 */
export class IfcEditorProvider implements vscode.CustomReadonlyEditorProvider<IfcDocument> {
  public static readonly viewTypeIfc = "revit-preview.ifcViewer";
  public static readonly viewTypeRvt = "revit-preview.rvtViewer";

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly kind: "ifc" | "rvt"
  ) {}

  async openCustomDocument(uri: vscode.Uri): Promise<IfcDocument> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    return new IfcDocument(uri, bytes);
  }

  async resolveCustomEditor(
    document: IfcDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, "media");
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
    };

    // Khung HTML tối giản: toàn bộ UI (toolbar, sidebar, statusbar) được
    // dựng từ webview/main.ts, style lấy từ webview/styles.ts — giống cách
    // làm của dwg-previewer.
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // .rvt: khởi động chuyển đổi sang IFC4 (worker thread) ngay, nhưng KHÔNG
    // chờ ở đây — listener phải đăng ký trước, vì webview gửi "requestModel"
    // ngay khi tải xong, còn chuyển đổi có thể mất hàng chục giây.
    // Lỗi được giữ lại và chỉ gửi khi webview đã sẵn sàng (lúc "requestModel"),
    // vì lỗi phiên bản cũ có thể xảy ra trước khi webview kịp lắng nghe.
    // đóng tab giữa lúc chuyển đổi → dừng worker (giải phóng tới 4GB heap)
    const abort = new AbortController();
    webviewPanel.onDidDispose(() => abort.abort());

    const ifcBytesPromise: Promise<{ bytes: Uint8Array } | { error: string }> =
      this.kind === "rvt"
        ? convertRvtToIfc(document.bytes, "geometry", (p) => {
            void webviewPanel.webview.postMessage({ type: "convertProgress", ...p });
          }, abort.signal).then(
            (result) => ({ bytes: Buffer.from(result.step, "utf8") }),
            (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) })
          )
        : Promise.resolve({ bytes: document.bytes });

    // Webview yêu cầu file -> gửi bytes theo chunk (tránh vượt giới hạn 1 message)
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type !== "requestModel") return;

      const converted = await ifcBytesPromise;
      if ("error" in converted) {
        await webviewPanel.webview.postMessage({ type: "convertError", message: converted.error });
        return;
      }
      const ifcBytes = converted.bytes;

      const fileName = document.uri.path.split("/").pop() ?? "model.ifc";
      // Gửi binary trực tiếp (VS Code serialize Uint8Array hiệu quả), không
      // qua base64 — tiết kiệm ~33% kích thước và bước encode/decode.
      const CHUNK = 16 * 1024 * 1024; // byte mỗi chunk
      const total = Math.ceil(ifcBytes.byteLength / CHUNK);

      await webviewPanel.webview.postMessage({
        type: "modelMeta",
        name: fileName,
        byteSize: ifcBytes.byteLength,
        chunks: total,
      });

      for (let i = 0; i < total; i++) {
        await webviewPanel.webview.postMessage({
          type: "modelChunk",
          data: ifcBytes.subarray(i * CHUNK, (i + 1) * CHUNK),
        });
      }

      await webviewPanel.webview.postMessage({ type: "modelDone" });
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "webview.js")
    );
    // thư mục chứa web-ifc.wasm (webview sẽ fetch từ đây)
    const wasmDir = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media")
    ).toString() + "/";
    const nonce = getNonce();

    // 'unsafe-eval' là BẮT BUỘC: web-ifc (emscripten) eval chuỗi JS lúc parse —
    // bỏ đi thì mọi model đều lỗi (đã kiểm chứng bằng scripts/smoke.js).
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 script-src ${webview.cspSource} 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' 'unsafe-eval' blob:;
                 style-src ${webview.cspSource} 'self' 'unsafe-inline';
                 img-src ${webview.cspSource} 'self' data: blob:;
                 font-src ${webview.cspSource} 'self' data:;
                 worker-src ${webview.cspSource} 'self' blob:;
                 connect-src ${webview.cspSource} 'self';">
</head>
<body data-wasm-dir="${wasmDir}" data-ext-version="${this.context.extension.packageJSON.version}">
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
