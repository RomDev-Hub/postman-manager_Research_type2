import puppeteer from 'puppeteer-core';
import fs from 'fs';

const profilePath = '/home/dev/ChromeProfiles/hunggreen0003@maildrop.cc';
const email = 'hunggreen0003@maildrop.cc';
const password = 'HungGreen0001!';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        userDataDir: profilePath,
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800',
            '--no-errdialogs',
            '--hide-crash-restore-bubble'
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    
    console.log("Navigating to me/account...");
    await page.goto('https://go.postman.co/settings/me/account', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    
    if (page.url().includes('/login')) {
        console.log("Logging in...");
        await page.type('#username', email);
        await new Promise(r => setTimeout(r, 1000));
        await page.click('#sign-in-btn');
        await new Promise(r => setTimeout(r, 3000));
        
        const pwdInput = await page.$('#password');
        if (pwdInput) {
            await pwdInput.type(password);
            await new Promise(r => setTimeout(r, 1000));
            await page.click('#sign-in-btn');
            console.log("Waiting for login to complete (15s for Cloudflare if any)...");
            await new Promise(r => setTimeout(r, 15000));
        }
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
        fs.writeFileSync('/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/leave_modal_hunggreen0003.html', html);
        console.log("Saved leave_modal_hunggreen0003.html");
    } else {
        console.log("No 'Leave' button found.");
    }

    console.log("Done.");
    await browser.close();
})();
