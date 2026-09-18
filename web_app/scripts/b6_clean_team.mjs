/**
 * =========================================================================================
 * FILE: b6_clean_team.mjs
 * MỤC ĐÍCH:
 *   Kịch bản Dọn Dẹp / Rời / Xoá Đội Nhóm (Clean Teams) cho tài khoản Postman:
 *     1. Đăng nhập vào tài khoản Admin/User được chỉ định.
 *     2. Sử dụng API nội bộ của Postman (Service: "hermes") để lấy danh sách toàn bộ Không gian làm việc
 *        (Workspaces) và Đội nhóm (Teams) mà tài khoản này đang tham gia.
 *     3. Lọc ra các Team mà tài khoản có quyền Quản trị viên (`role === 'admin'`).
 *     4. Thực hiện thao tác Rời khỏi Team (`/api/teams/leave`):
 *        - Theo cơ chế hoạt động của Postman, khi Admin duy nhất rời khỏi một Team, Team đó sẽ
 *          tự động bị giải tán / xoá bỏ hoàn toàn khỏi hệ thống.
 *     5. Giải phóng dung lượng và số lượng slot tài khoản để tái sử dụng cho các quy trình sau.
 * =========================================================================================
 */

import puppeteer from 'puppeteer'; // Thư viện Puppeteer điều khiển trình duyệt
import { getBrowserConfig } from '../../browser_config.mjs'; // Hàm lấy đường dẫn Chrome và thư mục Profile
import path from 'path'; // Thư viện thao tác với đường dẫn tệp tin

/**
 * Hàm log: Gửi thông điệp về Web Server qua IPC hoặc in ra Terminal nếu chạy độc lập.
 * 
 * @param {string} tag - Phân loại thông báo: 'Process' | 'Warn' | 'Err' | 'Output'
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
 * Cú pháp: node b6_clean_team.mjs <admin_email> [browser] [headful|headless]
 */
const args = process.argv.slice(2);

if (args.length < 1) {
    log('Err', "Sai cú pháp! Cách dùng: node b6_clean_team.mjs <admin_email> [browser] [headful|headless]");
    process.exit(1);
}

// args[0]: Địa chỉ email tài khoản cần dọn dẹp các Team
const email = args[0];

// args[1]: Loại trình duyệt ('chrome' hoặc 'edge', mặc định là 'chrome')
const browserType = args[1] || 'chrome';

// args[2]: Chế độ hiển thị cửa sổ. Khác 'headless' thì sẽ mở cửa sổ trực quan (mặc định mở trực quan)
const isHeadful = args[2] !== 'headless';

log('Process', `Bắt đầu quy trình dọn dẹp Team cho tài khoản: ${email}`);

// Lấy đường dẫn Chrome thực thi và thư mục lưu dữ liệu profile của email này
const { executablePath, userDataDir: profilePath } = getBrowserConfig(browserType, email);

// Hàm chính thực thi toàn bộ quy trình dọn dẹp
(async () => {
    let browser;
    try {
        // KHỞI ĐỘNG TRÌNH DUYỆT PUPPETEER:
        browser = await puppeteer.launch({
            executablePath: executablePath,
            userDataDir: profilePath,
            headless: !isHeadful ? "new" : false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1280,800',
                '--no-errdialogs',
                '--hide-crash-restore-bubble'
            ],
            defaultViewport: null
        });

        const page = await browser.newPage();
        
        log('Process', "Đang truy cập trang cài đặt để kiểm tra phiên đăng nhập...");
        // Mở trang Settings Account để kích hoạt toàn bộ cookie phiên làm việc
        await page.goto('https://go.postman.co/settings/me/account', { 
            waitUntil: 'networkidle2' 
        });
        
        // KIỂM TRA PHIÊN ĐĂNG NHẬP:
        // Nếu bị chuyển hướng về màn hình đăng nhập nghĩa là profile này chưa có cookie sống
        if (page.url().includes('/login') || page.url().includes('identity.getpostman.com')) {
            log('Err', "Tài khoản chưa đăng nhập hoặc cookie đã hết hạn! Vui lòng chạy bước B2 Login trước.");
            await browser.close();
            process.exit(1);
        }

        // ===================================================================================
        // BƯỚC 1: LẤY DANH SÁCH KHÔNG GIAN LÀM VIỆC (WORKSPACES) ĐỂ XÁC ĐỊNH TEAM
        // ===================================================================================
        log('Process', "Đang gọi API nội bộ lấy danh sách Workspaces...");
        
        /**
         * GỌI API NỘI BỘ POSTMAN QUA page.evaluate():
         *   - Dịch vụ (`service`): "hermes" (Dịch vụ quản lý Workspaces và Team của Postman)
         *   - Đường dẫn (`path`): "/workspaces"
         *   - Phương thức: "GET"
         */
        const teamData = await page.evaluate(async () => {
            const resp = await fetch('/_api/ws/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: "hermes",
                    method: "GET",
                    path: "/workspaces"
                })
            });
            return {
                status: resp.status,
                body: await resp.json().catch(() => null)
            };
        });

        if (!teamData.body || !teamData.body.data) {
            log('Err', "Thất bại khi lấy danh sách workspaces để kiểm tra team hiện tại.");
            await browser.close();
            process.exit(1);
        }

        // Tìm kiếm xem có workspace nào thuộc loại 'team' hay không
        const team = teamData.body.data.find(w => w.type === 'team');
        if (!team) {
            log('Output', "Tài khoản này hiện tại KHÔNG tham gia bất kỳ Team nào. Hoàn tất dọn dẹp!");
            await browser.close();
            process.exit(0);
        }

        const currentTeamId = team.teamId;
        log('Process', `Phát hiện đang ở Team ID: ${currentTeamId}. Đang truy vấn danh sách tất cả các Team...`);
        
        // ===================================================================================
        // BƯỚC 2: LẤY DANH SÁCH TẤT CẢ CÁC ĐỘI NHÓM MÀ TÀI KHOẢN THAM GIA
        // ===================================================================================
        /**
         * GỌI API LẤY DANH SÁCH TEAM CỦA USER (/api/teams/me):
         *   - Dịch vụ (`service`): "hermes"
         *   - Đường dẫn: "/api/teams/me"
         *   - Trả về danh sách các team cùng vai trò (`role`) của người dùng trong team đó.
         */
        const myTeams = await page.evaluate(async () => {
            const resp = await fetch('/_api/ws/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service: "hermes",
                    method: "GET",
                    path: "/api/teams/me"
                })
            });
            return await resp.json().catch(() => null);
        });

        if (!myTeams || !myTeams.data) {
            log('Err', "Không thể lấy danh sách các team người dùng tham gia.");
            await browser.close();
            process.exit(1);
        }

        log('Output', `Tài khoản đang tham gia vào ${myTeams.data.length} team.`);

        // ===================================================================================
        // BƯỚC 3: DUYỆT QUA TỪNG TEAM ĐỂ THỰC HIỆN RỜI / XOÁ TEAM
        // ===================================================================================
        for (const t of myTeams.data) {
            log('Process', `Đang kiểm tra Team: "${t.name}" (ID: ${t.id}) - Vai trò: ${t.role}`);
            
            // Chỉ tiến hành giải tán nếu tài khoản này là Admin (quản trị viên của team)
            if (t.role === 'admin') {
                log('Process', `Tài khoản là Admin. Tiến hành rời khỏi (và giải tán) Team "${t.name}"...`);
                
                /**
                 * GỌI API RỜI TEAM (/api/teams/leave):
                 *   - Header bắt buộc: `x-entity-team-id: tid` (ID của Team cần rời)
                 *   - Body: `{ service: "hermes", method: "POST", path: "/api/teams/leave" }`
                 *   - Khi admin cuối cùng rời đi, Postman sẽ tự động giải tán toàn bộ Team.
                 */
                const leaveRes = await page.evaluate(async (tid) => {
                    const resp = await fetch('/_api/ws/proxy', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'x-entity-team-id': tid
                        },
                        body: JSON.stringify({
                            service: "hermes",
                            method: "POST",
                            path: "/api/teams/leave"
                        })
                    });
                    return resp.status;
                }, t.id);
                
                // Mã HTTP 200 biểu thị rời team thành công
                if (leaveRes === 200) {
                    log('Output', `Đã rời và giải tán thành công Team: "${t.name}"`);
                } else {
                    log('Err', `Không thể rời Team "${t.name}" (Mã trạng thái HTTP: ${leaveRes})`);
                }
            } else {
                log('Warn', `Bỏ qua Team "${t.name}" vì tài khoản không phải là Admin (Vai trò hiện tại: ${t.role}).`);
            }
        }
        
        log('Output', "Hoàn tất quy trình dọn dẹp toàn bộ Team!");
        
        // Nếu ở chế độ có giao diện, dừng 4 giây để người dùng quan sát trước khi tắt
        if (isHeadful) await new Promise(r => setTimeout(r, 4000));
        await browser.close();
        
    } catch (e) {
        log('Err', `Lỗi nghiêm trọng trong quá trình dọn dẹp Team: ${e.message}`);
        if (browser) await browser.close();
    }
})();
