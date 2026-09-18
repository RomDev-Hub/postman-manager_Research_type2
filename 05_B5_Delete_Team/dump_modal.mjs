import puppeteer from 'puppeteer-core';
import fs from 'fs';

const profilePath = '/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc';

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
    
    // We need to bypass login if it happens, so let's check
    console.log("Navigating to me/account...");
    await page.goto('https://go.postman.co/settings/me/account', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    
    if (page.url().includes('/login')) {
        console.log("Got redirected to login, maybe we can run b1_auto_login?");
        await browser.close();
        return;
    }

    console.log("Clicking on 'Teams' in sidebar...");
    const els = await page.$$('a');
    for(let el of els) {
        const text = await page.evaluate(e => e.innerText, el);
        if (text && text.trim() === 'Teams') {
            await el.click();
            break;
        }
    }
    
    await new Promise(r => setTimeout(r, 3000));
    
    // Look for "Leave" buttons
    const buttons = await page.$$('button');
    let leaveButton = null;
    for(let btn of buttons) {
        const text = await page.evaluate(e => e.innerText, btn);
        if (text && text.trim().toLowerCase() === 'leave') {
            leaveButton = btn;
            break;
        }
    }

    if (leaveButton) {
        console.log("Found 'Leave' button, clicking...");
        await leaveButton.click();
        await new Promise(r => setTimeout(r, 3000));
        
        // Dump the HTML of the modal
        const html = await page.content();
        fs.writeFileSync('/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/leave_modal.html', html);
        console.log("Saved leave_modal.html");
    } else {
        console.log("No 'Leave' button found.");
    }

    console.log("Done.");
    await browser.close();
})();
