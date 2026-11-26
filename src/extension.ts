import * as vscode from "vscode";
import { IfcEditorProvider } from "./ifcEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  const common = {
    supportsMultipleEditorsPerDocument: false,
    // keep the scene alive when the tab is hidden — no re-parse on every switch
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
