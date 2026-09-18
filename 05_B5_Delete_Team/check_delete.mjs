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
    
    console.log("Navigating to team profile...");
    await page.goto('https://go.postman.co/settings/team/profile', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    
    // Take full page screenshot
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/team_profile_full.png', fullPage: true });

    // Click on Danger Zone if it exists
    const html = await page.content();
    if (html.toLowerCase().includes('delete team')) {
        console.log("Found 'delete team' in HTML!");
    } else {
        console.log("Did not find 'delete team' in HTML.");
    }
    
    if (html.toLowerCase().includes('leave team')) {
        console.log("Found 'leave team' in HTML!");
    } else {
        console.log("Did not find 'leave team' in HTML.");
    }

    console.log("Done.");
    await browser.close();
})();
