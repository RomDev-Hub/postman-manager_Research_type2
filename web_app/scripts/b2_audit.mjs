/**
 * =========================================================================================
 * FILE: b2_audit.mjs
 * MỤC ĐÍCH:
 *   Kịch bản kiểm tra (Audit) phiên đăng nhập của hàng loạt profile Postman cùng lúc.
 *   - Chạy ở chế độ ẩn hoàn toàn (Headless mode) để không làm phiền người dùng.
 *   - Chặn tải các tài nguyên nặng (hình ảnh, css, font chữ, video) để đạt tốc độ quét tối đa.
 *   - Kiểm tra xem cookie/session trong thư mục profile còn hiệu lực (OK) hay đã hết hạn (EXPIRED).
 *   - Bắn kết quả thời gian thực về Server thông qua kênh IPC (Inter-Process Communication).
 * =========================================================================================
 */

import puppeteer from 'puppeteer-core'; // Thư viện điều khiển Chromium/Chrome thông qua DevTools Protocol
import pLimit from 'p-limit';            // Thư viện kiểm soát số lượng tác vụ Promise chạy đồng thời (Concurrency limiter)
import { getBrowserConfig } from '../../browser_config.mjs'; // Hàm lấy đường dẫn file thực thi trình duyệt và thư mục User Data

/**
 * ĐỌC VÀ XỬ LÝ THAM SỐ ĐẦU VÀO TỪ DÒNG LỆNH (CLI Arguments):
 * 
 * Cấu trúc mảng process.argv:
 *   process.argv[0]: Đường dẫn đến file thực thi Node.js (node)
 *   process.argv[1]: Đường dẫn đến script đang chạy (b2_audit.mjs)
 *   process.argv[2] (profilesArg): Chuỗi danh sách email phân tách bởi dấu phẩy (VD: "a@mail.com,b@mail.com")
 *   process.argv[3] (browserType): Loại trình duyệt ('chrome' hoặc 'edge')
 */
const [, , profilesArg, browserType] = process.argv;

// Phân tách chuỗi email thành mảng:
// 1. split(','): Tách chuỗi theo dấu phẩy.
// 2. map(e => e.trim()): Cắt bỏ khoảng trắng thừa đầu và cuối mỗi email.
// 3. filter(Boolean): Loại bỏ các phần tử rỗng hoặc null/undefined.
const emails = profilesArg ? profilesArg.split(',').map(e => e.trim()).filter(Boolean) : [];

// Nếu không có email nào được cung cấp, thoát tiến trình ngay lập tức với mã 0 (thành công nhưng không có việc để làm)
if (emails.length === 0) {
    process.exit(0);
}

/**
 * Hàm emitLog: Gửi thông điệp nhật ký (log) về tiến trình cha (Server Express) hoặc in ra Terminal.
 * 
 * @param {string} tag - Thẻ phân loại log: 'Process' (tiến trình), 'Warn' (cảnh báo), 'Err' (lỗi), 'Output' (kết quả).
 * @param {string} message - Nội dung câu log cần hiển thị.
 * @param {any} [data=null] - Dữ liệu bổ sung (object, mảng, v.v.) nếu có.
 * 
 * CƠ CHẾ IPC:
 *   - `process.send`: Tồn tại khi script được gọi từ `child_process.spawn()` với tùy chọn `stdio: [..., 'ipc']`.
 *   - Cho phép gửi đối tượng JSON trực tiếp về server mà không cần parse stdout dạng chuỗi.
 */
const emitLog = (tag, message, data = null) => {
    if (process.send) {
        process.send({ 
            type: 'log', 
            tag, 
            message, 
            data, 
            timestamp: new Date().toISOString() 
        });
    } else {
        console.log(`[${tag}] ${message}`);
    }
};

/**
 * Hàm emitAuditResult: Bắn thông báo kết quả kiểm tra của từng tài khoản về cho giao diện Web UI.
 * 
 * @param {string} email - Địa chỉ email được kiểm tra.
 * @param {'OK'|'EXPIRED'} status - Trạng thái: 'OK' (đã đăng nhập, session còn sống), 'EXPIRED' (hết hạn hoặc chưa đăng nhập).
 */
const emitAuditResult = (email, status) => {
    if (process.send) {
        process.send({ 
            type: 'audit_result', 
            data: { email, status } 
        });
    }
};

/**
 * GIỚI HẠN TẢI ĐỒNG THỜI (Concurrency Limit):
 * Thiết lập chạy tối đa 10 profile cùng một lúc (pLimit(10)).
 * Con số 10 được tối ưu hoá cho chế độ Headless: Đủ nhanh nhưng không gây tràn RAM/CPU máy tính.
 */
const limit = pLimit(10); 

/**
 * Hàm auditProfile: Thực hiện kiểm tra trạng thái đăng nhập cho 1 profile cụ thể.
 * 
 * @param {string} email - Email của profile cần quét.
 * @returns {Promise<void>}
 */
async function auditProfile(email) {
    // Lấy cấu hình đường dẫn file chạy Chrome và thư mục dữ liệu (User Data Directory) của profile này
    const config = getBrowserConfig(browserType, email);
    let browser;
    
    try {
        // KHỞI CHẠY TRÌNH DUYỆT ẨN (Headless Puppeteer):
        browser = await puppeteer.launch({
            executablePath: config.executablePath, // Đường dẫn tới Chrome/Edge
            userDataDir: config.userDataDir,       // Thư mục lưu Cookie và LocalStorage của email này
            headless: true,                        // Bắt buộc = true: Chạy ngầm 100%, không hiện cửa sổ để tiết kiệm tài nguyên
            args: [
                '--no-sandbox',                    // Tắt cơ chế Sandbox của Linux (cần thiết khi chạy quyền root/server container)
                '--disable-setuid-sandbox',        // Tắt tính năng bảo mật Setuid sandbox bổ trợ
                '--disable-dev-shm-usage',        // Tránh lỗi Crash do bộ nhớ dùng chung /dev/shm quá nhỏ trên hệ điều hành Linux
                '--disable-gpu',                  // Tắt tăng tốc đồ hoạ bằng GPU (Headless không cần render hình ảnh ra màn hình)
                '--mute-audio'                    // Tắt toàn bộ âm thanh trình duyệt
            ]
        });

        // Tạo một tab mới trong trình duyệt
        const page = await browser.newPage();
        
        // TỐI ƯU TỐC ĐỘ: CHẶN TẢI TÀI NGUYÊN NẶNG (Request Interception):
        // Bật tính năng can thiệp vào các gói tin HTTP request
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            // Lấy loại tài nguyên yêu cầu (image, stylesheet, font, media...)
            const resourceType = req.resourceType();
            // Nếu là ảnh, css, font, video => HUỶ YÊU CẦU (abort) để không tốn băng thông và tải trang tức thì
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                req.abort();
            } else {
                // Các tài nguyên khác (html, document, xhr, fetch, script) => Cho phép tải tiếp
                req.continue();
            }
        });

        // ĐIỀU HƯỚNG ĐẾN TRANG CÀI ĐẶT TÀI KHOẢN POSTMAN:
        // URL: https://go.postman.co/settings/me/account
        // - waitUntil: 'networkidle2': Chờ đến khi không còn quá 2 kết nối mạng mở trong 500ms
        // - timeout: 15000: Hạn chế tối đa 15 giây. Nếu mạng chậm quá 15s sẽ quăng lỗi timeout
        await page.goto('https://go.postman.co/settings/me/account', { 
            waitUntil: 'networkidle2', 
            timeout: 15000 
        });
        
        // KIỂM TRA ĐIỀU HƯỚNG URL ĐỂ XÁC ĐỊNH TRẠNG THÁI LOGIN:
        const currentUrl = page.url();
        
        // Nếu cookie còn sống, Postman sẽ giữ lại ở trang /settings/me hoặc đưa vào /dashboard
        if (currentUrl.includes('/settings/me') || currentUrl.includes('/dashboard')) {
            emitAuditResult(email, 'OK');
            emitLog('Process', `[${email}] Trạng thái: OK (Đã Login)`);
        } else {
            // Nếu chưa đăng nhập hoặc cookie hết hạn, Postman sẽ tự động redirect về /login hoặc identity.getpostman.com
            emitAuditResult(email, 'EXPIRED');
            emitLog('Process', `[${email}] Trạng thái: EXPIRED (Chưa Login hoặc hết phiên)`);
        }

    } catch (e) {
        // NẾU XẢY RA LỖI (Timeout mạng, sập trang, hoặc không load được):
        // Mặc định coi là phiên đã hết hạn (EXPIRED) để cảnh báo người dùng cần đăng nhập lại
        emitAuditResult(email, 'EXPIRED');
        emitLog('Warn', `[${email}] Lỗi khi quét cookie: ${e.message}`);
    } finally {
        // ĐÓNG TRÌNH DUYỆT ĐỂ GIẢI PHÓNG BỘ NHỚ RAM:
        // Khối finally luôn được thực thi kể cả khi có lỗi xảy ra
        if (browser) {
            await browser.close().catch(console.error);
        }
    }
}

/**
 * Hàm run: Điểm vào chính của script, điều phối toàn bộ danh sách email cần audit.
 */
async function run() {
    emitLog('Process', `Bắt đầu audit ${emails.length} profiles (Headless)...`);
    
    // Tạo danh sách các task kiểm tra được bọc trong hàm limit để khống chế tối đa 10 luồng cùng lúc
    const tasks = emails.map(email => limit(() => auditProfile(email)));
    
    // Chờ tất cả các task hoàn thành
    await Promise.all(tasks);
    
    emitLog('Process', `Audit hoàn tất.`);
    // Kết thúc tiến trình Node.js thành công
    process.exit(0);
}

// Gọi hàm run và bắt lỗi toàn cục nếu script bị crash ngoài ý muốn
run().catch(e => {
    emitLog('Err', `Audit script crashed: ${e.message}`);
    process.exit(1);
});
