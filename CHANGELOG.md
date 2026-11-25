# Changelog

## 1.0.0 — Bản phát hành đầu tiên

- Xem model 3D từ file IFC (export từ Revit) ngay trong VS Code: quay, zoom, pan
- Đăng ký là trình xem mặc định cho file `.ifc` (double-click mở thẳng viewer)
- Panel **Phần tử**: nhóm theo loại phần tử IFC (tường, sàn, cột, cửa...), ẩn/hiện từng nhóm, isolate, lọc theo tên
- Click chọn phần tử trên 3D → highlight vàng + inspector thuộc tính (GlobalId, tên, tag...)
- Toolbar: Fit khung nhìn, Wireframe, Grid
- Statusbar: tên dự án, số loại, số mesh, số tam giác
- Parse single-thread (ổn định trên mọi máy), file dữ liệu gửi qua webview dạng chunk
- CSP tương thích VS Code ≥ 1.104 (Chromium 134+)
