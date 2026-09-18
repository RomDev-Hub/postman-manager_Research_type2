/**
 * =========================================================================================
 * FILE: open_profile.mjs
 * MỤC ĐÍCH:
 *   Kịch bản Mở Trình Duyệt Thủ Công Cho Một Profile (Manual Profile Inspection):
 *     1. Nhận địa chỉ email từ Web UI hoặc dòng lệnh terminal.
 *     2. Khởi chạy trình duyệt Chrome/Edge có giao diện người dùng đầy đủ (Headful mode).
 *     3. Gắn đúng thư mục dữ liệu cá nhân (User Data Directory) của profile đó (lưu session, cookie, cache).
 *     4. Tự động điều hướng đến trang quản lý tài khoản Postman: https://go.postman.co/settings/me/account.
 *     5. Duy trì tiến trình Node.js chạy ngầm cho đến khi người dùng tự tay tắt cửa sổ trình duyệt
 *        (lắng nghe sự kiện `browser.on('disconnected')`).
 *     6. Thường dùng khi:
 *        - Người dùng muốn kiểm tra thủ công tài khoản có bị khoá không.
 *        - Đăng nhập thủ công bằng tay nếu gặp captcha phức tạp.
 *        - Thay đổi cài đặt cá nhân, mật khẩu hoặc 2FA của tài khoản.
 * =========================================================================================
 */

import puppeteer from 'puppeteer-core'; // Thư viện Puppeteer điều khiển trình duyệt
import { getBrowserConfig } from '../../browser_config.mjs'; // Hàm lấy cấu hình đường dẫn Chrome và Profile

/**
 * ĐỌC THAM SỐ DÒNG LỆNH (CLI Arguments):
 * 
 * process.argv[2] (email): Email tài khoản cần mở trình duyệt (bắt buộc).
 * process.argv[3] (browserType): Loại trình duyệt ('chrome' hoặc 'edge', mặc định là 'chrome').
 */
const [, , email, browserType] = process.argv;

// Kiểm tra tính hợp lệ của tham số: Nếu không có email thì dừng ngay
if (!email) {
    console.log(`[Err] Thiếu tham số email! Cú pháp: node open_profile.mjs <email> [browser]`);
    process.exit(1);
}

// Thiết lập loại trình duyệt mặc định nếu không truyền vào
const type = browserType || 'chrome';

/**
 * Hàm openProfile: Khởi động cửa sổ trình duyệt và giữ tiến trình mở.
 */
async function openProfile() {
    // Thông báo trạng thái bắt đầu mở profile
    if (process.send) {
        process.send({ 
            type: 'log', 
            tag: 'Process', 
            message: `[${email}] Đang mở profile...` 
        });
    } else {
        console.log(`[Process] Đang mở profile cho: ${email}`);
    }

    // Lấy đường dẫn Chrome và thư mục lưu trữ profile tương ứng với email
    const config = getBrowserConfig(type, email);
    
    try {
        // KHỞI ĐỘNG TRÌNH DUYỆT CÓ GIAO DIỆN (Headful Puppeteer):
        const browser = await puppeteer.launch({
            executablePath: config.executablePath, // File thực thi Chrome/Edge
            userDataDir: config.userDataDir,       // Thư mục lưu cookie & profile
            headless: false,                        // BẮT BUỘC = false để hiển thị cửa sổ trực quan cho người dùng thao tác
            ignoreDefaultArgs: ['--enable-automation'], // Ẩn dải banner cảnh báo "Chrome is being controlled by automated software"
            args: [
                '--no-sandbox',                    // Tắt sandbox
                '--disable-setuid-sandbox',
                '--window-size=1024,768',          // Kích thước chuẩn dễ thao tác
                '--no-errdialogs',
                // Tắt cờ AutomationControlled để tránh bị Cloudflare / Postman chặn
                '--disable-blink-features=AutomationControlled'
            ],
            defaultViewport: null                  // Để viewport tự co giãn theo kích thước cửa sổ thật
        });

        // Lấy danh sách các tab đang có sẵn (Puppeteer thường mở sẵn 1 tab trắng)
        const pages = await browser.pages();
        // Tái sử dụng tab đầu tiên nếu có, nếu chưa có thì tạo mới
        const page = pages.length > 0 ? pages[0] : await browser.newPage();
        
        // Điều hướng đến trang tài khoản Postman với thời gian chờ tối đa 60 giây
        await page.goto('https://go.postman.co/settings/me/account', { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        }).catch(() => {});
        
        // Báo cáo đã mở trình duyệt thành công
        if (process.send) {
            process.send({ 
                type: 'log', 
                tag: 'Output', 
                message: `[${email}] Đã mở trình duyệt thành công.` 
            });
        } else {
            console.log(`[Output] Đã mở trình duyệt cho: ${email}. Đóng cửa sổ trình duyệt để kết thúc.`);
        }
        
        /**
         * DUY TRÌ TIẾN TRÌNH NODE.JS (KEEP ALIVE):
         *   - Sử dụng một Promise mới gắn với sự kiện 'disconnected' của browser instance.
         *   - Khi người dùng bấm dấu [X] đỏ trên thanh tiêu đề Chrome để đóng trình duyệt,
         *     Puppeteer sẽ phát ra sự kiện 'disconnected', từ đó Promise được giải quyết (resolve).
         *   - Nhờ vậy tiến trình Node.js không bị tự tắt ngay sau khi chạy xong script.
         */
        await new Promise(resolve => browser.on('disconnected', resolve));
        
        // Thông báo khi người dùng đã đóng trình duyệt
        if (process.send) {
            process.send({ 
                type: 'log', 
                tag: 'Process', 
                message: `[${email}] Đã đóng trình duyệt.` 
            });
        } else {
            console.log(`[Process] Trình duyệt cho ${email} đã đóng.`);
        }

    } catch (e) {
        // Xử lý lỗi nếu không thể mở trình duyệt (sai đường dẫn, xung đột file khoá Profile Lock...)
        if (process.send) {
            process.send({ 
                type: 'log', 
                tag: 'Err', 
                message: `[${email}] Lỗi khi mở profile: ${e.message}` 
            });
        } else {
            console.log(`[Err] Lỗi mở profile ${email}: ${e.message}`);
        }
    }
}

// Bắt đầu thực thi
openProfile();
