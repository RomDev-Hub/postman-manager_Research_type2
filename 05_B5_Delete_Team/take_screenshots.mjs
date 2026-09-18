import puppeteer from 'puppeteer-core';

const profilePath = '/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        userDataDir: profilePath,
        headless: true, // we can use true for headless if it doesn't get blocked
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    console.log("Navigating to workspaces...");
    await page.goto('https://go.postman.co/me/workspaces', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/workspaces.png' });
    
    // Also try navigating to https://go.postman.co/settings/team
    console.log("Navigating to team settings...");
    await page.goto('https://go.postman.co/settings/team', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/team_settings_new.png' });
    
    // Also try https://go.postman.co/billing/add-ons
    console.log("Navigating to billing...");
    await page.goto('https://go.postman.co/billing/add-ons', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/billing.png' });

    console.log("Done.");
    await browser.close();
})();
