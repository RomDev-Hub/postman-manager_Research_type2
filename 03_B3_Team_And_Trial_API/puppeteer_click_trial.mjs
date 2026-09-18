import puppeteer from 'puppeteer-core';
import fs from 'fs';

const profilePath = '/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc';

(async () => {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            `--user-data-dir=${profilePath}`,
            '--disable-dev-shm-usage',
            '--window-size=1280,1024'
        ]
    });

    const page = await browser.newPage();
    
    // Intercept network requests
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('_api/ws/proxy') && request.method() === 'POST') {
            const postData = request.postData();
            if (postData) {
                console.log(`[REQUEST_PAYLOAD] ${postData}`);
            }
        } else if (request.url().includes('trial')) {
            console.log(`[TRIAL_URL] ${request.method()} ${request.url()}`);
            const postData = request.postData();
            if (postData) console.log(`[TRIAL_PAYLOAD] ${postData}`);
        }
        request.continue();
    });

    console.log('Navigating...');
    await page.goto('https://interstellar-flare-9477016.postman.co/billing/add-team', { waitUntil: 'networkidle2' });
    
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Clicking buttons...');
    // We try to find and click any button that says "Start Trial" or "Upgrade"
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const trialBtn = buttons.find(b => b.innerText.toLowerCase().includes('trial') || b.innerText.toLowerCase().includes('upgrade'));
        if (trialBtn) {
            console.log('Found trial button, clicking...');
            trialBtn.click();
        } else {
            console.log('Trial button not found');
        }
    });

    await new Promise(r => setTimeout(r, 10000));
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'trial_click_result.png' });
    await browser.close();
})();
