# Changelog

## 2.0.1 — Sửa lỗi & hiệu năng

- **Sửa: file `.rvt` có thể kẹt mãi ở "Converting…"** — yêu cầu model từ webview bị mất trong lúc đang chuyển đổi; lỗi "Revit quá cũ" cũng có thể không hiện
- Đóng tab giữa lúc chuyển `.rvt` → dừng worker ngay (trước đây vẫn chạy và giữ tới 4GB RAM)
- Chuyển tab không còn phải parse lại model (giữ webview khi ẩn)
- Truyền model vào webview dạng binary thay vì base64, ghép chunk một lần — ít RAM hơn với model lớn
- Dùng chung material theo màu thay vì mỗi mảnh hình học một material
- Dùng normal có sẵn của web-ifc: cạnh sắc hơn, parse nhanh hơn
- Smoke test đầu-cuối: `npm run smoke` (`.rvt` → IFC → viewer thật trong headless Chrome)

## 2.0.0 — Revit Viewer

- **Mở file `.rvt` trực tiếp** (không cần Revit): đọc bằng engine rvt-wasm (Apache-2.0, clean-room), chuyển sang IFC4 trong worker thread, hiển thị 3D như `.ifc`
  - Metadata mọi bản Revit 2016–2027; geometry đầy đủ cho Revit 2023–2025 (2026/2027 experimental)
  - Thanh tiến trình theo từng giai đoạn parse (schema, element-decode, saved-meshes...)
  - File cũ hơn 2023: báo hướng dẫn dùng Export IFC của Revit
- Đổi displayName thành "Revit Viewer" — đúng năng lực mới; identifier `revit-preview` giữ nguyên
- 1.x: mở `.ifc` như trước (double-click, chọn phần tử, panel Elements, wireframe/grid/fit)

## 1.0.0 — Bản phát hành đầu tiên

- Xem model 3D từ file IFC (export từ Revit) ngay trong VS Code: quay, zoom, pan
- Đăng ký là trình xem mặc định cho file `.ifc` (double-click mở thẳng viewer)
- Panel **Phần tử**: nhóm theo loại phần tử IFC (tường, sàn, cột, cửa...), ẩn/hiện từng nhóm, isolate, lọc theo tên
- Click chọn phần tử trên 3D → highlight vàng + inspector thuộc tính (GlobalId, tên, tag...)
- Toolbar: Fit khung nhìn, Wireframe, Grid
- Statusbar: tên dự án, số loại, số mesh, số tam giác
- Parse single-thread (ổn định trên mọi máy), file dữ liệu gửi qua webview dạng chunk
- CSP tương thích VS Code ≥ 1.104 (Chromium 134+)
