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
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('_api/ws/proxy') && request.method() === 'POST') {
            const postData = request.postData();
            if (postData) {
                // Log all proxy POST payloads so we don't miss anything!
                console.log(`[PROXY_PAYLOAD] ${postData}`);
            }
        }
        request.continue();
    });

    console.log('Navigating to team add billing...');
    await page.goto('https://interstellar-flare-9477016.postman.co/billing/add-team', { waitUntil: 'networkidle2', timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('Clicking Upgrade button...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        const trialBtn = buttons.find(b => b.innerText.toLowerCase().includes('trial') || b.innerText.toLowerCase().includes('upgrade'));
        if (trialBtn) trialBtn.click();
    });

    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Looking for Start Trial button in modal...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        buttons.forEach(b => console.log('Modal btn:', b.innerText.trim()));
        const startBtn = buttons.find(b => b.innerText.toLowerCase().includes('start') && b.innerText.toLowerCase().includes('trial'));
        if (startBtn) {
            console.log('Clicking Start Trial in modal!');
            startBtn.click();
        } else {
            console.log('Start Trial button not found in modal.');
        }
    });

    await new Promise(r => setTimeout(r, 8000));
    await browser.close();
    console.log('Done.');
})();
