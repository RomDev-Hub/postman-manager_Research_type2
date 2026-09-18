import puppeteer from 'puppeteer-core';
import fs from 'fs';

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
    
    // Check team members page
    console.log("Navigating to team members...");
    await page.goto('https://go.postman.co/settings/team/members', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/team_members.png', fullPage: true });

    // Check account page
    console.log("Navigating to me/account...");
    await page.goto('https://go.postman.co/settings/me/account', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/me_account.png', fullPage: true });

    // Check workspaces again just in case
    console.log("Navigating to workspaces...");
    await page.goto('https://go.postman.co/me/workspaces', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    const html = await page.content();
    fs.writeFileSync('/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/workspaces.html', html);

    console.log("Done.");
    await browser.close();
})();
