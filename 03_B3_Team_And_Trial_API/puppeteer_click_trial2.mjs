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
    
    // Pipe page console to node
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    // Intercept network requests
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('_api/ws/proxy') && request.method() === 'POST') {
            const postData = request.postData();
            if (postData && (postData.includes('trial') || postData.includes('billing'))) {
                console.log(`[REQUEST_PAYLOAD] ${postData}`);
            }
        }
        request.continue();
    });

    console.log('Navigating...');
    await page.goto('https://interstellar-flare-9477016.postman.co/billing/add-team', { waitUntil: 'networkidle2', timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('Taking before_click.png...');
    await page.screenshot({ path: 'before_click.png' });
    
    console.log('Clicking buttons...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        console.log('Total buttons/links found:', buttons.length);
        const trialBtn = buttons.find(b => b.innerText.toLowerCase().includes('trial') || b.innerText.toLowerCase().includes('upgrade'));
        if (trialBtn) {
            console.log('Found trial button text:', trialBtn.innerText);
            trialBtn.click();
        } else {
            console.log('Trial button not found');
            // Print out all buttons to see what's available
            buttons.forEach(b => console.log('Btn text:', b.innerText.substring(0, 50).trim()));
        }
    });

    await new Promise(r => setTimeout(r, 5000));
    console.log('Taking after_click.png...');
    await page.screenshot({ path: 'after_click.png' });
    
    await browser.close();
    console.log('Done.');
})();
