import puppeteer from 'puppeteer-core';

const profilePath = '/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        userDataDir: profilePath,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    
    console.log("Navigating to billing...");
    await page.goto('https://go.postman.co/billing/add-ons', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/billing.png' });

    console.log("Navigating to members...");
    await page.goto('https://go.postman.co/settings/me/members', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/members.png' });

    console.log("Done.");
    await browser.close();
})();
