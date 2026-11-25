import * as vscode from "vscode";
import { IfcEditorProvider } from "./ifcEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      IfcEditorProvider.viewType,
      new IfcEditorProvider(context),
      {
        supportsMultipleEditorsPerDocument: false,
        webviewOptions: { enableFindWidget: false },
      }
    )
  );

  vscode.commands.registerCommand("revit-preview.openIfcViewer", async () => {
    const active = vscode.window.activeTextEditor?.document.uri ?? vscode.window.activeTextEditor?.document.uri;
    const picked = active ?? (await vscode.window.showOpenDialog({ filters: { "IFC": ["ifc"] } }))?.[0];
    if (picked) {
      await vscode.commands.executeCommand("vscode.openWith", picked, IfcEditorProvider.viewType);
    }
  });
}

export function deactivate(): void {
  // nothing to clean up
}
