const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
    console.log("Starting Chrome...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--user-data-dir=/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc'
        ]
    });

    const page = await browser.newPage();
    
    // Log all requests
    page.on('request', request => {
        if (!request.url().includes('amplitude.com') && !request.url().includes('launchdarkly.com')) {
            console.log('REQ:', request.method(), request.url());
            if (request.method() === 'POST' && request.postData()) {
                console.log('BODY:', request.postData().substring(0, 250));
            }
        }
    });

    page.on('response', response => {
        if (response.url().includes('organizations') || response.url().includes('team')) {
            console.log('RES:', response.url(), response.status());
        }
    });

    console.log("Navigating to settings/me/team...");
    await page.goto('https://hunggreen0001-4920165.postman.co/settings/me/team', { waitUntil: 'domcontentloaded' });
    
    console.log("Waiting for 8 seconds...");
    await new Promise(r => setTimeout(r, 8000));
    
    console.log("Evaluating buttons...");
    const clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a, .btn'));
        const addBtn = btns.find(b => b.innerText.includes('Create Team'));
        if (addBtn) {
            addBtn.click();
            return true;
        }
        return false;
    });
    
    if (clicked) {
        console.log("Clicked 'Create Team' from DOM!");
    } else {
        console.log("Could not find 'Create Team' in DOM");
    }

    // Wait a bit more to see if it redirects or makes a request
    await new Promise(r => setTimeout(r, 10000));
    console.log("Final URL:", page.url());

    await browser.close();
})();
