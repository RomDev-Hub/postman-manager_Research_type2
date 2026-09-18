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
    await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/me_teams.png', fullPage: true });

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
        console.log("Found 'Leave' button, setting up request interception and clicking...");
        
        let apiEndpoint = null;
        page.on('request', request => {
            const url = request.url();
            if (url.includes('/api/organizations') && request.method() !== 'OPTIONS' && request.method() !== 'GET') {
                console.log("Intercepted request: ", request.method(), url);
                console.log("Headers: ", request.headers());
                console.log("Post data: ", request.postData());
                apiEndpoint = url;
            }
        });

        await leaveButton.click();
        await new Promise(r => setTimeout(r, 3000));
        await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/leave_modal.png', fullPage: true });
        
        // Find the confirm "Leave" button in the modal
        const modalBtns = await page.$$('button');
        for(let btn of modalBtns) {
            const text = await page.evaluate(e => e.innerText, btn);
            if (text && (text.trim().toLowerCase().includes('leave') || text.trim().toLowerCase().includes('delete'))) {
                console.log("Clicking confirm button: ", text);
                await btn.click();
                break;
            }
        }
        
        await new Promise(r => setTimeout(r, 5000));
        await page.screenshot({ path: '/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team/after_leave.png', fullPage: true });
    } else {
        console.log("No 'Leave' button found.");
    }

    console.log("Done.");
    await browser.close();
})();
