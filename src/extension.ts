import * as vscode from "vscode";
import { IfcEditorProvider } from "./ifcEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  const common = {
    supportsMultipleEditorsPerDocument: false,
    // giữ scene khi chuyển tab — không phải parse lại model mỗi lần hiện lại
    webviewOptions: { enableFindWidget: false, retainContextWhenHidden: true },
  };

  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      IfcEditorProvider.viewTypeIfc,
      new IfcEditorProvider(context, "ifc"),
      common
    ),
    vscode.window.registerCustomEditorProvider(
      IfcEditorProvider.viewTypeRvt,
      new IfcEditorProvider(context, "rvt"),
      common
    )
  );
}

export function deactivate(): void {
  // nothing to clean up
}
