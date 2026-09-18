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
    
    let apiEndpoint = null;
    let apiPostData = null;
    page.on('request', request => {
        const url = request.url();
        if (request.method() === 'POST' || request.method() === 'DELETE' || request.method() === 'PUT') {
            if (url.includes('postman.co') && !url.includes('events') && !url.includes('stats')) {
                const data = request.postData();
                if (data && (data.includes('leave') || data.includes('delete') || url.includes('organization') || url.includes('leave'))) {
                    console.log("-------------------");
                    console.log("Intercepted Request:");
                    console.log("Method:", request.method());
                    console.log("URL:", url);
                    console.log("Data:", data);
                    console.log("-------------------");
                    fs.appendFileSync('leave_api_log.txt', `URL: ${url}\nMethod: ${request.method()}\nData: ${data}\n\n`);
                }
            }
        }
    });

    console.log("Navigating to me/account...");
    await page.goto('https://go.postman.co/settings/me/account', { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 5000));
    
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
        
        // Find team name from the h2 or strong tag in modal
        const teamNameEl = await page.$('h1, h2, h3'); // "Leave and delete interstellar-flare-9477016 team?"
        let teamName = "interstellar-flare-9477016"; // fallback
        if (teamNameEl) {
            const headingText = await page.evaluate(e => e.innerText, teamNameEl);
            console.log("Heading text:", headingText);
            const match = headingText.match(/Leave and delete (.+) team\?/i) || headingText.match(/Leave (.+)\?/i);
            if (match && match[1]) {
                teamName = match[1].trim();
                console.log("Extracted team name:", teamName);
            }
        }

        console.log("Selecting 'Delete workspaces' radio button...");
        const radios = await page.$$('input[type="radio"]');
        if (radios.length > 1) {
            await radios[1].click(); // Click the second radio button (Delete workspaces)
        }

        console.log("Typing team name into input...");
        const input = await page.$('input[type="text"]');
        if (input) {
            await input.type(teamName);
        }

        await new Promise(r => setTimeout(r, 1000));
        await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/filled_modal.png' });

        console.log("Clicking confirm button...");
        const modalBtns = await page.$$('button');
        for(let btn of modalBtns) {
            const text = await page.evaluate(e => e.innerText, btn);
            if (text && (text.trim().toLowerCase().includes('leave') || text.trim().toLowerCase().includes('delete'))) {
                console.log("Clicking:", text);
                await btn.click();
                break;
            }
        }
        
        console.log("Waiting for API requests to complete...");
        await new Promise(r => setTimeout(r, 8000));
        await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/after_confirm.png', fullPage: true });
    } else {
        console.log("No 'Leave' button found.");
    }

    console.log("Done.");
    await browser.close();
})();
