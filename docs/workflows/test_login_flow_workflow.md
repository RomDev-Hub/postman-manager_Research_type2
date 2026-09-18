# WORKFLOW CHI TIẾT: TEST LOGIN FLOW ĐỘC LẬP (`test_login_flow.mjs`)

## 1. Mục Đích & Vai Trò
Kịch bản `test_login_flow.mjs` là một công cụ thử nghiệm (Testing / Prototyping Script) được thiết kế để chạy độc lập từ dòng lệnh mà không cần thông qua giao diện Web UI hoặc Server Express. 
Mục đích chính:
1. Thử nghiệm thuật toán điền form đăng nhập tự động trên một tài khoản mẫu cố định (`hunggreen0010@maildrop.cc`).
2. Chụp ảnh màn hình (`screenshot`) tại các thời điểm then chốt để phục vụ phân tích lỗi và gỡ lỗi giao diện (UI debugging).
3. Đánh giá độ tin cậy của việc tìm và nhấn nút "Join Team" / "Accept" bằng 2 phương pháp khác nhau.

---

## 2. Sơ Đồ Quy Trình Hoạt Động (Activity Flowchart)

```mermaid
flowchart TD
    Start([Bắt đầu test_login_flow]) --> InitConfig[Lấy cấu hình cho email cố định: hunggreen0010@maildrop.cc]
    InitConfig --> LaunchHeadful[Khởi chạy Chromium Headful = false để quan sát màn hình]
    LaunchHeadful --> NavAccount[Truy cập https://go.postman.co/settings/me/account]
    
    NavAccount --> Sleep5s[Chờ 5 giây quan sát URL ban đầu]
    Sleep5s --> CheckLogin{URL có chứa /login hoặc identity...?}
    
    CheckLogin -- Có --> FindUsername[Tìm selector #username trong 10s]
    subgraph LoginStep [Quy Trình Đăng Nhập Mẫu]
        FindUsername --> TypeUser[Gõ email vào #username]
        TypeUser --> FindPwd[Tìm selector #password trong 5s]
        FindPwd --> TypePwd[Gõ mật khẩu Pass@0909 vào #password]
        TypePwd --> Wait12s[DỪNG 12 GIÂY CHỐNG BOT]
        Wait12s --> ClickSignIn[Click #sign-in-btn & Chờ Navigation 15s]
    end
    
    FindUsername -- Không tìm thấy --> SnapErr[Chụp ảnh màn hình: scratch/error_login.png]
    
    CheckLogin -- Không (Đã đăng nhập) --> Sleep10s[Chờ 10 giây trang ổn định]
    ClickSignIn --> Sleep10s
    SnapErr --> Sleep10s
    
    Sleep10s --> SnapAfter[Chụp ảnh màn hình: scratch/after_login.png]
    
    subgraph JoinTest [Kiểm Tra Nút Join Team]
        SnapAfter --> TryCSSSelector[Cách 1: Tìm bằng selector button type=submit / contains Join Team]
        TryCSSSelector -- Tìm thấy --> ClickCSS[Click nút bằng Puppeteer ElementHandle]
        TryCSSSelector -- Không thấy --> TryEvaluate[Cách 2: Quét toàn bộ button trong DOM bằng page.evaluate]
        TryEvaluate --> ClickEval[Kiểm tra innerText chứa 'Join Team' hoặc 'Accept' rồi click]
    end

    ClickCSS --> Wait5s[Chờ 5 giây trước khi kết thúc]
    ClickEval --> Wait5s
    Wait5s --> CloseBrowser[Đóng trình duyệt] --> End([Hoàn tất thử nghiệm])
```

---

## 3. Các Điểm Kỹ Thuật Quan Trọng

### 3.1. Chẩn Đoán Lỗi Bằng Ảnh Màn Hình (Visual Snapshots)
- Lưu ảnh trực tiếp vào thư mục `scratch/`:
  - `scratch/error_login.png`: Được chụp nếu không tìm thấy ô nhập tài khoản (ví dụ bị vướng màn hình Captcha hoặc sập server).
  - `scratch/after_login.png`: Được chụp sau khi hoàn tất bước submit để kiểm tra xem đã vào được màn hình nào.

### 3.2. So Sánh 2 Kỹ Thuật Tương Tác DOM
1. **Puppeteer Handle (`page.$`)**:
   - Tốt khi selector cố định và phần tử là thẻ chuẩn.
   - Dễ gặp vấn đề nếu nút bị bọc trong Shadow DOM hoặc CSS module.
2. **Ngữ Cảnh Trình Duyệt (`page.evaluate`)**:
   - Dùng mã JavaScript thuần chạy trực tiếp trong trang web.
   - Duyệt qua `Array.from(document.querySelectorAll('button'))` và kiểm tra `.innerText`. Cách này có độ tương thích cao hơn rất nhiều khi giao diện Postman cập nhật.
