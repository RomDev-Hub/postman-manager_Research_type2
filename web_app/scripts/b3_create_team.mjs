/**
 * =========================================================================================
 * FILE: b3_create_team.mjs
 * MỤC ĐÍCH:
 *   Kịch bản Tự Động Tạo Tổ Chức/Đội Nhóm Postman (Create Team), Lấy Link Mời và Kích Hoạt Trial:
 *     1. Mở trình duyệt với Profile của tài khoản Admin chỉ định.
 *     2. Điều hướng tới Postman để tải các Cookie và Session chứng thực của phiên đăng nhập.
 *     3. Gọi trực tiếp API nội bộ của Postman (`/_api/ws/proxy` - service: 'god') thông qua ngữ cảnh
 *        trình duyệt (`page.evaluate`) để tạo Organization/Team mà không cần bấm tay trên giao diện.
 *     4. Trích xuất mã ID tổ chức (`organization_id`), tên miền đội nhóm (`organization_domain`),
 *        và liên kết mời vạn năng (`multiuse_invitations.link`).
 *     5. Tiếp tục gọi API nội bộ (`service: 'trial'`) để kích hoạt gói dùng thử "Enterprise Trial 7 Days".
 *     6. Ghi kết quả link mời vào file `invite_links.txt` để phục vụ cho bước tiếp theo (B4 Join Team).
 * =========================================================================================
 */

import puppeteer from 'puppeteer-core'; // Thư viện Puppeteer điều khiển trình duyệt
import { getBrowserConfig } from '../../browser_config.mjs'; // Hàm lấy cấu hình đường dẫn Chrome và Profile
import path from 'path'; // Thư viện xử lý đường dẫn file hệ thống
import fs from 'fs';     // Thư viện đọc/ghi file hệ thống Node.js

/**
 * Hàm log: Gửi thông điệp về Web Server qua IPC hoặc in ra Terminal nếu chạy độc lập.
 * 
 * @param {string} tag - Thẻ phân loại log ('Process' | 'Warn' | 'Err' | 'Output')
 * @param {string} message - Nội dung thông báo
 * @param {any} [data=null] - Dữ liệu chi tiết đính kèm
 */
const log = (tag, message, data = null) => {
    if (process.send) {
        process.send({ type: 'log', tag, message, data });
    } else {
        console.log(`[${tag}] ${message}`, data ? data : '');
    }
};

/**
 * ĐỌC VÀ KIỂM TRA THAM SỐ DÒNG LỆNH (CLI Arguments):
 * Cú pháp gọi: node b3_create_team.mjs <email> <team_name> <team_domain> [browser] [headful|headless]
 */
const args = process.argv.slice(2);

if (args.length < 3) {
    log('Err', "Sai cú pháp! Cách dùng: node b3_create_team.mjs <email> <team_name> <team_domain> [browser] [headful|headless]");
    process.exit(1);
}

// args[0]: Email của tài khoản đóng vai trò tạo Team (Chủ sở hữu / Owner)
const email = args[0];

// args[1]: Tên hiển thị của Team cần tạo (VD: "TechCorp DevOps")
const teamName = args[1];

// args[2]: Tên miền định danh của Team (VD: "techcorp-devops" => URL: techcorp-devops.postman.co)
const teamDomain = args[2];

// args[3]: Loại trình duyệt ('chrome' hoặc 'edge', mặc định là 'chrome')
const browserType = args[3] || 'chrome';

// args[4]: Chế độ hiển thị cửa sổ. Bật 'headful' nếu muốn theo dõi trực tiếp giao diện
const isHeadful = args[4] === 'headful';

// Lấy đường dẫn file thực thi Chrome và thư mục dữ liệu cá nhân của tài khoản Admin này
const { executablePath, userDataDir: profilePath } = getBrowserConfig(browserType, email);

// Hàm chính (IIFE - Immediately Invoked Function Expression)
(async () => {
    log('Process', `Bắt đầu quy trình tạo Team "${teamName}" (Domain: ${teamDomain}) cho tài khoản: ${email}`);
    
    // KHỞI ĐỘNG TRÌNH DUYỆT PUPPETEER:
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        userDataDir: profilePath,
        headless: !isHeadful ? "new" : false,
        ignoreDefaultArgs: ['--enable-automation'], // Ẩn cờ báo bot
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1024,768',
            '--no-errdialogs',
            '--hide-crash-restore-bubble',
            '--disable-blink-features=AutomationControlled' // Bypass rào cản Cloudflare
        ],
        defaultViewport: null
    });

    try {
        const page = await browser.newPage();
        
        log('Process', "Đang điều hướng đến Postman để nạp cookie và phiên xác thực...");
        // Mở trang Settings Account để kích hoạt toàn bộ cookie phiên đăng nhập vào trình duyệt
        await page.goto('https://go.postman.co/settings/me/account', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        
        // KIỂM TRA PHIÊN ĐĂNG NHẬP:
        // Nếu bị chuyển hướng về trang đăng nhập, cảnh báo người dùng cần hoàn thành bước B2 trước
        if (page.url().includes('/login') || page.url().includes('identity.getpostman.com')) {
            log('Warn', "Phát hiện tài khoản chưa đăng nhập hoặc hết phiên! Đang chờ đăng nhập tự động/thủ công (tối đa 60s)...");
            try {
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch (e) {
                log('Err', "Quá thời gian chờ đăng nhập. Vui lòng chạy bước B2 Login trước cho tài khoản này!");
                await browser.close();
                process.exit(1);
            }
        }
        
        log('Process', "Cookie đã sẵn sàng. Bắt đầu gọi API nội bộ của Postman để tạo Team...");
        
        /**
         * GỌI API NỘI BỘ POSTMAN THÔNG QUA page.evaluate():
         * 
         * Tại sao phải gọi bằng page.evaluate() trong trình duyệt thay vì dùng axios/node-fetch?
         *   - Trình duyệt đã lưu trữ đầy đủ Session Cookie, CSRF Token, và Header xác thực của Postman.
         *   - Gọi fetch() bên trong trang sẽ tự động đính kèm cookie và vượt qua toàn bộ cơ chế bảo mật CORS/Cloudflare!
         * 
         * Cấu trúc Endpoint Postman:
         *   - URL: `/_api/ws/proxy` (Reverse proxy nội bộ của Postman Web App)
         *   - Dịch vụ (`service`): "god" (Microservice quản lý phân quyền và tổ chức)
         *   - Phương thức (`method`): "POST"
         *   - Đường dẫn (`path`): "/api/organizations/add"
         *   - Tham số: `name` (tên team), `team_domain` (subdomain), `preserve_personal_context: false`
         */
        const createRes = await page.evaluate(async (name, domain) => {
            const resp = await fetch('/_api/ws/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: "god",
                    method: "POST",
                    path: "/api/organizations/add",
                    body: {
                        name: name,
                        team_domain: domain,
                        preserve_personal_context: false
                    }
                })
            });
            return {
                status: resp.status,
                body: await resp.json().catch(() => null)
            };
        }, teamName, teamDomain);
        
        // Kiểm tra phản hồi từ máy chủ Postman
        if (createRes.status !== 200 || !createRes.body) {
            log('Err', "Tạo Team thất bại! Phản hồi máy chủ:", createRes.body || 'Không có nội dung trả về');
            await browser.close();
            process.exit(1);
        }
        
        // Trích xuất Organization ID được tạo mới
        const orgId = createRes.body.organization_id;
        
        // Trích xuất Multiuse Invitation Link (Link mời vạn năng không giới hạn số người dùng một lần)
        let inviteLink = null;
        if (createRes.body.multiuse_invitations && createRes.body.multiuse_invitations.length > 0) {
            inviteLink = createRes.body.multiuse_invitations[0].link;
        }
        
        // Tên miền thực tế mà Postman trả về (nếu domain bị trùng, Postman có thể tự thêm số phụ)
        const returnedDomain = createRes.body.organization_domain || 'go';
        
        log('Output', `Tạo Team thành công!`, { orgId, returnedDomain, inviteLink });
        
        // ===================================================================================
        // KÍCH HOẠT GÓI ENTERPRISE TRIAL 7 NGÀY (Trial Journey):
        // ===================================================================================
        log('Process', `Đang kích hoạt gói Enterprise Trial 7 ngày cho Tổ chức ID: ${orgId}...`);
        
        // Điều hướng sang subdomain mới tạo của Team để cập nhật ngữ cảnh làm việc
        await page.goto(`https://${returnedDomain}.postman.co/`, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });
        
        /**
         * GỌI API KÍCH HOẠT DÙNG THỬ (TRIAL):
         *   - Dịch vụ (`service`): "trial"
         *   - Đường dẫn (`path`): "/v1/api/start/trial/journey"
         *   - Header đặc biệt: `x-entity-team-id: oid` (Gắn định danh Team cần cấp phép)
         *   - Body: `{ trialId: "enterprise-7-days-trial" }`
         */
        const trialRes = await page.evaluate(async (oid) => {
            const resp = await fetch('/_api/ws/proxy', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-entity-team-id': oid
                },
                body: JSON.stringify({
                    service: "trial",
                    method: "POST",
                    path: "/v1/api/start/trial/journey",
                    body: {
                        trialId: "enterprise-7-days-trial"
                    }
                })
            });
            return {
                status: resp.status,
                body: await resp.json().catch(() => null)
            };
        }, orgId);
        
        if (trialRes.status === 200) {
            log('Output', "Đã kích hoạt Enterprise Trial 7 ngày thành công rực rỡ!", trialRes.body);
        } else {
            log('Err', "Kích hoạt Trial thất bại hoặc gói trial đã được dùng trước đó.", trialRes);
        }
        
        // ===================================================================================
        // LƯU KẾT QUẢ VÀO FILE invite_links.txt:
        // ===================================================================================
        const resString = `Team: ${teamName} | Domain: ${returnedDomain} | Org ID: ${orgId} | Link: ${inviteLink}\n`;
        // Đường dẫn file lưu trữ nằm ở thư mục gốc dự án
        const logFile = path.join(process.cwd(), '../invite_links.txt');
        
        // Ghi nối tiếp (append) vào file
        fs.appendFileSync(logFile, resString);
        log('Process', "Đã lưu thông tin Team và Link mời vào file: " + logFile);
        
        // Nếu ở chế độ quan sát, dừng lại 3 giây để người dùng nhìn giao diện
        if (isHeadful) await new Promise(r => setTimeout(r, 3000));
        
        // Đóng trình duyệt hoàn tất quy trình
        await browser.close();
    } catch (e) {
        log('Err', "Lỗi nghiêm trọng trong quá trình tạo Team (B3): " + e.message);
        await browser.close();
    }
})();
