import * as vscode from "vscode";

/** Document chỉ đọc: giữ nội dung file IFC dưới dạng bytes. */
export class IfcDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri, readonly bytes: Uint8Array) {}
  dispose(): void {
    // nothing to clean up
  }
}

export class IfcEditorProvider implements vscode.CustomReadonlyEditorProvider<IfcDocument> {
  public static readonly viewType = "revit-preview.ifcViewer";

  constructor(private readonly context: vscode.ExtensionContext) {}

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

    // Webview yêu cầu file -> gửi bytes theo chunk (tránh vượt giới hạn 1 message)
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type !== "requestModel") return;

      const fileName = document.uri.path.split("/").pop() ?? "model.ifc";
      const b64 = Buffer.from(document.bytes).toString("base64");
      const CHUNK = 3_000_000; // ký tự base64 mỗi chunk (~2.2 MB nhị phân)
      const total = Math.ceil(b64.length / CHUNK);

      await webviewPanel.webview.postMessage({
        type: "modelMeta",
        name: fileName,
        byteSize: document.bytes.byteLength,
        chunks: total,
      });

      for (let i = 0; i < total; i++) {
        await webviewPanel.webview.postMessage({
          type: "modelChunk",
          data: b64.slice(i * CHUNK, (i + 1) * CHUNK),
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
