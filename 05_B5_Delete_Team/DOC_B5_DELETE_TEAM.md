# B5: Xóa Team Postman (Leave & Delete)

## Mục đích
Quản lý việc xóa các team rác (hoặc team hết hạn dùng thử 7 ngày) trên Postman bằng quyền Admin. 
Theo cơ chế của Postman, để xóa 1 team, Admin cần:
1. Xóa tất cả các thành viên khác khỏi team.
2. Tự rời khỏi team (Leave Team). Lúc này Postman sẽ tự động gộp hành động rời team và xóa team lại với nhau (Leave and Delete Team).

## Script
- File: `b5_delete_team.mjs`
- Chức năng: 
  - Tự động vào trang Members, tìm và remove các user khác.
  - Sau khi chỉ còn lại Admin, tự động vào trang Account -> Teams.
  - Nhấn nút "Leave", chọn tùy chọn "Delete workspaces", điền tên team để xác nhận và nhấn "Leave and Delete Team".
- Hỗ trợ chạy ngầm (Headless) theo yêu cầu, tuy nhiên do API cuối cùng (Xác nhận xóa) submit đến `identity.getpostman.com` nên có khả năng vướng Cloudflare. Nếu chạy Headless bị kẹt, có thể dùng cờ `--headful` để hiện giao diện và cho qua Cloudflare.

## Cách sử dụng

**Chạy ngầm (Headless - Ẩn UI):**
```bash
node b5_delete_team.mjs <tên_profile>
# Ví dụ:
node b5_delete_team.mjs hunggreen0001@maildrop.cc
```

**Chạy hiển thị (Headful - Mở UI):**
Nếu Cloudflare block ở bước cuối, bạn chạy lệnh sau để mở UI lên:
```bash
node b5_delete_team.mjs <tên_profile> --headful
```

## Lưu ý quan trọng
1. Để xóa team thành công, profile chạy lệnh PHẢI LÀ ADMIN của team đó.
2. Quá trình thao tác xóa sẽ diễn ra tuần tự, mất khoảng 20-30s. Bạn có thể kiểm tra ảnh chụp màn hình sau khi hoàn tất trong thư mục `05_B5_Delete_Team/<tên_profile>_deleted.png`.
3. Sau khi bị xóa team (cũng là team mặc định duy nhất), Postman có thể tự động Log out tài khoản, bạn cần đăng nhập lại nếu muốn tiếp tục sử dụng acc đó.
