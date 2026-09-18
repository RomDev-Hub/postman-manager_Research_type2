/**
 * =========================================================================================
 * FILE: test_login_flow.mjs
 * MỤC ĐÍCH:
 *   Script Thử Nghiệm Đơn Lẻ Quy Trình Đăng Nhập & Bấm Join Team (Standalone Test Flow):
 *     1. Dùng để chạy thử nghiệm độc lập trên 1 tài khoản cụ thể mà không cần bật Web UI.
 *     2. Chụp ảnh màn hình (Screenshots) lưu vào thư mục `scratch/` để chẩn đoán lỗi giao diện
 *        nếu quá trình đăng nhập bị nghẽn hoặc không tìm thấy nút bấm.
 *     3. Kiểm tra cách tương tác với các nút bấm "Join Team" / "Accept" bằng cả 2 cách:
 *        - Cách 1: Dùng Puppeteer ElementHandle ($ / click).
 *        - Cách 2: Dùng `page.evaluate` quét trực tiếp mảng các nút trong DOM.
 * =========================================================================================
 */

import puppeteer from 'puppeteer-core'; // Thư viện điều khiển Chrome/Chromium thông qua DevTools Protocol
import { getBrowserConfig } from '../browser_config.mjs'; // Module lấy đường dẫn thực thi trình duyệt và thư mục User Data

async function run() {
    // Email thử nghiệm cố định trong môi trường test
    const email = 'hunggreen0010@maildrop.cc';
    
    // Lấy cấu hình trình duyệt (ở đây dùng profile brave/chrome tuỳ máy)
    const { executablePath, userDataDir } = getBrowserConfig('brave', email);
    
    console.log(`[Khởi tạo] Chuẩn bị mở trình duyệt cho tài khoản thử nghiệm: ${email}`);
    console.log(`[Đường dẫn Chrome] ${executablePath}`);
    console.log(`[Thư mục Profile] ${userDataDir}`);

    // KHỞI ĐỘNG TRÌNH DUYỆT CÓ GIAO DIỆN ĐỂ QUAN SÁT:
    const browser = await puppeteer.launch({
        executablePath,
        userDataDir,
        headless: false, // Bật giao diện để quan sát trực tiếp chuyển động chuột và bàn phím
        ignoreDefaultArgs: ['--enable-automation'], // Ẩn cờ thông báo automation để tránh bị phát hiện bot
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled' // Bypass kiểm tra navigator.webdriver
        ]
    });

    const page = await browser.newPage();
    
    try {
        console.log("[Điều hướng] Đang truy cập trang cài đặt tài khoản Postman...");
        // Mở trang Settings Account với thời gian chờ nạp HTML cơ bản (domcontentloaded)
        await page.goto("https://go.postman.co/settings/me/account", { waitUntil: 'domcontentloaded' });
        
        console.log("[Chờ đợi] Đã vào trang. Tạm dừng 5 giây để quan sát và chờ chuyển hướng...");
        await new Promise(r => setTimeout(r, 5000));
        
        console.log("[URL Hiện Tại] " + page.url());
        
        // KIỂM TRA MÀN HÌNH ĐĂNG NHẬP:
        // Nếu URL chứa /login hoặc identity.getpostman.com nghĩa là tài khoản chưa đăng nhập
        if (page.url().includes('/login') || page.url().includes('identity.getpostman.com')) {
            console.log("[Đăng nhập] Phát hiện màn hình đăng nhập. Bắt đầu tự động điền form...");
            
            // Chờ ô nhập username xuất hiện tối đa 10 giây (10,000ms)
            const usernameEl = await page.waitForSelector('#username', { timeout: 10000 }).catch(() => null);
            
            if (usernameEl) {
                console.log(`[Đăng nhập] Đang gõ email: ${email}`);
                // Nhập email vào ô #username
                await usernameEl.type(email);
                
                // Chờ ô nhập mật khẩu xuất hiện tối đa 5 giây
                const pwdEl = await page.waitForSelector('#password', { timeout: 5000 }).catch(() => null);
                if (pwdEl) {
                    const defaultPassword = 'Pass@0909';
                    console.log(`[Đăng nhập] Đang gõ mật khẩu...`);
                    // Nhập mật khẩu vào ô #password
                    await pwdEl.type(defaultPassword);
                    
                    // CHỜ 12 GIÂY ĐỂ NÉ CƠ CHẾ BOT DETECTION CỦA POSTMAN:
                    console.log("[Chờ đợi] Đã điền xong tài khoản và mật khẩu. Đang dừng 12 giây theo yêu cầu chống bot...");
                    await new Promise(r => setTimeout(r, 12000));
                    
                    console.log("[Đăng nhập] Bắt đầu tìm kiếm nút Sign In (#sign-in-btn)...");
                    const btn = await page.$('#sign-in-btn').catch(e => console.log("Lỗi tìm nút Sign-in:", e.message));
                    
                    if (btn) {
                        // Thiết lập bộ lắng nghe chuyển trang (Navigation Promise) trước khi click
                        const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
                        console.log("[Đăng nhập] Đang click nút Sign In...");
                        await btn.click().catch(e => console.log("Lỗi khi click:", e.message));
                        console.log("[Đăng nhập] Đã click nút Sign In. Đang chờ chuyển hướng trang...");
                        await navPromise;
                    }
                }
            } else {
                // Nếu không tìm thấy ô #username, chụp ảnh màn hình để debug lỗi giao diện
                console.log("[Cảnh báo] Không tìm thấy ô nhập #username! Tiến hành chụp ảnh màn hình chẩn đoán...");
                await page.screenshot({ path: 'scratch/error_login.png' });
                console.log("[Chụp ảnh] Đã lưu ảnh vào file: scratch/error_login.png");
            }
        }
        
        console.log("[Chờ đợi] Tạm dừng 10 giây để trang tải hoàn chỉnh sau khi đăng nhập...");
        await new Promise(r => setTimeout(r, 10000));
        
        console.log("[URL Sau Đăng Nhập] " + page.url());
        // Chụp ảnh màn hình trạng thái sau đăng nhập để lưu trữ bằng chứng
        await page.screenshot({ path: 'scratch/after_login.png' });
        console.log("[Chụp ảnh] Đã lưu ảnh vào file: scratch/after_login.png");
        
        // KIỂM TRA NÚT BẤM THAM GIA TEAM (JOIN TEAM / ACCEPT):
        console.log("[Tham gia Team] Đang tìm kiếm nút Join Team hoặc Accept...");
        
        // Thử tìm nút bấm bằng selector CSS thông thường
        const joinBtn = await page.$('button[type="submit"], button:contains("Join Team")').catch(e => console.log("Lỗi tìm nút join:", e.message));
        
        if (joinBtn) {
            console.log("[Tham gia Team] Đã tìm thấy nút Join Team bằng selector. Đang click...");
            const navPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await joinBtn.click();
            await navPromise;
        } else {
            console.log("[Tham gia Team] Không tìm thấy bằng selector. Chuyển sang quét DOM bằng page.evaluate...");
            
            // Dùng evaluate để duyệt toàn bộ thẻ button và kiểm tra thuộc tính innerText
            const clicked = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const btn = buttons.find(b => b.innerText.includes('Join Team') || b.innerText.includes('Accept'));
                if (btn) { 
                    btn.click(); 
                    return true; 
                }
                return false;
            });
            console.log("[Tham gia Team] Kết quả click bằng evaluate:", clicked ? "THÀNH CÔNG" : "KHÔNG TÌM THẤY NÚT");
        }
        
    } catch(e) {
        console.error("[Ngoại lệ] Lỗi trong quá trình chạy test flow:", e);
    }
    
    console.log("[Hoàn tất] Tạm dừng 5 giây trước khi đóng trình duyệt kết thúc...");
    await new Promise(r => setTimeout(r, 5000));
    await browser.close();
}

// Chạy luồng kiểm tra
run();
