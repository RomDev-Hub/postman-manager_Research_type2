import puppeteer from 'puppeteer-core';
import fs from 'fs';

const profilePath = '/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc';

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        userDataDir: profilePath,
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    
    // Log all proxy requests
    page.on('request', request => {
        const url = request.url();
        if (url.includes('go.postman.co/_api/ws/proxy') || url.includes('identity.getpostman.com')) {
            console.log(`[REQUEST] ${request.method()} ${url}`);
            if (request.postData()) {
                console.log(`[PAYLOAD] ${request.postData()}`);
            }
        }
    });

    console.log("Navigating to dashboard...");
    await page.goto('https://go.postman.co/me/workspaces', { waitUntil: 'networkidle2' });
    console.log("Navigated. Please manually perform the 'Delete Team' action in the browser.");
    console.log("Waiting 60 seconds for you to do it...");
    
    await new Promise(r => setTimeout(r, 60000));
    
    console.log("Closing browser.");
    await browser.close();
})();
