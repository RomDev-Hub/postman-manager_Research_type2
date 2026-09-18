/**
 * =========================================================================================
 * FILE: postman_utils.mjs
 * MỤC ĐÍCH:
 *   Bộ thư viện hàm tiện ích (Utility Module) dùng chung cho toàn bộ các kịch bản tự động hoá Postman
 *   (b2_batch_login, b4_join_team, v.v.).
 *   Module này đóng gói các tác vụ hay lặp lại:
 *     1. Dừng luồng xử lý không chặn (Non-blocking async sleep).
 *     2. Tự động điền thông tin đăng nhập và vượt rào cản form (React Synthetic Events).
 *     3. Tự động phát hiện và xử lý lỗi sập máy chủ Postman ("Màn hình lỗi Con Chó" - Error 500).
 *     4. Tự động phát hiện và chờ đợi trang bảo vệ Captcha / Cloudflare ("Just a moment...").
 *     5. Nhận diện trang lỗi 404 (Link mời hết hạn hoặc không tồn tại).
 *     6. Nhận diện lỗi Rate Limit (HTTP 429) và cơ chế tạm dừng giải phóng IP.
 * =========================================================================================
 */

/**
 * Hàm sleep: Trì hoãn thực thi một khoảng thời gian mà không làm treo tiến trình Node.js (Non-blocking).
 * 
 * @param {number} ms - Thời gian cần tạm dừng tính bằng mili-giây (milliseconds). 1000ms = 1 giây.
 * @returns {Promise<void>} - Trả về một Promise giải quyết sau khi hết thời gian `ms`.
 * 
 * GIẢI THÍCH CHI TIẾT:
 *   - Sử dụng kết hợp giữa cú pháp `Promise` và `setTimeout` trong JavaScript Event Loop.
 *   - Khi gọi `await sleep(3000)`, JavaScript sẽ nhường CPU cho các tác vụ khác và quay lại sau 3 giây.
 *   - Tuyệt đối không dùng vòng lặp rỗng kiểu `while(new Date() < end)` vì sẽ gây nghẽn 100% CPU.
 */
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Hàm performLogin: Tự động hoá quy trình điền form đăng nhập Postman và nhấn Submit an toàn.
 * 
 * @param {import('puppeteer-core').Page} page - Đối tượng trang Puppeteer đang thao tác với trình duyệt.
 * @param {string} email - Địa chỉ email tài khoản Postman cần đăng nhập (VD: 'user123@maildrop.cc').
 * @param {Function} log - Hàm log đa luồng dùng để truyền thông tin về Server qua IPC hoặc in ra Console.
 *                         Cú pháp gọi: `log(tag, message, [data])`
 * @returns {Promise<void>}
 * 
 * CÁC BƯỚC THỰC HIỆN CHI TIẾT & CƠ CHẾ VƯỢT RÀO:
 *   1. Thử tối đa 3 lần (`maxAttempts = 3`) nếu gặp trục trặc mạng hoặc kẹt trang.
 *   2. Điền trường Email (#username):
 *      - Sử dụng mẹo can thiệp Prototype Setter của HTMLInputElement để kích hoạt sự kiện
 *        input trong React (React Synthetic Events). Nếu chỉ gán `.value = ...`, React state sẽ không nhận!
 *   3. Điền trường Mật khẩu (#password):
 *      - Mật khẩu mặc định trong hệ thống này là 'Pass@0909'.
 *      - Dùng cơ chế kích hoạt sự kiện tương tự để React cập nhật form state.
 *   4. Chờ 12 giây:
 *      - ĐÂY LÀ ĐẶC ĐIỂM CHỐNG BOT QUAN TRỌNG: Hệ thống bảo mật Postman đo lường thời gian từ lúc
 *        điền form đến lúc click nút. Nếu click quá nhanh (< 2s), sẽ bị nhận diện là Bot hoặc
 *        nút Sign-in chưa kích hoạt trạng thái enable. Do đó chờ 12s là bắt buộc.
 *   5. Click nút Đăng nhập (#sign-in-btn):
 *      - Tìm nút bấm và gọi `btn.click()` thông qua `page.evaluate()` trực tiếp trong ngữ cảnh DOM.
 *   6. Theo dõi điều hướng URL trong 15 giây:
 *      - Liên tục kiểm tra URL xem đã chuyển ra khỏi màn hình `/login` hoặc `identity.getpostman.com` chưa.
 *      - Nếu sau 15s URL vẫn kẹt lại, tiến hành F5 reload để thử lại lần tiếp theo.
 */
export async function performLogin(page, email, log) {
    // Biến cờ đánh dấu đã đăng nhập thành công hay chưa
    let loginSuccess = false;
    // Biến đếm số lần đã thử đăng nhập
    let attempts = 0;
    // Giới hạn số lần thử tối đa để tránh lặp vô tận khi tài khoản bị khoá
    const maxAttempts = 3;

    // Vòng lặp thử lại tối đa 3 lần
    while (!loginSuccess && attempts < maxAttempts) {
        attempts++;
        log('Warn', `${email} - Đang cố gắng tự động điền thông tin đăng nhập (Lần thử ${attempts}/${maxAttempts})...`);

        try {
            log('Process', `${email} - Đang tìm ô nhập email (#username)...`);
            // Chờ selector #username xuất hiện trong DOM tối đa 15 giây (15000ms)
            await page.waitForSelector('#username', { timeout: 15000 }).catch(() => { });
            const usernameEl = await page.$('#username');

            if (usernameEl) {
                const currentUser = await page.evaluate(el => el.value, usernameEl).catch(() => '');
                if (!currentUser || currentUser !== email) {
                    log('Process', `${email} - Đang điền email...`);
                    // Can thiệp sâu vào DOM để giả lập hành vi người dùng nhập văn bản thật cho React Input
                    await page.evaluate((val) => {
                        const el = document.querySelector('#username');
                        if (el && !el.disabled) {
                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                            setter.call(el, val);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }, email);
                } else {
                    log('Process', `${email} - Ô email đã sẵn sàng: ${currentUser}`);
                }

                log('Process', `${email} - Đang tìm ô nhập mật khẩu (#password)...`);
                // Chờ selector #password xuất hiện trong DOM tối đa 2 giây
                await page.waitForSelector('#password', { timeout: 2000 }).catch(() => { });
                const pwdEl = await page.$('#password');

                if (pwdEl) {
                    // Mật khẩu cố định của hệ sinh thái tài khoản thử nghiệm
                    const pwd = 'Pass@0909';
                    log('Process', `${email} - Đang điền mật khẩu...`);
                    await page.evaluate((val) => {
                        const el = document.querySelector('#password');
                        if (el) {
                            // Gán giá trị bằng Prototype Setter chuẩn
                            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                            setter.call(el, val);
                            // Bắn sự kiện input & change cho React
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }, pwd);

                    // CHỜ ĐỢI CLOUDFLARE TURNSTILE XÁC THỰC:
                    // Postman form có token bảo mật [name="cf-turnstile-response"].
                    // Bắt buộc phải chờ Turnstile sinh token thành công trước khi click Submit
                    log('Process', `${email} - Đang chờ Cloudflare Turnstile xác thực và tạo mã bảo mật...`);
                    let turnstileReady = false;
                    for (let t = 0; t < 15; t++) {
                        const token = await page.evaluate(() => {
                            const el = document.querySelector('[name="cf-turnstile-response"]');
                            return el ? el.value : '';
                        }).catch(() => '');
                        if (token && token.length > 20) {
                            turnstileReady = true;
                            log('Process', `${email} - Turnstile đã cấp token bảo mật (length: ${token.length}). Nút Đăng nhập đã sẵn sàng!`);
                            break;
                        }
                        // Nếu có iframe checkbox xác thực tương tác, click hỗ trợ
                        const cfFrame = page.frames().find(f => f.url().includes('challenges.cloudflare.com'));
                        if (cfFrame) {
                            try {
                                const frameEl = await cfFrame.frameElement();
                                const box = await frameEl?.boundingBox();
                                if (box) {
                                    await page.mouse.click(box.x + 28, box.y + (box.height / 2));
                                }
                            } catch (e) {}
                        }
                        await sleep(1000);
                    }

                    log('Process', `${email} - Đang tìm nút Đăng nhập (#sign-in-btn)...`);
                    await page.waitForSelector('#sign-in-btn', { timeout: 3000 }).catch(() => { });
                    const btn = await page.$('#sign-in-btn');

                    if (btn) {
                        log('Process', `${email} - Đã tìm thấy nút Đăng nhập. Tiến hành CLICK...`);
                        try {
                            // Thử click bằng CDP mouse click trước để kích hoạt sự kiện thật
                            await page.click('#sign-in-btn').catch(async () => {
                                await page.evaluate(() => {
                                    const b = document.querySelector('#sign-in-btn');
                                    if (b) b.click();
                                });
                            });
                            log('Process', `${email} - Thực hiện thao tác CLICK thành công. Đang chờ mạng phản hồi...`);
                            await sleep(3000);
                        } catch (clickErr) {
                            log('Warn', `${email} - Click nút đăng nhập bị lỗi: ${clickErr.message}`);
                        }
                    } else {
                        log('Warn', `${email} - KHÔNG TÌM THẤY nút Đăng nhập!`);
                    }
                } else {
                    log('Warn', `${email} - Không tìm thấy ô nhập mật khẩu!`);
                }
            } else {
                log('Warn', `${email} - Không tìm thấy ô nhập email!`);
            }

            // VÒNG LẶP THEO DÕI ĐỔI URL (15 GIÂY):
            // Kiểm tra xem trình duyệt đã chuyển tiếp từ màn hình đăng nhập sang ứng dụng chưa
            let urlChanged = false;
            for (let j = 0; j < 15; j++) {
                await sleep(1000); // Kiểm tra mỗi giây 1 lần
                let currentUrlCheck = '';
                try {
                    currentUrlCheck = page.url();
                } catch (e) { }

                // Cứ mỗi 5 giây ghi nhận log trạng thái URL một lần
                if (j % 5 === 0) {
                    log('Process', `${email} - Đang kiểm tra URL (giây ${j}): ${currentUrlCheck}`);
                }

                // Nhận diện xem URL hiện tại có chuyển sang màn hình đích chưa
                const isSuccessUrl = currentUrlCheck.includes('/web-invite-accept') ||
                    currentUrlCheck.includes('/home') ||
                    currentUrlCheck.includes('/workspace') ||
                    currentUrlCheck.includes('/accounts') ||
                    (currentUrlCheck.includes('postman.co') && !currentUrlCheck.includes('/login'));

                const isStillLoginScreen = (currentUrlCheck.includes('/login') || currentUrlCheck.includes('/authchooser')) &&
                    !currentUrlCheck.includes('/web-invite-accept');

                if (isSuccessUrl || (!isStillLoginScreen && currentUrlCheck)) {
                    urlChanged = true;
                    break;
                }
            }

            if (urlChanged) {
                loginSuccess = true;
                log('Output', `${email} - Đã hoàn tất gửi thông tin đăng nhập thành công!`);
                break; // Thoát khỏi vòng lặp thử lại
            } else {
                log('Warn', `${email} - Sau 15s URL vẫn ở màn hình cũ. Tiếp tục chu kỳ tiếp theo...`);
                break;
            }
        } catch (e) {
            log('Err', `${email} - Lỗi trong quá trình thao tác đăng nhập: ${e.message}`);
        }
    }
}

/**
 * Hàm checkAndHandleDogError: Phát hiện và khắc phục lỗi sập máy chủ Postman.
 * (Cộng đồng thường gọi là "Lỗi màn hình con chó" vì trang lỗi 500 của Postman vẽ hình chú chó du hành vũ trụ bị hỏng tàu).
 * 
 * @param {import('puppeteer-core').Page} page - Trang Puppeteer hiện tại.
 * @param {Function} log - Hàm gửi bản ghi log.
 * @param {string} profileName - Tên hoặc Email của Profile để hiển thị trên log.
 * @returns {Promise<boolean>} - Trả về `true` nếu phát hiện lỗi và đã bấm F5, ngược lại trả về `false`.
 */
export async function checkAndHandleDogError(page, log, profileName = "Profile") {
    try {
        // Lấy toàn bộ văn bản hiển thị trong thẻ body của trang
        const text = await page.evaluate(() => document.body ? document.body.innerText : '');

        // Quét các từ khoá đặc trưng của trang lỗi 500 Postman
        if (text && (
            text.includes('Something went wrong') ||
            text.includes('500 Internal Server Error') ||
            text.includes('Error 500') ||
            text.includes('An unexpected error occurred')
        )) {
            log('Warn', `${profileName} - Phát hiện lỗi hệ thống (Màn hình con chó). Tiến hành tải lại trang (F5)...`);
            // Thực hiện tải lại trang để Postman phân bổ sang node máy chủ hoạt động
            await page.reload({ waitUntil: 'domcontentloaded' });
            await sleep(3000); // Chờ 3 giây để trang ổn định
            return true;
        }
    } catch (e) {
        // Bỏ qua lỗi nếu trang đang trong trạng thái điều hướng
    }
    return false;
}

/**
 * Hàm checkAndHandleCaptcha: Tự động phát hiện và TỰ ĐỘNG CLICK VƯỢT RÀO Cloudflare Turnstile / Captcha.
 * 
 * @param {import('puppeteer-core').Page} page - Trang Puppeteer hiện tại.
 * @param {Function} log - Hàm gửi log.
 * @param {string} profileName - Email hoặc Tên Profile.
 * @returns {Promise<boolean>} - Trả về `true` nếu phát hiện trang Captcha, `false` nếu trang bình thường.
 * 
 * TẠI SAO TRƯỚC ĐÂY PHẢI CHỜ VÀ GIỜ CẦN TỰ CLICK?
 *   - Trước đây: Một số rào chắn Cloudflare là dạng "Silent Challenge" (sau 5-10s tự chuyển trang nếu cookie sạch).
 *   - Hiện tại: Postman / Cloudflare đã kích hoạt dạng "Interactive Managed Challenge" (Turnstile),
 *     hiển thị ô vuông `[ ] Verify you are human`. Nếu không click vào ô này thì đứng chờ bao lâu cũng KHÔNG QUA ĐƯỢC!
 *   - Cơ chế mới:
 *       1. Phát hiện màn hình xác thực (Tiêu đề hoặc nội dung chứa 'Verify you are human', 'Performing security verification').
 *       2. Tìm Iframe chứa Widget Cloudflare Turnstile (`challenges.cloudflare.com`).
 *       3. Tự động tính toán toạ độ hộp kiểm `[ ]` và dùng chuột Puppeteer (`page.mouse.click`) click thẳng vào ô.
 *       4. Tìm trong các frame con để click thẻ checkbox trực tiếp nếu có thể.
 *       5. Chờ 3-5 giây để Cloudflare đánh dấu tích xanh và chuyển trang.
 */
export async function checkAndHandleCaptcha(page, log, profileName = "Profile") {
    try {
        const title = await page.title().catch(() => '');
        const text = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');

        if (
            title.includes('Just a moment...') ||
            text.includes('Verify you are human') ||
            text.includes('Performing security verification') ||
            text.includes('Checking if the site connection is secure')
        ) {
            log('Warn', `${profileName} - Phát hiện trang Xác Thực Cloudflare Turnstile ([ ] Verify you are human)!`);
            
            // Dừng nhẹ 1.5 giây để widget Cloudflare tải xong hoàn toàn vào DOM
            await sleep(1500);

            let clicked = false;

            // CÁCH 1: Tìm Frame challenges.cloudflare.com và lấy boundingBox
            const cfFrame = page.frames().find(f => f.url().includes('challenges.cloudflare.com'));
            if (cfFrame) {
                try {
                    const frameEl = await cfFrame.frameElement();
                    const box = await frameEl?.boundingBox();
                    if (box) {
                        const clickX = box.x + 28 + Math.floor(Math.random() * 4);
                        const clickY = box.y + (box.height / 2);
                        log('Process', `${profileName} - Đã định vị toạ độ nút checkbox Cloudflare (X=${Math.round(clickX)}, Y=${Math.round(clickY)}). Đang di chuyển chuột và CLICK...`);
                        await page.mouse.move(clickX, clickY, { steps: 15 });
                        await sleep(200);
                        await page.mouse.down();
                        await sleep(100);
                        await page.mouse.up();
                        clicked = true;
                    }
                } catch (e) {}
            }

            // CÁCH 2: Tìm trong toàn bộ các Frame con của trang
            if (!clicked) {
                for (const frame of page.frames()) {
                    try {
                        const checkbox = await frame.$('input[type="checkbox"], .ctp-checkbox-label, #challenge-stage input, #cf-stage input');
                        if (checkbox) {
                            log('Process', `${profileName} - Tìm thấy ô checkbox trong frame, đang tự động CLICK...`);
                            await checkbox.click().catch(() => {});
                            clicked = true;
                            break;
                        }
                    } catch (e) {}
                }
            }

            // CÁCH 3: Quét trực tiếp trong DOM chính nếu widget nằm cùng ngữ cảnh
            if (!clicked) {
                try {
                    await page.evaluate(() => {
                        const btn = document.querySelector('input[type="checkbox"], #challenge-stage input, .ctp-checkbox-label');
                        if (btn) btn.click();
                    });
                } catch (e) {}
            }

            if (clicked) {
                log('Process', `${profileName} - Đã CLICK vào ô xác thực! Đang chờ Cloudflare tích xanh và chuyển trang...`);
            } else {
                log('Process', `${profileName} - Đang chờ Cloudflare tự động xác minh (Managed Mode)...`);
            }

            // Chờ tối đa 8 giây để trang hoàn tất xác thực và điều hướng
            for (let i = 0; i < 8; i++) {
                await sleep(1000);
                const currentTitle = await page.title();
                const currentUrl = page.url();
                // Nếu tiêu đề không còn là 'Just a moment...' hoặc đã sang trang login / dashboard
                if (!currentTitle.includes('Just a moment...') && !currentUrl.includes('challenges.cloudflare.com')) {
                    log('Output', `${profileName} - ĐÃ VƯỢT QUA rào cản Cloudflare thành công!`);
                    return true;
                }
            }

            return true;
        }
    } catch (e) { }
    return false;
}

/**
 * Hàm check404: Kiểm tra xem link mời tham gia Team có bị lỗi 404 (Không tồn tại / Hết hạn) không.
 * 
 * @param {import('puppeteer-core').Page} page - Trang Puppeteer hiện tại.
 * @param {Function} log - Hàm gửi log.
 * @param {string} profileName - Tên Profile hoặc Email.
 * @returns {Promise<boolean>} - Trả về `true` nếu link bị lỗi 404.
 */
export async function check404(page, log, profileName = "Profile") {
    try {
        const title = await page.title();
        const text = await page.evaluate(() => document.body ? document.body.innerText : '');

        // Quét các dấu hiệu nhận diện lỗi link hỏng
        if (
            title.includes('404') ||
            text.includes('404 Not Found') ||
            text.includes('Page not found') ||
            text.includes('This invite link is invalid')
        ) {
            log('Err', `${profileName} - Lỗi 404: Link không tồn tại hoặc đã hết hạn.`);
            return true;
        }
    } catch (e) { }
    return false;
}

/**
 * Hàm checkRateLimit: Kiểm tra xem địa chỉ IP có bị Postman chặn do gửi yêu cầu quá nhanh (HTTP 429) không.
 * 
 * @param {import('puppeteer-core').Page} page - Trang Puppeteer hiện tại.
 * @param {Function} log - Hàm gửi log.
 * @param {string} profileName - Tên Profile hoặc Email.
 * @returns {Promise<boolean>} - Trả về `true` nếu bị Rate Limit.
 */
export async function checkRateLimit(page, log, profileName = "Profile") {
    try {
        const title = await page.title();
        const text = await page.evaluate(() => document.body ? document.body.innerText : '');

        // Nhận diện mã HTTP 429 hoặc các câu thông báo giới hạn lưu lượng
        if (
            title.includes('429') ||
            text.includes('Too Many Requests') ||
            text.includes('Rate-limit exceeded') ||
            text.includes('rate limit')
        ) {
            log('Err', `${profileName} - Bị chặn IP do Rate Limit (429)! Cần dừng hoạt động 3 phút...`);
            return true;
        }
    } catch (e) { }
    return false;
}
