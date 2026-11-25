# Revit Preview (VS Code Extension)

Xem trước model Revit ngay trong VS Code — hiển thị 3D + thống kê phần tử.

> ⚠️ File `.rvt` là format đóng của Autodesk, không có thư viện nào đọc trực tiếp.
> Extension này xem **file `.ifc`** — export từ Revit bằng bước chuẩn hóa bên dưới.

## Luồng hoạt động

```
Revit (.rvt) --Export IFC--> file .ifc --extension--> 3D + thống kê trong VS Code
```

## Export IFC từ Revit (chỉ cần làm 1 lần cho mỗi model)

1. Mở file `.rvt` trong Revit.
2. **File → Export → IFC** (hoặc gõ lệnh `IFC` trên ribbon).
3. Chọn Setup IFC: đặt **MVD = "IFC 4 Design Transfer View"** (giữ nhiều geometry nhất) hoặc "IFC 2x3 Coordination View 2.0" (file nhỏ hơn).
4. Export ra file `.ifc` và mở nó trong VS Code bằng extension này.

## Phát triển

```bash
npm install     # cài dependencies
npm run compile # build dist/extension.js + media/webview.js (+ copy wasm)
npm run watch   # build tự động khi sửa code
```

Debug: nhấn **F5** trong VS Code → cửa sổ Extension Development Host mở lên → mở file `.ifc` → chuột phải → *Open With...* → **Revit Preview (IFC)**.

Đóng gói thành `.vsix` để cài hoặc publish:

```bash
npx vsce package   # tạo revit-preview-0.1.0.vsix
code --install-extension revit-preview-0.1.0.vsix
```

## Cấu trúc

```
src/extension.ts          Entry point: đăng ký custom editor cho *.ifc
src/ifcEditorProvider.ts  CustomReadonlyEditorProvider + HTML/CSS webview
webview/main.ts           three.js + web-ifc: parse IFC, dựng scene, thống kê
esbuild.js                Bundle 2 entry (extension CJS, webview IIFE) + copy wasm
media/web-ifc.wasm        WASM engine của web-ifc (copy từ node_modules khi build)
```

## Kiến trúc truyền dữ liệu

- File IFC có thể lớn (vài chục MB) → extension host gửi bytes qua webview
  dạng **base64 chia chunk ~3 MB** mỗi message (`requestModel` → `modelMeta` → `modelChunk`… → `modelDone`).
- Webview fetch `web-ifc.wasm` từ `media/` (đã cho phép trong CSP `connect-src`).
- `OpenModel` với `COORDINATE_TO_ORIGIN: true` để model luôn nằm quanh gốc tọa độ.

## Hạn chế hiện tại (lộ trình)

- [ ] Chưa chọn/làm nổi phần tử khi click (picking) — có thể thêm qua `expressID` của mesh
- [ ] Chưa hiển thị property của từng phần tử (`GetLine`, pset)
- [ ] Chưa hỗ trợ `.glTF` (chỉ IFC)
- [ ] File rất lớn (>200 MB) nên cân nhắc đổi sang chuyển file tạm hoặc `SharedArrayBuffer`
