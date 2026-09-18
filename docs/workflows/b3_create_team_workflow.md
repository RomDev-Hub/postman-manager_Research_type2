# WORKFLOW CHI TIẾT: B3 CREATE TEAM & ACTIVATE TRIAL (`b3_create_team.mjs`)

## 1. Mục Đích & Vai Trò
Kịch bản `b3_create_team.mjs` tự động khởi tạo một Đội nhóm/Tổ chức mới trên Postman (Postman Organization), lấy liên kết mời thành viên vạn năng (Multiuse Invite Link) và kích hoạt gói dùng thử **Enterprise Trial 7 Days**.

---

## 2. Các Tham Số Đầu Vào (Input Parameters)

| Tham Số | Vị Trí | Kiểu Dữ Liệu | Ví Dụ | Ý Nghĩa Chi Tiết |
| :--- | :--- | :--- | :--- | :--- |
| `email` | `process.argv[2]` | `string` | `"admin@domain.com"` | Email tài khoản đóng vai trò tạo Team (Chủ sở hữu) |
| `teamName` | `process.argv[3]` | `string` | `"Enterprise Dev"` | Tên hiển thị của Team |
| `teamDomain` | `process.argv[4]` | `string` | `"enterprise-dev"` | Subdomain định danh (enterprise-dev.postman.co) |
| `browserType` | `process.argv[5]` | `string` | `'chrome'` | Trình duyệt sử dụng (`'chrome'` hoặc `'edge'`) |
| `isHeadful` | `process.argv[6]` | `string` | `'headful'` | Mở cửa sổ trực quan hoặc chạy ẩn |

---

## 3. Sơ Đồ Quy Trình Hoạt Động (Activity Flowchart)

```mermaid
flowchart TD
    Start([Bắt đầu Create Team]) --> ReadArgs[Đọc: email, teamName, teamDomain, browser, headful]
    ReadArgs --> LaunchBrowser[Mở trình duyệt gắn Profile của Email Admin]
    LaunchBrowser --> NavSettings[Truy cập https://go.postman.co/settings/me/account<br/>để kích hoạt Cookie & Session]
    
    NavSettings --> CheckLogin{Đã có phiên đăng nhập hợp lệ?}
    CheckLogin -- Chưa --> WaitManual[Chờ đăng nhập bổ sung tối đa 60s]
    WaitManual -- Quá 60s --> AbortErr[Báo lỗi: Chưa đăng nhập, cần chạy B2 trước] --> CloseFail([Đóng trình duyệt & Thoát])
    
    CheckLogin -- Đã Đăng Nhập --> CallCreateAPI[Gọi API Postman nội bộ trong trình duyệt qua page.evaluate]
    
    subgraph API1 [Gọi API Tạo Team]
        PostGodProxy[POST /_api/ws/proxy<br/>service: 'god'<br/>path: '/api/organizations/add'<br/>body: { name, team_domain, preserve_personal_context: false }]
    end

    CallCreateAPI --> PostGodProxy
    PostGodProxy --> CheckCreateRes{Mã HTTP trả về = 200?}
    CheckCreateRes -- Không --> LogCreateFail[Báo lỗi tạo Team thất bại] --> CloseFail
    
    CheckCreateRes -- Có (Thành Công) --> ParseData[Trích xuất:<br/>- organization_id<br/>- multiuse_invitations.link<br/>- organization_domain]
    
    ParseData --> NavTeamDomain[Chuyển hướng đến https://{domain}.postman.co]
    
    subgraph API2 [Kích Hoạt Enterprise Trial 7 Ngày]
        PostTrialProxy[POST /_api/ws/proxy<br/>Header: x-entity-team-id = orgId<br/>service: 'trial'<br/>path: '/v1/api/start/trial/journey'<br/>body: { trialId: 'enterprise-7-days-trial' }]
    end

    NavTeamDomain --> PostTrialProxy
    PostTrialProxy --> CheckTrial{Mã HTTP = 200?}
    CheckTrial -- Có --> LogTrialSuccess[Báo kích hoạt Trial Enterprise thành công]
    CheckTrial -- Không --> LogTrialWarn[Báo kích hoạt Trial không thành công]
    
    LogTrialSuccess --> SaveFile[Ghi kết quả vào file invite_links.txt]
    LogTrialWarn --> SaveFile
    
    SaveFile --> Wait3s[Nếu headful: Chờ 3s quan sát]
    Wait3s --> CloseSuccess([Đóng trình duyệt & Kết thúc thành công])
```

---

## 4. Các Điểm Kỹ Thuật Quan Trọng

### 4.1. Kỹ Thuật Reverse Proxy Nội Bộ (`/_api/ws/proxy`)
- Thay vì sử dụng giao diện người dùng (bấm nút, điền form từng bước dễ bị đổi selector khi Postman cập nhật), script gọi trực tiếp cổng API Gateway nội bộ của Postman Web App.
- Việc gọi qua `page.evaluate()` bên trong trang đảm bảo toàn bộ Session Cookie, CSRF Token và Header bảo mật được trình duyệt tự động đính kèm một cách hoàn toàn tự nhiên.

### 4.2. Kích Hoạt Dùng Thử Enterprise 7 Ngày (Trial Journey)
- Microservice `trial` của Postman yêu cầu header định danh `x-entity-team-id` gắn liền với `organization_id` vừa tạo.
- Giúp mở khoá toàn bộ tính năng cao cấp của Postman (Unlimited Mock Servers, Monitor, Enterprise RBAC...) cho Team vừa khởi tạo.

### 4.3. Lưu Trữ Tự Động Kết Quả (`invite_links.txt`)
- Thông tin Team và liên kết mời vạn năng được ghi nối tiếp vào tệp `invite_links.txt` ở thư mục gốc để người dùng có thể sao chép hoặc đưa trực tiếp vào bước tiếp theo (B4 Join Team).
