/**
 * Stylesheet for the IFC webview — ported from the DWG previewer's
 * `styles.ts` (same variable naming, same component classes with an
 * `ifc-` prefix) so both extensions look and behave alike.
 */
export const WEBVIEW_STYLES = `
    :root {
      --ifc-surface: var(--vscode-editorWidget-background, #252526);
      --ifc-border: var(--vscode-editorWidget-border, #5a5a5a);
      --ifc-divider: var(--vscode-panel-border, #3c3c3c);
      --ifc-text: var(--vscode-foreground, #cccccc);
      --ifc-muted: var(--vscode-descriptionForeground, #9d9d9d);
      --ifc-control: var(--vscode-button-secondaryBackground, #3c3c3c);
      --ifc-control-text: var(--vscode-button-secondaryForeground, #cccccc);
      --ifc-control-hover: var(--vscode-button-secondaryHoverBackground, #4a4a4a);
      --ifc-row-hover: var(--vscode-list-hoverBackground, #2d2d30);
      --ifc-focus: var(--vscode-focusBorder, #0098ff);
      --ifc-warning: var(--vscode-editorWarning-foreground, #cca700);
      --ifc-error: var(--vscode-errorForeground, #f48771);
      --ifc-canvas: #1e1e1e;
      --ifc-highlight: #ffcc00;
    }

    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: var(--ifc-canvas); }
    #root { display: flex; flex-direction: column; width: 100%; height: 100%; }
    #root * { box-sizing: border-box; }

    .ifc-toolbar {
      display: flex; align-items: center; gap: 8px; padding: 4px 8px; flex: 0 0 auto;
      background: var(--ifc-surface); border-bottom: 1px solid var(--ifc-divider);
      font-family: var(--vscode-font-family, sans-serif); font-size: 12px; color: var(--ifc-text);
    }
    .ifc-toolbar > *:not(.ifc-banner) { flex: 0 0 auto; }

    .ifc-tool-button, .ifc-layer-action, .ifc-zoom-button {
      background: var(--ifc-control); color: var(--ifc-control-text);
      border: 1px solid var(--ifc-border); border-radius: 2px;
      cursor: pointer; font: inherit; white-space: nowrap;
    }
    .ifc-tool-button { padding: 3px 8px; font-size: 11px; }
    .ifc-tool-button:hover { background: var(--ifc-control-hover); }
    .ifc-tool-button.ifc-active {
      border-color: var(--ifc-focus); color: var(--vscode-button-foreground, #ffffff);
      background: var(--vscode-button-background, #0e639c);
    }
    .ifc-tool-button:focus-visible, .ifc-banner-dismiss:focus-visible,
    .ifc-elements-filter:focus-visible, .ifc-eye:focus-visible, .ifc-isolate:focus-visible {
      outline: 1px solid var(--ifc-focus); outline-offset: 1px;
    }

    .ifc-banner {
      display: flex; align-items: center; gap: 6px; min-width: 0; flex: 0 1 auto;
      color: var(--ifc-warning);
    }
    .ifc-banner[hidden] { display: none; }
    .ifc-banner-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ifc-banner-dismiss {
      flex: 0 0 auto; background: none; border: none; color: inherit;
      cursor: pointer; font-size: 14px; line-height: 1; padding: 0 2px;
    }

    /* Canvas and sidebar side by side; the sidebar takes room only while it holds something. */
    .ifc-workspace { flex: 1 1 auto; display: flex; min-height: 0; }
    .ifc-canvas { flex: 1 1 auto; min-width: 0; overflow: hidden; background: var(--ifc-canvas); position: relative; }
    .ifc-canvas canvas { outline: none; display: block; }
    .ifc-sidebar {
      flex: 0 0 auto; width: 300px; max-width: 50%; display: flex; flex-direction: column; min-height: 0;
      background: var(--ifc-surface); border-left: 1px solid var(--ifc-divider);
      font-family: var(--vscode-font-family, sans-serif); font-size: 12px; color: var(--ifc-text);
    }
    .ifc-sidebar[hidden] { display: none; }
    /* A split editor has no room beside the drawing: the sidebar goes under it. */
    @media (max-width: 720px) {
      .ifc-workspace { flex-direction: column; }
      .ifc-sidebar { width: auto; max-width: none; max-height: 55%; border-left: none; border-top: 1px solid var(--ifc-divider); }
    }

    /* Elements panel — docked in the sidebar, like the DWG previewer's Quantities panel. */
    .ifc-elements { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
    .ifc-elements-header {
      display: flex; align-items: center; gap: 6px; padding: 6px 8px;
      border-bottom: 1px solid var(--ifc-divider);
    }
    .ifc-elements-title { flex: 1 1 auto; font-weight: 600; }
    .ifc-elements-filter {
      width: 100%; box-sizing: border-box; margin: 0; padding: 3px 6px;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #5a5a5a);
      border-radius: 2px; font: inherit;
    }
    .ifc-elements-filter::placeholder { color: var(--ifc-muted); }
    .ifc-elements-body { flex: 1 1 auto; overflow-y: auto; padding: 2px 0; }
    .ifc-elements-row {
      display: flex; align-items: center; gap: 6px; padding: 3px 8px; min-height: 24px;
      border-left: 2px solid transparent;
    }
    .ifc-elements-row:hover { background: var(--ifc-row-hover); }
    .ifc-elements-row-active {
      background: var(--vscode-list-inactiveSelectionBackground, #37373d);
      border-left-color: var(--ifc-highlight);
    }
    .ifc-swatch { width: 10px; height: 10px; border-radius: 2px; flex: 0 0 auto; border: 1px solid #00000060; }
    .ifc-elements-name { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ifc-elements-name.ifc-hidden { opacity: 0.5; text-decoration: line-through; }
    .ifc-elements-count { flex: 0 0 auto; color: var(--ifc-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
    .ifc-eye, .ifc-isolate {
      flex: 0 0 auto; background: none; border: 1px solid transparent; border-radius: 2px;
      color: var(--ifc-muted); cursor: pointer; font: inherit; font-size: 11px;
      padding: 1px 5px; opacity: 0.5; transition: opacity 0.1s;
    }
    .ifc-elements-row:hover .ifc-eye, .ifc-elements-row:hover .ifc-isolate,
    .ifc-eye:focus-visible, .ifc-isolate:focus-visible { opacity: 1; }
    .ifc-eye.on { opacity: 1; color: var(--ifc-text); }
    .ifc-eye:hover, .ifc-isolate:hover { background: var(--ifc-control-hover); color: var(--ifc-text); border-color: var(--ifc-border); }
    .ifc-elements-nomatch { padding: 8px 4px; color: var(--ifc-muted); font-size: 11px; text-align: center; }

    /* Inspector — floats over the canvas, like the DWG previewer's inspector. */
    .ifc-inspector {
      position: absolute; top: 8px; right: 8px; z-index: 5; width: 280px;
      max-width: calc(100% - 16px); max-height: calc(100% - 16px); overflow-y: auto;
      background: var(--ifc-surface); border: 1px solid var(--ifc-border); border-radius: 3px;
      box-shadow: 0 4px 12px var(--vscode-widget-shadow, rgba(0, 0, 0, 0.5));
      color: var(--ifc-text); font-family: var(--vscode-font-family, sans-serif); font-size: 12px;
    }
    .ifc-inspector[hidden] { display: none; }
    .ifc-inspector-header {
      display: flex; align-items: center; gap: 6px; padding: 6px 8px;
      border-bottom: 1px solid var(--ifc-divider);
    }
    .ifc-inspector-title { flex: 1 1 auto; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ifc-inspector-close { background: none; border: none; color: var(--ifc-muted); cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; }
    .ifc-inspector-close:hover { color: var(--ifc-text); }
    .ifc-inspector-table { width: 100%; border-collapse: collapse; margin: 2px 0 6px; }
    .ifc-inspector-table td { padding: 2px 8px; vertical-align: top; word-break: break-word; }
    .ifc-inspector-label { color: var(--ifc-muted); width: 34%; white-space: nowrap; }

    .ifc-statusbar {
      display: flex; align-items: center; gap: 14px; flex: 0 0 auto;
      padding: 3px 10px; background: var(--ifc-surface);
      border-top: 1px solid var(--ifc-divider); color: var(--ifc-muted);
      font-family: var(--vscode-editor-font-family, monospace); font-size: 11px;
      white-space: nowrap; overflow: hidden;
    }
    .ifc-status-spacer { flex: 1 1 auto; }
    .ifc-status-hint { flex: 0 1 auto; min-width: 0; opacity: 0.75; overflow: hidden; text-overflow: ellipsis; }
    .ifc-status-selection { color: var(--ifc-highlight); }

    /* Loading state, over everything while the model is parsed. */
    .ifc-loading {
      position: absolute; inset: 0; z-index: 20;
      display: flex; align-items: center; justify-content: center; gap: 12px;
      color: var(--ifc-text); font-family: var(--vscode-font-family, sans-serif); font-size: 14px;
      background: var(--ifc-canvas);
    }
    .ifc-loading[hidden] { display: none; }
    .ifc-spinner {
      width: 24px; height: 24px; border: 3px solid var(--ifc-control);
      border-top-color: var(--vscode-progressBar-background, #0098ff); border-radius: 50%;
      animation: ifc-spin 0.8s linear infinite;
    }
    @keyframes ifc-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ifc-spinner { animation-duration: 3s; } }

    .ifc-error { color: var(--ifc-error); padding: 16px; font-family: var(--vscode-editor-font-family, monospace); white-space: pre-wrap; margin: 0; }

    /* Sits over the canvas when there is nothing to look at. */
    .ifc-empty {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 10px;
      padding: 24px; text-align: center; pointer-events: none;
      font-family: var(--vscode-font-family, sans-serif);
    }
    .ifc-empty[hidden] { display: none; }
    .ifc-empty-title { font-size: 15px; color: var(--ifc-text); }
    .ifc-empty-detail { font-size: 12px; color: var(--ifc-muted); max-width: 48ch; line-height: 1.6; }
`;
