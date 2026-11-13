# RevidAPI Social – Cookie Sync

Tiện ích Chrome đồng bộ phiên đăng nhập **Facebook**, **TikTok** và **Zalo** về dashboard RevidAPI Social chạy trên máy bạn.

- Chỉ đọc cookie phiên (`c_user`, `xs` / `sessionid` / `zpsid`), không đọc mật khẩu.
- Chỉ gửi tới `http://127.0.0.1` hoặc `http://localhost`. Địa chỉ khác bị từ chối.
- Đồng bộ lại cùng một tài khoản sẽ cập nhật tài khoản cũ, không tạo bản trùng.

## Cài đặt

1. Tải mã nguồn: `git clone` repo này hoặc tải ZIP rồi giải nén.
2. Mở `chrome://extensions`, bật **Chế độ nhà phát triển**.
3. Bấm **Tải tiện ích đã giải nén** và chọn thư mục này.

## Sử dụng

1. Chạy dashboard RevidAPI Social (`npm start`, mặc định `http://127.0.0.1:8788`).
2. Đăng nhập Facebook, TikTok hoặc Zalo trên Chrome.
3. Mở tab của nền tảng đó, bấm biểu tượng tiện ích, chọn **Đồng bộ tài khoản này**.
   Hoặc bấm **Đồng bộ tất cả nền tảng** để lấy mọi nền tảng đang đăng nhập.

Đổi cổng dashboard trong **Cài đặt extension**.

## Quyền sử dụng

| Quyền | Để làm gì |
|---|---|
| `cookies` + quyền trên facebook.com, tiktok.com, zalo.me | Đọc cookie phiên đăng nhập |
| `tabs` | Biết tab hiện tại là nền tảng nào |
| `storage` | Lưu địa chỉ dashboard |
| `alarms` | Kiểm tra dashboard còn chạy mỗi 5 phút |
| `127.0.0.1`, `localhost` | Gửi cookie về dashboard trên máy bạn |
