import puppeteer from 'puppeteer-core';
const profilePath = '/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        userDataDir: profilePath,
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://go.postman.co/home', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 10000));
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/hunggreen0001_home.png', fullPage: true });
    console.log("Current URL:", page.url());
    const html = await page.content();
    if (html.toLowerCase().includes('sign in')) {
        console.log("Status: Logged out");
    } else {
        console.log("Status: Logged in");
    }
    await browser.close();
})();
