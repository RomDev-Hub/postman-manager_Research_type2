# B2: Đăng nhập Hàng loạt (Batch Login) và Xử lý Trình duyệt

Tài liệu này giải thích quy trình tự động hóa thao tác đăng nhập cho nhiều tài khoản cùng lúc mà không gây ảnh hưởng đến hiệu năng của hệ thống. File thực thi chính của bước này là `chrome_batch_launcher.py`.

## 1. Kỹ thuật Batching (Chạy theo đợt)

Do vấn đề giới hạn phần cứng (RAM/CPU), nếu mở toàn bộ (ví dụ 100) profile cùng một lúc, hệ thống sẽ bị đứng hoặc Crash. Vì vậy, ta dùng phương pháp **chạy theo đợt**:
- Hệ thống sẽ chia danh sách các tài khoản ra thành từng nhóm nhỏ, giới hạn **tối đa 6 tài khoản mở cùng lúc**.
- Script sẽ tự động bật 6 cửa sổ Chrome lên (tương ứng với 6 profile độc lập).
- Chỉ sau khi nhóm hiện tại hoàn tất việc login (và đóng trình duyệt an toàn), nhóm 6 tài khoản tiếp theo mới được kích hoạt.

## 2. Tối ưu hóa các Tham số khởi chạy (Chrome Flags)

Để đảm bảo Chrome được khởi động nhẹ nhất có thể, tránh các popup hay cảnh báo làm gián đoạn tự động hóa, script áp dụng các tham số khởi chạy (Command-line flags) sau:
- `--no-first-run`: Bỏ qua màn hình giới thiệu (Welcome Screen) của Chrome trong lần đầu tạo profile.
- `--no-default-browser-check`: Tắt thông báo hỏi đặt Chrome làm trình duyệt mặc định.
- `--disable-infobars`: Ẩn đi thanh cảnh báo màu vàng khó chịu ("Chrome is being controlled by automated test software").
- `--disable-dev-shm-usage` & `--no-sandbox`: Giúp tối ưu việc chia sẻ bộ nhớ, đặc biệt quan trọng trên môi trường Linux để không bị Crash khi mở nhiều trình duyệt.

## 3. Cơ chế Đóng Trình duyệt An toàn (Graceful Shutdown)

**Vấn đề lớn:** Nếu đóng trình duyệt bằng cách tắt đột ngột (`kill -9`), trong lần khởi chạy tiếp theo, Chrome sẽ báo lỗi tắt không an toàn và hiện lên popup **"Restore Pages?"** (Khôi phục các trang?). Popup này sẽ làm kẹt các script tự động hóa phía sau.

**Giải pháp:**
- Khi bạn đã login xong 1 nhóm 6 tài khoản và muốn chuyển sang nhóm tiếp theo, script sẽ **không** ngắt tiến trình đột ngột.
- Thay vào đó, nó gửi một tín hiệu **SIGTERM (Terminate)** tới tiến trình Chrome.
- Đây là lệnh thoát theo đúng chuẩn hệ điều hành, cho phép Chrome tự động lưu lại trạng thái tab, ghi phiên làm việc và đóng các tiến trình con một cách an toàn. Nhờ vậy, lỗi "Restore Pages" sẽ hoàn toàn biến mất ở lần chạy sau.

## 4. Tóm tắt

- File thực thi: `02_B2_Batch_Login/chrome_batch_launcher.py`
- Đầu vào: Mật khẩu mặc định và thư mục lưu Chrome Profile.
- Đầu ra: Tất cả các profile đã được đăng nhập an toàn, cookie và dữ liệu local storage được ghi đầy đủ vào thư mục Profile, sẵn sàng cho các bước tiếp theo.
