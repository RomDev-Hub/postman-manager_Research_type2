# Postman Automation Master Tool (Web UI)

Bản kế hoạch này phát thảo cấu trúc và quy trình tổng hợp một hệ thống duy nhất (All-in-One) với giao diện Web (Web UI) để quản lý toàn bộ các bước tự động hóa Postman, từ việc tạo tài khoản, quản lý profile, tạo team, join team đến dọn dẹp team rác.

> [!IMPORTANT]
> **Vấn đề Profile & Browser:** 
> Do tính năng bảo mật của Google Chrome/Edge (chống lại Puppeteer và Remote Debugging trên thư mục gốc của trình duyệt `~/.config/...`), chúng ta **không thể** mở Profile mặc định của OS bằng Puppeteer nếu không có thiết lập phức tạp. 
> Do đó, công cụ mới sẽ quản lý một thư mục gốc riêng biệt, nhưng được đặt đúng chuẩn của hệ điều hành (VD: `~/.local/share/PostmanProfiles` trên Linux hoặc `AppData/Local/PostmanProfiles` trên Windows). Người dùng có thể chọn dùng Chrome hoặc Edge tùy ý qua UI.

## Kiến Trúc Hệ Thống (Architecture)

- **Backend:** Node.js + Express.
- **Frontend:** HTML/CSS/JS thuần hoặc React (tùy vào độ phức tạp, đề xuất dùng HTML/JS thuần kết hợp Bootstrap/Tailwind để nhẹ và dễ debug).
- **Automation Core:** Puppeteer + các kịch bản `.mjs` đã nghiên cứu.
- **Real-time Logs:** Sử dụng Server-Sent Events (SSE) hoặc Socket.io để stream log (stdout/stderr) từ Puppeteer trực tiếp lên Web UI.
- **Storage:** Lưu cấu hình, danh sách tài khoản, và trạng thái trong file JSON (VD: `database.json`).

## Giao Diện & Tính Năng Từng Bước (Steps)

Giao diện sẽ gồm một thanh điều hướng (Sidebar) với các bước sau:

### Dashboard (Settings & Dashboard)
- Cấu hình thư mục lưu trữ Profile.
- Cấu hình trình duyệt mặc định sử dụng (Google Chrome, Microsoft Edge, Chromium).
- **Concurrency Setting (Số luồng chạy song song)**: Ô nhập số lượng cửa sổ trình duyệt được phép mở cùng lúc (mặc định là 6). Tự động lưu thiết lập khi thay đổi.
- Hiển thị tổng quan: Số lượng Profile, Số lượng Team hiện có, Trạng thái login của các Profile.

### B1: Auto Create Accounts (Researching)
- Form nhập tiền tố email (vd: `hunggreen`).
- Form nhập mật khẩu mặc định (vd: `Pass@0909`).
- Cấu hình số lượng muốn tạo.
- *Log realtime:* Hiển thị quá trình vào trang đăng ký, sinh email ảo (maildrop), nhận mã OTP (nếu có), và đăng ký tài khoản Postman.

### B2: Profile Manager & Batch Auto Login
- Danh sách các tài khoản đang có trong `database.json`.
- Hiển thị danh sách các Profile đã mất session hoặc cần đăng nhập mới.
- Nút **"Tạo Profile & Batch Login"**: Mở trình duyệt (Chrome/Edge) và tự động điền email + pass cho hàng loạt tài khoản.
- Số lượng cửa sổ mở cùng lúc sẽ dựa trên thiết lập Concurrency mặc định (6 luồng). Sau khi xong sẽ lưu trạng thái `Logged In`.

### B3: Team Management & Trial Upgrade
- Form nhập: Account Admin, Tên Team, Team Domain (vd: `vinfast-001`).
- Nút **"Create Team & Upgrade Trial"**: Chạy kịch bản tạo team và bật Trial. 
- *Output:* Trả về Invite Link hiển thị ngay trên UI và lưu vào database.

### B4: Join Teams
- Form nhập: Invite Link.
- Chọn danh sách các Account (Member) muốn tham gia vào Team.
- Nút **"Start Joining"**: Tự động mở lần lượt các Profile của Member (theo số luồng cấu hình), truy cập link mời và click "Join Team".

### B5: [Reserved / Trống]
- Bước này được để trống để dự trữ cho các tính năng nghiên cứu và mở rộng sau này.

### B6: Team Cleanup (Delete & Trash Management)
- Tính năng 1: **Targeted Delete**: Nhập `Team Domain` và `Admin Account` -> Xóa chính xác team đó (tự động kick member nếu có).
- Tính năng 2: **Clean Trash Teams**: Chọn `Admin Account` -> Quét toàn bộ API, liệt kê các team đang làm Admin, cho phép người dùng tick chọn các team rác để tự động dọn dẹp.

## Hệ Thống Ghi Nhật Ký (Structured File Logging)
Tất cả các hành động, lỗi, và tương tác API sẽ được ghi lại chi tiết vào file log để phục vụ debug chuyên sâu khi Postman thay đổi UI/API:
- Format log chuẩn bao gồm các thẻ: `[Input]`, `[Output]`, `[Process]`, `[Err]`, `[Bug]`, `[Warn]`.
- Ghi log toàn bộ payload API: Lệnh được gọi (curl, POST, GET), data gửi đi, và kết quả JSON trả về.
- Log được lưu ra file cứng (vd: `logs/app-YYYY-MM-DD.log`) và stream trực tiếp lên Web UI.

## Kế hoạch Cải Tiến Khắc Phục Lỗi
1. **Dynamic Browser Executable:** Hàm `getBrowserConfig()` sẽ tự detect HĐH (Windows, Mac, Linux) để trỏ đúng đường dẫn `chrome.exe` hoặc `msedge.exe`.
2. **Profile Path Alignment:** Tạo Profile ở thư mục chuẩn của OS thay vì `/home/dev/ChromeProfiles` (ví dụ `C:\Users\...\AppData\Local\PostmanAutomator`).
3. **Headful UI Bypass:** Các lỗi không cho xác thực sẽ được log trực tiếp ra Web UI, trình duyệt luôn mở ở chế độ Headful (`headless: false`) để người dùng có thể can thiệp nếu Google/Postman yêu cầu Captcha.

---

## Ý Kiến Của Người Dùng (User Review Required)

> [!WARNING]
> Việc tạo UI Web sẽ cần tạo mới một project Node.js hoàn chỉnh (Express, Frontend HTML/CSS). 
> Bạn có đồng ý với thiết kế kiến trúc và các chức năng của từng Bước (B0 - B5) như trên chưa? 
> Nếu bạn đồng ý, hãy bấm Proceed để tôi bắt đầu triển khai code khung cho Web UI và sửa lại Core logic của các kịch bản MJS cho tương thích nhé!
