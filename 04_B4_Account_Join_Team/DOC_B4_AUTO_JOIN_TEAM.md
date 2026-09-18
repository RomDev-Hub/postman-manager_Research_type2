# B4: Account Join Team (Tài khoản phụ tham gia Team)

Bước này chịu trách nhiệm sử dụng các tài khoản phụ đã được tạo/login ở B1 để tự động tham gia vào các Team đã được tạo ở B3, thông qua link mời (Invite Link).

## Quy trình tự động

Tool `b4_join_team.mjs` sẽ thực hiện các bước sau cho mỗi tài khoản và mỗi link mời:
1. **Đọc Invite Links**: Đọc danh sách các link mời được xuất ra ở B3 (`invite_links.txt`).
2. **Khởi chạy Chrome với Profile đã lưu**: Copy profile của tài khoản tương ứng từ B1 (để giữ trạng thái đăng nhập) và khởi chạy Chrome ở chế độ hiển thị (headful) bằng CDP.
3. **Mở Invite Link**: Truy cập vào link mời.
4. **Vượt qua màn hình chọn tài khoản (Account Chooser)**: Nếu Postman hiển thị màn hình chọn tài khoản (URL có chứa `authFlowId`), tool sẽ tự động tìm và click vào đúng tài khoản đang xét.
5. **Xử lý các tình huống có thể xảy ra**:
   - **Cloudflare Turnstile**: Do Postman có cơ chế chống bot mạnh, nếu gặp trang Cloudflare Turnstile, Chrome sẽ hiển thị cho người dùng tự click xác thực (vì script chạy headful).
   - **Verify Email**: Nếu tài khoản phụ gặp phải màn hình yêu cầu xác minh email, tool sẽ ghi nhận lỗi `verify_email_required` và bỏ qua tài khoản này.
   - **In Review**: Nếu domain của tài khoản phụ không khớp với cấu hình của Team, Postman sẽ báo "Your request to join this team is in review". Tool ghi nhận là thành công (Join thành công nhưng chờ duyệt).
   - **Joined**: Nếu link chuyển trực tiếp vào màn hình Workspace / Team Home, tool ghi nhận là thành công hoàn toàn.
   - **Các Popup (Keep Separate / Join)**: Tự động nhấn "Keep Separate", "Join", hoặc "Accept" nếu có popup hiện lên.
   - **Popup lỗi Profile của trình duyệt (Profile Error Occurred)**: Tool đã được cấu hình cờ `--no-errdialogs` và `--hide-crash-restore-bubble` để chặn hoàn toàn các popup báo lỗi hệ thống/Web Data của Chrome, giúp tiến trình không bị treo.

## Cách sử dụng

1. Đảm bảo bạn đã có file `03_B3_Team_And_Trial_API/invite_links.txt` chứa danh sách các link mời (Link: https://...).
2. Đảm bảo đã có các thư mục Chrome Profiles trong `01_B1.1_B1.2_Chrome_Profiles_And_Login/chrome_profiles/`.
3. Chạy lệnh:
   ```bash
   cd 04_B4_Account_Join_Team
   npm install
   node b4_join_team.mjs
   ```

## Các file chính
- `b4_join_team.mjs`: Script chính điều khiển quá trình join team bằng CDP.
- `package.json`: Cấu hình cho thư mục B4.

## Lưu ý về bảo mật (Cloudflare / Turnstile)
Postman sử dụng Cloudflare Turnstile rất nghiêm ngặt đối với các luồng join team (đặc biệt là link `/web-invite-accept`).
Hiện tại Tool chạy Chrome headful để bạn có thể nhìn thấy cửa sổ trình duyệt. Nếu cửa sổ bị kẹt ở vòng xoay Cloudflare, bạn hãy di chuột/click bằng tay để vượt qua vòng xoay. Sau khi vượt qua, tool sẽ tự động chạy tiếp.
