# Tài liệu Phân tích Kỹ thuật (Reverse-Engineering) Bước 3: Tạo Team & Kích hoạt Enterprise Trial

Tài liệu này ghi chép lại quá trình phân tích (sniffing) và giả lập luồng giao tiếp API của Postman để thực hiện tạo Team mới và kích hoạt gói Enterprise Trial hoàn toàn tự động ngầm (headless API), không cần thao tác trình duyệt.

## 1. Vấn đề của phương pháp tự động click (Puppeteer/Selenium)
Ban đầu, quy trình tạo team và kích hoạt trial dựa vào việc mở trình duyệt, điều hướng đến `/billing/add-team` và click các nút UI.
- **Hạn chế:** Hệ thống bảo mật Cloudflare Turnstile của Postman thường xuyên chặn các tương tác tự động. Thêm vào đó, việc xử lý DOM thay đổi theo thời gian gây thiếu ổn định.
- **Giải pháp:** Bỏ qua UI và gửi trực tiếp HTTP Request đến API nội bộ của Postman.

## 2. Kỹ thuật Trích xuất & Bypass Lỗi Cookie
Khi gọi API của Postman, nếu ta gửi toàn bộ Cookie hiện có của profile trình duyệt, máy chủ NGINX/Postman sẽ báo lỗi `431 Request Header Or Cookie Too Large`.

**Khắc phục:**
Thay vì nạp toàn bộ `Cookies`, ta chỉ trích lọc (filter) các Session Cookies cốt lõi để chứng thực:
```python
allowed_cookies = [
    "postman.sid",     # Session ID chính
    "_pm.store",       # Chứa metadata user (đã mã hóa URL)
    "postman.sst",     # Security token
    "postman.ssid",    # Session ID phụ
    "getpostman-user"  # Chứa trực tiếp thông tin ID user
]
```

## 3. Reverse-Engineering API: Tạo Team
Khi một user thao tác tạo team trên web, web client sẽ gửi yêu cầu qua một proxy endpoint.

- **Endpoint:** `POST https://god.postman.co/_api/ws/proxy` (Hoặc có thể gọi trực tiếp `god.postman.co/api/organizations/add`)
- **Headers bắt buộc:** `Content-Type: application/json` và các cookies ở phần 2.
- **Payload:**
```json
{
  "path": "/api/organizations/add",
  "method": "POST",
  "service": "god",
  "body": {
    "name": "Tên_Team",
    "preserve_personal_context": false
  }
}
```
- **Kết quả trả về:** Trả về HTTP 200 OK kèm theo `organization_id` và một mảng `multiuse_invitations`. Link trong mảng này chính là Invite Link vĩnh viễn (có thể chứa 100,000 slots).

## 4. Reverse-Engineering API: Kích hoạt Enterprise Trial
Phân tích lịch sử payload và mã nguồn cũ cho thấy gói Enterprise Trial 7 ngày sử dụng mã (plan code) là `client_enterprise_7_days_trial`.

Để kích hoạt gói này cho Team vừa tạo:
- **Cần có:** `organization_id` (trích xuất từ bước 3)
- **Endpoint:** `POST https://god.postman.co/api/accounts/{organization_id}/limited-duration-trial`
- **Payload:**
```json
{
  "tier": "enterprise_202603",
  "trial_type": "client_enterprise_7_days_trial"
}
```

## 5. Cấu trúc Tool Tự động B3
Dựa trên phân tích trên, Tool B3 được xây dựng với các chức năng:
1. **Đọc SQLite Cookie** của profile (Ví dụ: `hunggreen0001`).
2. **Giải mã AES-128-CBC** (mật khẩu `peanuts`, salt `saltysalt`).
3. **Lọc Cookies** để tránh lỗi 431.
4. **Gọi API Tạo Team**, lấy `organization_id` và Public Invite Link.
5. **Gọi API Trial** bằng `organization_id` vừa nhận để kích hoạt Enterprise.
6. **Lưu output** ra file để phục vụ Bước 4 (Tài khoản phụ join link).

---
*Bản ghi chép này đảm bảo khả năng tái tạo (reproducibility) và bảo trì (maintenance) công cụ nếu Postman có thay đổi cơ chế API trong tương lai.*

## Cập Nhật Mới (Trial API) - Không Cần Trình Duyệt!
Sau quá trình dùng Puppeteer để sniff (lắng nghe) sự kiện khi bấm nút Upgrade trên giao diện, phát hiện ra Postman đã thay đổi luồng API kích hoạt trial. 
- Thay vì gọi API `billing` như trước, hiện tại Postman gọi API thuộc service `trial` thông qua cổng proxy của sub-domain team.
- **Endpoint:** `POST https://{team_domain}.postman.co/_api/ws/proxy`
- **Payload:**
```json
{
    "service": "trial",
    "method": "POST",
    "path": "/v1/api/start/trial/journey",
    "body": {
        "trialId": "enterprise-7-days-trial"
    }
}
```
**Kết quả:** 
Bằng cách truyền đúng `x-entity-team-id` (chính là Org ID) và payload như trên, ta đã có thể kích hoạt thành công gói **Enterprise Trial 7 days** bằng code Python thuần túy mà không cần phải mở Puppeteer/Headless Browser lên. Điều này giúp hệ thống chạy ngầm cực kỳ nhanh và không tốn RAM.
