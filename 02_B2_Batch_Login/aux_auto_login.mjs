import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Auxiliary Tool: Fallback CDP Auto Login
// Use this tool if the SQLite injection method (in B1) fails or needs backup.
// It will launch the profile and literally type out the username and password on the page.

const CHROME_PATHS = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
];

function getChromePath() {
    for (const p of CHROME_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return 'google-chrome';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runAutoLogin(email, password, profileDir, port) {
    console.log(`[+] Bắt đầu auto login qua CDP cho: ${email} trên port ${port}`);

    // Kill any existing lock
    const lockPath = path.join(profileDir, 'SingletonLock');
    if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch(e){}
    }

    const chromeProcess = spawn(getChromePath(), [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--password-store=basic',
        '--no-errdialogs',
        '--hide-crash-restore-bubble',
        'https://identity.getpostman.com/login'
    ], { detached: true, stdio: 'ignore' });

    let client;
    try {
        let retries = 5;
        while (retries > 0) {
            try {
                client = await CDP({ port });
                break;
            } catch(e) {
                retries--;
                await sleep(1000);
            }
        }

        if (!client) throw new Error("Could not connect to CDP");

        const { Page, Runtime, Input, DOM } = client;
        await Page.enable();
        await Runtime.enable();
        await DOM.enable();

        console.log(`[*] Đã kết nối CDP cho ${email}. Chờ trang load...`);

        // Wait for page load
        let isLoaded = false;
        Page.loadEventFired(() => { isLoaded = true; });
        let waitTime = 0;
        while (!isLoaded && waitTime < 15000) {
            await sleep(500);
            waitTime += 500;
        }

        // Check if already logged in (redirected to dashboard)
        const currentUrl = (await Runtime.evaluate({ expression: 'window.location.href' })).result.value;
        if (currentUrl.includes('app.getpostman.com') || currentUrl.includes('/home')) {
            console.log(`[+] Đã đăng nhập từ trước: ${email}`);
            return;
        }

        // Fill Username
        await sleep(2000);
        console.log(`[*] Đang điền username...`);
        await Runtime.evaluate({ expression: `document.querySelector('input[type="text"], input[name="username"]').value = '${email}';` });
        
        // Fill Password
        await sleep(1000);
        console.log(`[*] Đang điền password...`);
        await Runtime.evaluate({ expression: `document.querySelector('input[type="password"]').value = '${password}';` });

        // Wait for user to bypass captcha and click login, or attempt to click login automatically if no captcha
        console.log(`[*] Đã điền xong. Vui lòng quan sát. Nếu có Captcha (Cloudflare), vui lòng chờ qua vòng xoay. Kịch bản sẽ đợi đến khi URL thay đổi sang dashboard...`);
        
        let loginSuccess = false;
        for (let i = 0; i < 60; i++) {
            const urlCheck = (await Runtime.evaluate({ expression: 'window.location.href' })).result.value;
            if (urlCheck.includes('app.getpostman.com') || urlCheck.includes('/home')) {
                loginSuccess = true;
                break;
            }
            // Auto click login button if enabled and no captcha overlay blocks it
            if (i === 2) {
                try {
                    await Runtime.evaluate({ expression: `document.querySelector('button[type="submit"], #sign-in-btn').click();` });
                } catch(e) {}
            }
            await sleep(1000);
        }

        if (loginSuccess) {
            console.log(`[+] Đăng nhập thành công cho ${email}!`);
            await sleep(2000); // let it save cookies
        } else {
            console.log(`[-] Hết thời gian chờ (60s) hoặc đăng nhập thất bại cho ${email}.`);
        }
    } catch(err) {
        console.error(`[-] Lỗi ở ${email}:`, err.message);
    } finally {
        if (client) await client.close();
        try {
            process.kill(-chromeProcess.pid);
        } catch(e) {
            try { chromeProcess.kill(); } catch(e){}
        }
        await sleep(2000);
    }
}

async function main() {
    const emails = [
        "hunggreen0001@maildrop.cc", "hunggreen0002@maildrop.cc", "hunggreen0003@maildrop.cc"
    ];
    const password = "Pass@0909";
    const profilesDir = path.resolve('../ChromeProfiles');
    let port = 9100;

    for (const email of emails) {
        const profilePath = path.join(profilesDir, email);
        if (!fs.existsSync(profilePath)) fs.mkdirSync(profilePath, { recursive: true });
        
        await runAutoLogin(email, password, profilePath, port++);
    }
    console.log("[+] Đã chạy xong backup auto-login CDP.");
}

main();
