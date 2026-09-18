import puppeteer from 'puppeteer-core';
import fs from 'fs';

const profilePath = '/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc';
const inviteLink = 'https://app.getpostman.com/join-team?invite_code=6653e86ccdac43f2a520227c0b6b4e6aaa56825343bd5b964cc19622754013a7';

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
    
    // Intercept network requests
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.url().includes('_api/ws/proxy') && request.method() === 'POST') {
            const postData = request.postData();
            if (postData) {
                console.log(`[PROXY_PAYLOAD] ${postData}`);
            }
        }
        if (request.url().includes('api/organizations') || request.url().includes('join')) {
            console.log(`[API_CALL] ${request.method()} ${request.url()}`);
            if (request.postData()) console.log(`[PAYLOAD] ${request.postData()}`);
        }
        request.continue();
    });

    console.log('Navigating to invite link...');
    await page.goto(inviteLink, { waitUntil: 'networkidle2', timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('Taking before_join.png...');
    await page.screenshot({ path: 'before_join.png' });
    
    console.log('Looking for buttons...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a'));
        buttons.forEach(b => console.log('Btn:', b.innerText.trim()));
        
        // Find join button or separate workspace
        const joinBtn = buttons.find(b => b.innerText.toLowerCase().includes('join'));
        const separateBtn = buttons.find(b => b.innerText.toLowerCase().includes('keep separate'));
        
        if (separateBtn) {
            console.log('Clicking Keep Separate...');
            separateBtn.click();
        } else if (joinBtn) {
            console.log('Clicking Join...');
            joinBtn.click();
        }
    });

    await new Promise(r => setTimeout(r, 8000));
    console.log('Taking after_join.png...');
    await page.screenshot({ path: 'after_join.png' });
    
    await browser.close();
    console.log('Done.');
})();
