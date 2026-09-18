/**
 * =========================================================================================
 * FILE: b2_batch_login.mjs
 * MỤC ĐÍCH:
 *   Kịch bản Đăng Nhập Tự Động Hàng Loạt (Batch Login) cho các Profile Postman:
 *     1. Mở nhiều cửa sổ trình duyệt Chrome/Edge cùng lúc theo số luồng cấu hình (concurrency).
 *     2. Tự động tính toán toạ độ trên màn hình để xếp các cửa sổ dạng lưới (Smart Window Tiling),
 *        giúp người dùng dễ dàng quan sát trực quan mà không bị cửa sổ đè chồng lên nhau.
 *     3. Kiểm tra xem profile đã có sẵn phiên đăng nhập hay chưa:
 *        - Nếu ĐÃ CÓ: Báo thành công ngay và giải phóng luồng.
 *        - Nếu CHƯA CÓ: Tự động điền email, password, chờ 12 giây né bot rồi nhấn nút Login.
 *     4. Có cơ chế dự phòng: Nếu tự động điền thất bại 3 lần, chuyển sang chế độ chờ người dùng
 *        thao tác tay (chờ tối đa 10 phút).
 *     5. Hỗ trợ nhận tín hiệu IPC để Tạm Dừng (Pause) và Tiếp Tục (Resume) tiến trình từ Web UI.
 * =========================================================================================
 */

import puppeteer from 'puppeteer-core'; // Thư viện điều khiển trình duyệt chuyên dụng qua Chrome DevTools Protocol
import { getBrowserConfig } from '../../browser_config.mjs'; // Module xác định đường dẫn Chrome binary và User Data Directory
import pLimit from 'p-limit'; // Thư viện quản lý hàng đợi và giới hạn số lượng Promise chạy đồng thời

/**
 * Hàm log: Đóng gói việc ghi nhật ký, tự động nhận diện môi trường chạy để gửi qua IPC hoặc in ra Terminal.
 * 
 * @param {string} tag - Thẻ phân loại: 'Process' | 'Warn' | 'Err' | 'Output'
 * @param {string} message - Nội dung câu thông báo
 * @param {any} [data=null] - Đối tượng hoặc mảng đính kèm (nếu có)
 */
const log = (tag, message, data = null) => {
    if (process.send) {
        // Gửi thông điệp IPC dạng JSON tới Web Server để hiển thị trên giao diện người dùng
        process.send({ 
            type: 'log', 
            tag, 
            message, 
            data, 
            timestamp: new Date().toISOString() 
        });
    } else {
        // In ra màn hình console khi chạy thủ công bằng lệnh terminal
        console.log(`[${tag}] ${message}`);
    }
};

/**
 * ĐỌC THAM SỐ DÒNG LỆNH (CLI Arguments):
 * Cấu trúc gọi: node b2_batch_login.mjs <profiles_comma_separated> <concurrency> <browser> <headful|headless>
 */
const args = process.argv.slice(2);

// Kiểm tra nếu thiếu tham số cơ bản thì báo lỗi và dừng lại
if (args.length < 3) {
    log('Err', 'Thiếu tham số chạy kịch bản B2 Batch Login!');
    process.exit(1);
}

// args[0]: Chuỗi các email cách nhau bởi dấu phẩy => Chuyển thành mảng danh sách email
const profiles = args[0].split(',').filter(Boolean);

// args[1]: Số lượng luồng chạy đồng thời (mặc định = 6 nếu không nhập hoặc sai định dạng)
const concurrency = parseInt(args[1], 10) || 6;

// args[2]: Loại trình duyệt ('chrome' hoặc 'edge', mặc định là 'chrome')
const browserType = args[2] || 'chrome';

// args[3]: Chế độ hiển thị cửa sổ. Nếu khác 'headless' thì coi như bật giao diện (isHeadful = true)
const isHeadful = args[3] !== 'headless';

log('Process', `Bắt đầu Batch Login cho ${profiles.length} tài khoản. Luồng đồng thời: ${concurrency}`);

// Khởi tạo bộ giới hạn luồng chạy song song của thư viện p-limit
const limit = pLimit(concurrency);

// Biến đếm thứ tự cửa sổ được mở nhằm phục vụ tính toạ độ xếp cửa sổ
let runningIndex = 0; 

// BIẾN QUẢN LÝ TRẠNG THÁI TẠM DỪNG (PAUSE/RESUME):
let isPaused = false;

/**
 * LẮNG NGHE SỰ KIỆN ĐIỀU KHIỂN TỪ TIẾN TRÌNH CHA (SERVER):
 * Khi người dùng bấm nút "Tạm dừng" hoặc "Tiếp tục" trên giao diện Web UI, server sẽ gửi msg qua kênh IPC.
 */
process.on('message', (msg) => {
    if (msg && msg.cmd === 'pause') {
        isPaused = true;
        log('Process', 'Đã Tạm Dừng batch login. Các cửa sổ đang mở vẫn giữ nguyên vị trí.');
    } else if (msg && msg.cmd === 'resume') {
        isPaused = false;
        log('Process', 'Đã Tiếp Tục chạy batch login.');
    }
});

/**
 * Hàm waitIfPaused: Kiểm tra liên tục nếu trạng thái `isPaused = true` thì treo luồng lại mỗi 1 giây.
 */
async function waitIfPaused() {
    while (isPaused) {
        await new Promise(r => setTimeout(r, 1000));
    }
}

/**
 * Hàm loginProfile: Xử lý quy trình mở trình duyệt và đăng nhập cho 1 tài khoản cụ thể.
 * 
 * @param {string} email - Địa chỉ email tài khoản cần đăng nhập
 * @returns {Promise<void>}
 */
async function loginProfile(email) {
    // Nếu toàn hệ thống đang tạm dừng, chờ đến khi được bấm Tiếp tục
    await waitIfPaused();
    
    // Lấy thông tin đường dẫn Chrome và thư mục dữ liệu cá nhân (User Data Dir) của email này
    const config = getBrowserConfig(browserType, email);
    
    // THUẬT TOÁN XẾP CỬA SỔ THÔNG MINH (SMART WINDOW TILING):
    // Lấy số thứ tự cửa sổ hiện tại và tăng biến đếm
    const currentIndex = runningIndex++;
    
    // Số cột trên lưới màn hình = căn bậc 2 của số luồng đồng thời (làm tròn lên)
    const columns = Math.ceil(Math.sqrt(concurrency));
    
    // Toạ độ X (chiều ngang): Mỗi cột cách nhau 350 pixel
    const winX = (currentIndex % columns) * 350;
    
    // Toạ độ Y (chiều dọc): Mỗi hàng cách nhau 250 pixel
    const winY = Math.floor(currentIndex / columns) * 250;
    
    log('Process', `[${email}] Đang mở trình duyệt (Tọa độ: ${winX},${winY})...`);
    
    let browser;
    try {
        // KHỞI TẠO VÀ CẤU HÌNH TRÌNH DUYỆT PUPPETEER:
        browser = await puppeteer.launch({
            executablePath: config.executablePath,
            userDataDir: config.userDataDir,
            headless: !isHeadful, // false: hiển thị cửa sổ trực quan; true: chạy ẩn
            
            // Xoá cờ thông báo "Chrome is being controlled by automated test software" để tránh bị chặn bot
            ignoreDefaultArgs: ['--enable-automation'], 
            
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--window-size=1024,768`,           // Kích thước cửa sổ chuẩn 1024x768
                `--window-position=${winX},${winY}`, // Định vị cửa sổ đúng toạ độ đã tính
                '--no-errdialogs',                  // Ngăn hiển thị các popup báo lỗi của hệ điều hành
                // VÔ HIỆU HOÁ BIẾN AutomationControlled để ẩn dấu hiệu navigator.webdriver = true:
                '--disable-blink-features=AutomationControlled' 
            ],
            defaultViewport: null // Giữ viewport tự co giãn theo kích thước cửa sổ
        });

        const page = await browser.newPage();
        
        // TRUY CẬP TRANG CÀI ĐẶT TÀI KHOẢN POSTMAN:
        // Chờ tối đa 60 giây (60000ms) để tải trang đến khi mạng tương đối rảnh (networkidle2)
        await page.goto('https://go.postman.co/settings/me/account', { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });
        
        const currentUrl = page.url();
        
        // KIỂM TRA XEM CÓ BỊ BẮT BUỘC PHẢI ĐĂNG NHẬP KHÔNG:
        // Nếu URL chứa /login hoặc identity.getpostman.com nghĩa là tài khoản chưa có phiên đăng nhập
        if (currentUrl.includes('/login') || currentUrl.includes('identity.getpostman.com')) {
            let loginSuccess = false;
            let attempts = 0;
            const maxAttempts = 3; // Giới hạn thử tự động tối đa 3 lần
            
            // VÒNG LẶP TỰ ĐỘNG ĐĂNG NHẬP:
            while (!loginSuccess && attempts < maxAttempts) {
                attempts++;
                log('Warn', `[${email}] Đang cố gắng tự động điền thông tin đăng nhập (Lần thử ${attempts}/${maxAttempts})...`);
                
                try {
                    // Chờ ô nhập username xuất hiện tối đa 15 giây
                    await page.waitForSelector('#username', { timeout: 15000 }).catch(() => {});
                    const usernameEl = await page.$('#username');
                    
                    if (usernameEl) {
                        // Xoá trắng ô nhập email trước khi gõ để tránh dính dữ liệu cũ
                        await page.evaluate(() => {
                            const el = document.getElementById('username');
                            if (el) el.value = '';
                        });
                        // Gõ địa chỉ email vào ô input
                        await usernameEl.type(email);
                        
                        // Chờ ô nhập password xuất hiện tối đa 2 giây
                        await page.waitForSelector('#password', { timeout: 2000 }).catch(() => {});
                        const pwdEl = await page.$('#password');
                        
                        if (pwdEl) {
                            // Mật khẩu mặc định trong hệ thống
                            const pwd = 'Pass@0909'; 
                            await page.evaluate(() => {
                                const el = document.getElementById('password');
                                if (el) el.value = '';
                            });
                            // Gõ mật khẩu vào ô input
                            await pwdEl.type(pwd);
                            
                            // NGHỈ 12 GIÂY: QUAN TRỌNG ĐỂ NÉ HỆ THỐNG PHÁT HIỆN BOT CỦA POSTMAN
                            log('Process', `[${email}] Đã điền xong email/pass. Đợi 12s theo yêu cầu để nút login sẵn sàng...`);
                            await new Promise(r => setTimeout(r, 12000));
                            
                            // Tìm nút bấm Sign In (#sign-in-btn)
                            await page.waitForSelector('#sign-in-btn', { timeout: 2000 }).catch(() => {});
                            const btn = await page.$('#sign-in-btn');
                            if (btn) {
                                await btn.click();
                                log('Process', `[${email}] Đã click nút đăng nhập, đang chờ phản hồi từ máy chủ...`);
                            }
                        }
                    }
                    
                    // VÒNG LẶP THEO DÕI CHUYỂN TRANG TRONG 15 GIÂY:
                    let urlChanged = false;
                    for (let i = 0; i < 15; i++) {
                        await new Promise(r => setTimeout(r, 1000));
                        let currentUrlCheck = page.url();
                        // Nếu URL chuyển sang /settings/me hoặc /dashboard nghĩa là đã đăng nhập thành công
                        if (currentUrlCheck.includes('/settings/me') || currentUrlCheck.includes('/dashboard')) {
                            urlChanged = true;
                            break;
                        }
                    }
                    
                    if (urlChanged) {
                        loginSuccess = true;
                        log('Output', `[${email}] Đã đăng nhập thành công!`);
                        break;
                    } else {
                        log('Warn', `[${email}] Đăng nhập chưa chuyển trang. Đợi 5s rồi F5 tải lại...`);
                        await new Promise(r => setTimeout(r, 5000));
                        await page.reload({ waitUntil: 'networkidle2' }).catch(() => {});
                    }
                } catch (fillErr) {
                    log('Warn', `[${email}] Lỗi tự động điền: ${fillErr.message}. F5 tải lại...`);
                    await page.reload({ waitUntil: 'networkidle2' }).catch(() => {});
                }
            }
            
            // NẾU TỰ ĐỘNG THẤT BẠI CẢ 3 LẦN => CHUYỂN SANG CHẾ ĐỘ CHỜ THAO TÁC THỦ CÔNG:
            if (!loginSuccess) {
                log('Warn', `[${email}] Tự động đăng nhập thất bại sau ${maxAttempts} lần. Đang đợi bạn thao tác tay trên trình duyệt...`);
                try {
                    // Treo tiến trình và chờ cho đến khi URL đổi sang /settings/me hoặc /dashboard (tối đa 10 phút = 600,000ms)
                    await page.waitForFunction(
                        'window.location.href.includes("/settings/me") || window.location.href.includes("/dashboard")',
                        { timeout: 600000, polling: 2000 } 
                    );
                    log('Output', `[${email}] Đã đăng nhập thành công (Thủ công)!`);
                } catch (waitErr) {
                    log('Err', `[${email}] Quá thời gian chờ đăng nhập (10 phút) hoặc trình duyệt đã bị tắt.`);
                }
            }
            
            // Chờ thêm 2 giây để trình duyệt kịp lưu lại Cookie/Session xuống ổ cứng
            await new Promise(r => setTimeout(r, 2000));
        } else {
            // Trường hợp URL đã ở trang Dashboard/Settings ngay từ đầu
            log('Output', `[${email}] Đã có sẵn phiên đăng nhập (Không cần làm gì thêm).`);
            if (isHeadful) await new Promise(r => setTimeout(r, 2000));
        }
        
    } catch (e) {
        log('Err', `[${email}] Lỗi ngoại lệ: ${e.message}`);
    } finally {
        // ĐÓNG TRÌNH DUYỆT ĐỂ GIẢI PHÓNG BỘ NHỚ CHO CÁC PROFILE TIẾP THEO:
        if (browser) await browser.close().catch(() => {});
        log('Process', `[${email}] Đã đóng trình duyệt.`);
    }
}

/**
 * Hàm runBatch: Điều phối toàn bộ danh sách profile qua cơ chế giới hạn luồng của p-limit.
 */
async function runBatch() {
    // Tạo danh sách tác vụ đăng nhập
    const tasks = profiles.map(email => limit(async () => {
        await waitIfPaused();
        await loginProfile(email);
    }));
    
    // Đợi tất cả các profile được xử lý xong
    await Promise.all(tasks);
    log('Process', 'Batch Login hoàn tất toàn bộ.');
    process.exit(0);
}

// Bắt đầu chạy batch và xử lý lỗi nghiêm trọng nếu có
runBatch().catch(e => {
    log('Err', `Lỗi nghiêm trọng (Fatal error) trong Batch Login: ${e.message}`);
    process.exit(1);
});
