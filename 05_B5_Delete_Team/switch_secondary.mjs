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
    await page.goto('https://go.postman.co/me/workspaces', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    
    // Click the profile icon in top right
    console.log("Clicking profile icon...");
    try {
        await page.click('div[aria-label="User Avatar"]');
    } catch(e) {
        try {
            const btns = await page.$$('button');
            for(let btn of btns) {
                const inner = await page.evaluate(el => el.innerHTML, btn);
                if (inner.includes('avatar') || inner.includes('profile')) {
                    await btn.click();
                    break;
                }
            }
        } catch(e2) {}
    }
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Find the secondary team in the dropdown and click it
    console.log("Looking for secondary team in dropdown...");
    const teamName = "secondary-team-123";
    const els = await page.$$('div, span, button, a');
    for (let el of els) {
        const text = await page.evaluate(e => e.innerText, el);
        if (text && text.includes(teamName)) {
            console.log("Found team in dropdown, clicking...");
            await el.click();
            break;
        }
    }
    
    await new Promise(r => setTimeout(r, 5000));
    
    // Now click profile again to see if we can Leave
    console.log("Clicking profile icon again...");
    try {
        await page.click('div[aria-label="User Avatar"]');
    } catch(e) {}
    
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/after_switch_secondary.png' });

    console.log("Done.");
    await browser.close();
})();
