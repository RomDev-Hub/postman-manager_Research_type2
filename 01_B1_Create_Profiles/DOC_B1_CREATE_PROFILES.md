# B1: Profile Management & Initialization (Tạo Profiles)

Bước này giải thích cách hoạt động của việc khởi tạo và quản lý Chrome Profile. Trên thực tế, **bước B1 và B2 được gộp chung trong 1 tool duy nhất** (`chrome_batch_launcher.py` nằm ở thư mục `02_B2_Batch_Login`). Tuy nhiên, về mặt khái niệm, nó được chia làm 2 giai đoạn:

## Giai đoạn 1 (B1): Tạo Profile và Pre-populate Data
Khi bạn chạy `chrome_batch_launcher.py`, nó sẽ:
1. Tạo một thư mục `ChromeProfiles/<email>` cho mỗi tài khoản.
2. Thiết lập cơ sở dữ liệu Login Data của Chrome (`Login Data` SQLite) và ghi sẵn Username/Password vào đó để trình duyệt có thể Autofill.
3. Thiết lập Preferences (`Preferences` JSON) để tắt các cảnh báo mật khẩu, cho phép lưu mật khẩu tự động và chặn các popup hỏi "Lưu mật khẩu" hay "First Run".

## Tại sao lại tách B1 và B2 trong tên gọi?
Để dễ dàng quản lý quy trình:
- **B1**: Tập trung vào việc chuẩn bị môi trường và chuẩn bị Local Storage, Cookies, và Password DB. Sử dụng script `b1_create_profiles.py` để tạo trực tiếp các profile và chèn Username/Password sẵn vào cơ sở dữ liệu SQLite (`Login Data`) của trình duyệt (giống cách làm ở `_postman_edge_manager`), giúp Chrome tự động điền mật khẩu ngay khi mở.
- **B2**: Là hành động mở hàng loạt (Batch Open) các trình duyệt đã được khởi tạo để bạn thực hiện thao tác lấy Cookies hoặc test hàng loạt.

## Công cụ thực hiện
Mọi thao tác thực tế sẽ được thực hiện thông qua tool **Batch Login** ở bước B2 (`02_B2_Batch_Login`). Mời bạn chuyển sang đọc tài liệu `DOC_B2_BATCH_LOGIN.md` để tiến hành thao tác.
