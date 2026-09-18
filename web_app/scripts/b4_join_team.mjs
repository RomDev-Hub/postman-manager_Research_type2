/**
 * =========================================================================================
 * FILE: b4_join_team.mjs
 * MỤC ĐÍCH:
 *   TRÁI TIM CỦA QUY TRÌNH AUTOMATION: Tự động cho hàng loạt tài khoản gia nhập vào Đội nhóm (Team).
 *   Kịch bản này giải quyết các thách thức kỹ thuật phức tạp nhất trong dự án:
 *     1. Chạy đa luồng song song (Concurrency Worker Pool) với kiểm soát số lượng trình duyệt mở đồng thời.
 *     2. Định vị cửa sổ thông minh (Smart Window Tiling) giúp xếp các cửa sổ thành lưới đẹp mắt trên màn hình.
 *     3. Mô hình Máy Trạng Thái (State Machine Loop) chạy liên tục mỗi 2 giây để thích ứng với các tình huống:
 *        - Bị chặn IP do gửi quá nhiều yêu cầu (HTTP 429 Rate Limit) => Nghỉ ngơi 3 phút để gỡ chặn.
 *        - Link mời hỏng hoặc hết hạn (HTTP 404) => Thoát ngay để không lãng phí thời gian.
 *        - Sập máy chủ Postman (Lỗi 500 Màn hình con chó) => Tự động F5 tải lại.
 *        - Rào cản Cloudflare Turnstile / Captcha => Chờ tự động vượt qua.
 *        - Màn hình Chọn Tài Khoản (Account Switcher) => Tự dò thẻ HTML chứa email để click.
 *        - Màn hình Bắt Đăng Nhập Lại => Tự động điền email, pass và submit chuẩn xác.
 *        - Tìm thấy nút "Join Team" hoặc "Accept" => Click tham gia và xác nhận vào Dashboard.
 *     4. Tương tác thời gian thực với Web UI: Có thể Tạm Dừng (Pause), Tiếp Tục (Resume), hoặc Huỷ (Stop) bất kỳ lúc nào.
 * =========================================================================================
 */

import puppeteer from 'puppeteer-core'; // Thư viện điều khiển Chrome/Chromium qua DevTools Protocol
import { getBrowserConfig } from '../../browser_config.mjs'; // Module xác định đường dẫn Chrome binary và User Data
import path from 'path'; // Thư viện xử lý đường dẫn tập tin
import {
    sleep,
    performLogin,
    checkAndHandleDogError,
    checkAndHandleCaptcha,
    check404,
    checkRateLimit
} from './postman_utils.mjs'; // Nhập bộ công cụ tiện ích đã được đóng gói

/**
 * Hàm log: Gửi thông điệp nhật ký về tiến trình cha (Server Express qua IPC) hoặc in ra Terminal.
 * 
 * @param {string} tag - Thẻ phân loại log: 'Process' (tiến trình), 'Warn' (cảnh báo), 'Err' (lỗi), 'Output' (kết quả).
 * @param {string} message - Nội dung thông báo hiển thị cho người dùng.
 * @param {any} [data=null] - Dữ liệu chi tiết đính kèm (Object hoặc Array).
 */
const log = (tag, message, data = null) => {
    if (process.send) {
        // Gửi thông điệp dạng JSON qua kênh truyền thông liên tiến trình (IPC)
        process.send({ type: 'log', tag, message, data });
    } else {
        // In ra màn hình console khi chạy bằng lệnh terminal thông thường
        console.log(`[${tag}] ${message}`, data ? data : '');
    }
};

/**
 * ĐỌC VÀ KIỂM TRA TẬP THAM SỐ DÒNG LỆNH (CLI Arguments):
 * Cú pháp gọi: node b4_join_team.mjs <profiles_comma_separated> <invite_url> <concurrency> [browser]
 */
const args = process.argv.slice(2);

if (args.length < 4) {
    log('Err', "Sai cú pháp! Cách dùng: node b4_join_team.mjs <profiles_comma_separated> <invite_url> <concurrency> [browser]");
    process.exit(1);
}

// args[0]: Chuỗi các email cách nhau bởi dấu phẩy => Tách thành mảng danh sách tài khoản
const profiles = args[0].split(',');

// args[1]: Chuỗi link mời. Hỗ trợ nhiều link mời cùng lúc nếu ngăn cách bởi ký tự '|||'
const inviteUrlsRaw = args[1];
const inviteUrls = inviteUrlsRaw.split('|||').filter(Boolean);

// args[2]: Giới hạn số lượng trình duyệt mở đồng thời (mặc định = 6)
const concurrency = parseInt(args[2], 10) || 6;

// args[3]: Loại trình duyệt ('chrome' hoặc 'edge', mặc định là 'chrome')
const browserType = args[3] || 'chrome';

// Chế độ hiển thị giao diện trình duyệt: Bật true để người vận hành dễ quan sát tiến độ và xử lý phát sinh
const isHeadful = true;

log('Process', `Bắt đầu Batch Join Team. Tổng số profile: ${profiles.length}. Tổng số Link mời: ${inviteUrls.length}`);

// BIẾN ĐIỀU KHIỂN TIẾN TRÌNH TOÀN CỤC:
let runningIndex = 0; // Biến đếm dùng để tính toạ độ xếp cửa sổ thông minh (Smart Window Positioning)
let isPaused = false; // Cờ đánh dấu tiến trình đang bị tạm dừng từ giao diện UI
let isStopped = false; // Cờ đánh dấu người dùng đã bấm nút DỪNG HẲN (Hủy quy trình)

/**
 * LẮNG NGHE LỆNH ĐIỀU KHIỂN TỪ WEB UI (Gửi qua IPC channel):
 */
process.on('message', (msg) => {
    if (msg && msg.cmd === 'pause') {
        isPaused = true;
        log('Process', 'Đã Tạm Dừng batch. Các cửa sổ đang mở vẫn giữ nguyên.');
    } else if (msg && msg.cmd === 'resume') {
        isPaused = false;
        log('Process', 'Đã Tiếp Tục chạy batch.');
    } else if (msg && msg.cmd === 'stop') {
        isStopped = true;
        isPaused = false;
        log('Process', 'Nhận lệnh HỦY B4. Đang đóng tiến trình...');
        // Thoát tiến trình ngay lập tức
        process.exit(0);
    }
});

/**
 * Hàm waitIfPaused: Treo tạm thời luồng xử lý nếu người dùng đang kích hoạt chế độ Tạm Dừng.
 */
async function waitIfPaused() {
    while (isPaused && !isStopped) {
        await sleep(1000);
    }
}

/**
 * Hàm joinTeam: Thực hiện toàn bộ quy trình đưa 1 tài khoản (Profile) tham gia vào (các) Team Postman.
 * 
 * @param {string} email - Địa chỉ email của tài khoản cần thao tác.
 * @returns {Promise<{email: string, status: string}>} - Kết quả tham gia từng link.
 */
async function joinTeam(email) {
    // Kiểm tra xem hệ thống có đang bị tạm dừng không trước khi mở trình duyệt mới
    await waitIfPaused();

    // Lấy cấu hình đường dẫn file Chrome và thư mục dữ liệu cá nhân của email này
    const { executablePath, userDataDir: profilePath } = getBrowserConfig(browserType, email);

    // THUẬT TOÁN XẾP CỬA SỔ THÔNG MINH (Smart Window Positioning):
    // Đảm bảo các cửa sổ mở ra dàn đều trên màn hình theo dạng bảng cờ ca-rô
    const currentIndex = runningIndex++;
    const columns = Math.ceil(Math.sqrt(concurrency));
    const winX = (currentIndex % columns) * 350;
    const winY = Math.floor(currentIndex / columns) * 250;

    log('Process', `Đang mở trình duyệt cho ${email} (Tọa độ: X=${winX}, Y=${winY})...`);

    let browser;
    try {
        // KHỞI ĐỘNG TRÌNH DUYỆT VỚI CÁC CỜ CHỐNG PHÁT HIỆN BOT:
        browser = await puppeteer.launch({
            executablePath: executablePath,
            userDataDir: profilePath,
            headless: !isHeadful ? "new" : false,
            ignoreDefaultArgs: ['--enable-automation'], // Xoá cảnh báo "Chrome đang bị điều khiển tự động"
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--window-size=1024,768',
                `--window-position=${winX},${winY}`, // Đặt cửa sổ vào vị trí toạ độ đã tính
                '--no-errdialogs',
                '--hide-crash-restore-bubble', // Ẩn bong bóng hỏi khôi phục tab sau khi tắt đột ngột
                '--disable-blink-features=AutomationControlled' // Che giấu thuộc tính navigator.webdriver
            ],
            defaultViewport: null
        });

        const page = await browser.newPage();
        const results = [];

        // VÒNG LẶP DUYỆT QUA DANH SÁCH CÁC LINK MỜI:
        for (let i = 0; i < inviteUrls.length; i++) {
            await waitIfPaused();
            if (isStopped) break;

            const inviteUrl = inviteUrls[i];
            log('Process', `${email} - Link ${i + 1}/${inviteUrls.length}: Đang truy cập liên kết mời...`);

            // Điều hướng tới link mời. Đặt thời gian chờ tối đa 60 giây
            await page.goto(inviteUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            }).catch(() => { });

            let loopCount = 0;
            // Số lần lặp tối đa: 60 lần x 2 giây = 120 giây tối đa cho một link mời
            let maxLoops = 60;
            let joined = false;
            let status = 'Fail';
            let loginAttempted = false;

            // =================================================================================
            // CƠ CHẾ MÁY TRẠNG THÁI (STATE MACHINE):
            // Thay vì dùng các lệnh chờ tuyến tính dễ bị kẹt, vòng lặp này quét liên tục mỗi 2s
            // để nhận diện chính xác giao diện hiện tại của trang và hành động tương ứng.
            // =================================================================================
            while (loopCount < maxLoops && !isStopped) {
                await waitIfPaused();
                loopCount++;
                await sleep(2000); // Nghỉ 2 giây giữa các chu kỳ kiểm tra

                try {
                    const currentUrl = page.url();

                    // TRƯỜNG HỢP 1: Bị chặn do gửi yêu cầu quá nhanh (HTTP 429 Rate Limit)
                    const isRateLimited = await checkRateLimit(page, log, email);
                    if (isRateLimited) {
                        log('Warn', `${email} - Bị Rate Limit, tạm nghỉ 3 phút để hệ thống gỡ chặn IP...`);
                        await sleep(180000); // Tạm dừng 180,000ms = 3 phút
                        await page.reload({ waitUntil: 'domcontentloaded' });
                        continue;
                    }

                    // TRƯỜNG HỢP 2: Lỗi link hỏng hoặc không tồn tại (HTTP 404)
                    const is404 = await check404(page, log, email);
                    if (is404) {
                        status = '404 Not Found';
                        log('Err', `${email} - Link mời hỏng hoặc đã bị thu hồi. Bỏ qua link này ngay!`);
                        break; // Dừng kiểm tra link này ngay lập tức để chuyển sang link kế
                    }

                    // TRƯỜNG HỢP 3: Màn hình lỗi sập máy chủ Postman (Lỗi con chó - Error 500)
                    const isDog = await checkAndHandleDogError(page, log, email);
                    if (isDog) {
                        // Đã tự động F5, bỏ qua phần còn lại để chu kỳ sau kiểm tra lại
                        continue;
                    }

                    // TRƯỜNG HỢP 4: Rào cản Cloudflare Turnstile / Captcha
                    const isCaptcha = await checkAndHandleCaptcha(page, log, email);
                    if (isCaptcha) {
                        // Đang chờ Cloudflare tự xác thực
                        continue;
                    }

                    // TRƯỜNG HỢP 5: Màn hình Chọn Tài Khoản (Account Switcher)
                    // Postman nhận diện máy có nhiều tài khoản và bắt chọn tài khoản đang dùng
                    const accountCardFound = await page.evaluate((emailStr) => {
                        const elements = Array.from(document.querySelectorAll('*'));
                        // Tìm thẻ văn bản nhỏ nhất chứa đúng địa chỉ email cần đăng nhập
                        const emailEl = elements.find(el => el.textContent && el.textContent.includes(emailStr) && el.children.length === 0);
                        if (emailEl) {
                            // Dò ngược lên các thẻ cha để tìm thẻ bấm được (cursor pointer hoặc có onclick)
                            let parent = emailEl.parentElement;
                            while (parent && parent.tagName !== 'BODY') {
                                if (window.getComputedStyle(parent).cursor === 'pointer' || parent.onclick) {
                                    parent.click();
                                    return true;
                                }
                                parent = parent.parentElement;
                            }
                            // Nếu không tìm thấy thẻ cha có pointer, click trực tiếp vào chính thẻ chứa text
                            emailEl.click();
                            return true;
                        }
                        return false;
                    }, email);

                    if (accountCardFound) {
                        log('Process', `${email} - Đã click chọn tài khoản hiện tại ở màn hình Chọn Tài Khoản. Đợi tải trang...`);
                        await sleep(3000);
                        continue;
                    }

                    // TRƯỜNG HỢP 6: Màn hình Yêu Cầu Đăng Nhập Lại (Re-authentication)
                    // URL thường có dạng /login hoặc identity.getpostman.com (ngoại trừ /accounts)
                    if (currentUrl.includes('/login') || (currentUrl.includes('identity.getpostman.com') && !currentUrl.includes('/accounts'))) {
                        // Nếu đã submit form login trước đó nhưng trang vẫn quay lại login/authchooser,
                        // kiểm tra xem tài khoản đã được xác thực vào Workspace/Home chưa
                        if (loginAttempted) {
                            log('Process', `${email} - Đã gửi form login trước đó. Đang kiểm tra trạng thái thành viên qua go.postman.co/home...`);
                            await page.goto('https://go.postman.co/home', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                            await sleep(3000);
                            const homeUrl = page.url();
                            if (homeUrl.includes('/home') || homeUrl.includes('/workspace')) {
                                log('Output', `${email} - Đã xác nhận tài khoản đang trong Workspace (${homeUrl}). Tham gia Team thành công!`);
                                joined = true;
                                status = 'OK';
                                break;
                            }
                            // Nếu vẫn chưa vào workspace, quay lại invite link
                            await page.goto(inviteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
                            await sleep(2000);
                        }

                        log('Process', `${email} - Đang ở trang đăng nhập. Tiến hành tự động đăng nhập...`);
                        // Gọi hàm performLogin trong postman_utils.mjs để tự điền form và submit
                        await performLogin(page, email, log);
                        loginAttempted = true;
                        await sleep(3000);

                        const afterLoginUrl = page.url();
                        if (afterLoginUrl.includes('/home') || afterLoginUrl.includes('/workspace')) {
                            log('Output', `${email} - Đã có mặt tại màn hình Home/Workspace sau khi đăng nhập!`);
                            joined = true;
                            status = 'OK';
                            break;
                        }
                        continue;
                    }

                    // TRƯỜNG HỢP 7: Tìm thấy Nút "Join Team" hoặc "Accept" (Mục tiêu cốt lõi)
                    const joinBtnFound = await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
                        // Tìm nút bấm có nhãn chứa chữ "Join Team" hoặc "Accept"
                        const joinBtn = buttons.find(b => {
                            const txt = (b.innerText || '').toLowerCase();
                            return txt.includes('join team') || txt.includes('accept');
                        });

                        // Kiểm tra nút phải hiển thị trên màn hình (offsetParent !== null là phần tử đang hiển thị)
                        if (joinBtn && joinBtn.offsetParent !== null) {
                            joinBtn.click();
                            return true;
                        }
                        return false;
                    });

                    if (joinBtnFound) {
                        log('Output', `${email} - Đã click nút [Join Team] thành công!`);
                        // Đợi 5 giây để Postman cập nhật dữ liệu thành viên và chuyển hướng
                        await sleep(5000);
                        joined = true;
                        status = 'OK';
                        break; // Đã hoàn thành mục tiêu cho link này, thoát vòng lặp
                    }

                    // TRƯỜNG HỢP 8: Đã nằm trong màn hình Không gian làm việc (Home / Workspace)
                    // Nghĩa là tài khoản đã là thành viên của Team này từ trước hoặc vừa được tự động chuyển vào
                    if (currentUrl.includes('/home') || currentUrl.includes('/workspace')) {
                        log('Output', `${email} - Đã có mặt tại màn hình Home/Workspace. Xong link này!`);
                        joined = true;
                        status = 'OK';
                        break;
                    }

                    // Báo cáo định kỳ mỗi 10 giây (cứ 5 vòng lặp = 10s) để người dùng biết script vẫn đang theo dõi
                    if (loopCount % 5 === 0) {
                        log('Process', `${email} - Link ${i + 1}: Đang chờ chuyển trang hoặc load UI (URL: ${currentUrl})...`);
                    }

                } catch (e) {
                    log('Err', `${email} - Lỗi trong lúc theo dõi trang: ${e.message}`);
                }
            } // Kết thúc vòng lặp theo dõi 120s

            // Nếu hết thời gian mà chưa gia nhập được
            if (!joined && status === 'Fail') {
                log('Warn', `${email} - Hết thời gian chờ (120s) mà chưa join thành công Link ${i + 1}.`);
            }

            // Ghi nhận kết quả của link này vào mảng kết quả
            results.push(`L${i + 1}: ${status}`);
        }

        log('Process', `${email} - Đã xử lý xong tất cả các links. Chờ 5s trước khi đóng browser...`);
        await sleep(5000);
        await browser.close();
        return { email, status: results.join(', ') };

    } catch (e) {
        log('Err', `Thất bại khi xử lý profile ${email}: ${e.message}`);
        if (browser) await browser.close();
        return { email, status: 'Error' };
    }
}

/**
 * Hàm runBatch: Bộ quản lý hàng đợi đa luồng song song (Concurrency Worker Pool).
 * 
 * NGUYÊN LÝ HOẠT ĐỘNG:
 *   - Tạo ra `concurrency` công nhân (workers) chạy độc lập.
 *   - Các worker cùng chia sẻ một biến chỉ mục `index`.
 *   - Khi một worker làm xong tài khoản của mình, nó sẽ lấy email tiếp theo từ mảng để chạy,
 *     giúp tận dụng 100% tài nguyên CPU/RAM mà không làm nghẽn hàng đợi.
 */
async function runBatch() {
    let index = 0;
    const results = [];

    // Hàm worker lấy việc liên tục
    async function worker() {
        while (index < profiles.length && !isStopped) {
            const email = profiles[index++];
            if (!email) continue;
            const res = await joinTeam(email);
            results.push(res);
        }
    }

    // Khởi tạo danh sách các worker song song dựa vào cấu hình concurrency (mặc định = 6)
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
        workers.push(worker());
    }

    // Chờ tất cả các worker hoàn thành nhiệm vụ
    await Promise.all(workers);
    log('Output', 'Hoàn tất toàn bộ quy trình Batch Join!', results);
}

// KHỞI ĐỘNG TIẾN TRÌNH:
runBatch().catch(e => {
    log('Err', 'Lỗi nghiêm trọng trong Batch Join: ' + e.message);
    process.exit(1);
});
