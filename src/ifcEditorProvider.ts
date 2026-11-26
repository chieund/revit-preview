import * as vscode from "vscode";
import { convertRvtToIfc } from "./rvtConvert";
import { buildModelMessages } from "./modelTransfer";

/** Read-only document: holds the file contents as bytes (IFC or RVT). */
export class IfcDocument implements vscode.CustomDocument {
  constructor(readonly uri: vscode.Uri, readonly bytes: Uint8Array) {}
  dispose(): void {
    // nothing to clean up
  }
}

/**
 * CustomReadonlyEditorProvider for both file kinds:
 *  - "ifc": bytes go straight to the webview (rendered by web-ifc)
 *  - "rvt": converted to IFC4 with rvt-wasm (worker thread), then sent like .ifc
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

    // Minimal HTML shell: the whole UI (toolbar, sidebar, status bar) is built
    // by webview/main.ts, styles come from webview/styles.ts.
    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // .rvt: start the IFC4 conversion (worker thread) right away but do NOT
    // await it here — the listener below must be registered first, because the
    // webview sends "requestModel" as soon as it loads while conversion can take
    // tens of seconds. Errors are held and only sent once the webview is ready
    // (on "requestModel"): an old-version error can fire before it listens.
    // Closing the tab mid-conversion stops the worker (frees up to 4 GB heap).
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

    // Webview asks for the model -> send the bytes in chunks (per-message size limit)
    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type !== "requestModel") return;

      const converted = await ifcBytesPromise;
      if ("error" in converted) {
        await webviewPanel.webview.postMessage({ type: "convertError", message: converted.error });
        return;
      }
      const ifcBytes = converted.bytes;

      const fileName = document.uri.path.split("/").pop() ?? "model.ifc";
      // raw binary chunks (no base64) — see modelTransfer.ts
      for (const m of buildModelMessages(fileName, ifcBytes)) {
        await webviewPanel.webview.postMessage(m);
      }
    });
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media", "webview.js")
    );
    // folder holding web-ifc.wasm (the webview fetches it from here)
    const wasmDir = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "media")
    ).toString() + "/";
    const nonce = getNonce();

    // 'unsafe-eval' is REQUIRED: web-ifc (emscripten) evaluates JS strings while
    // parsing — without it every model fails (verified with scripts/smoke.js).
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
