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
    console.log("Navigating to workspaces...");
    await page.goto('https://go.postman.co/me/workspaces', { waitUntil: 'networkidle2' });
    
    // Click the profile icon in top right
    console.log("Clicking profile icon...");
    try {
        await page.click('div[aria-label="User Avatar"]');
    } catch(e) {
        console.log("Could not find aria-label User Avatar, trying something else", e);
        try {
             // Maybe find button with image
             const btns = await page.$$('button');
             for(let btn of btns) {
                 const inner = await page.evaluate(el => el.innerHTML, btn);
                 if (inner.includes('avatar') || inner.includes('profile')) {
                     await btn.click();
                     break;
                 }
             }
        } catch(e2) {
            console.log(e2);
        }
    }
    
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/profile_menu.png' });

    // Also let's check Team Management -> Members
    console.log("Navigating to team members...");
    await page.goto('https://go.postman.co/settings/me/members', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/team_members.png' });
    
    console.log("Done.");
    await browser.close();
})();
