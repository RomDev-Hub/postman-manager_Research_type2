import puppeteer from "puppeteer-core";

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--user-data-dir=/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc'
        ],
        defaultViewport: null
    });
    const page = await browser.newPage();
    
    // Enable request interception
    await page.setRequestInterception(true);
    page.on('request', req => {
        if (req.url().includes('trial') || req.url().includes('proxy')) {
            console.log(`[REQUEST] ${req.method()} ${req.url()}`);
            if(req.postData()) console.log(`Payload: ${req.postData()}`);
        }
        req.continue();
    });
    page.on('response', async res => {
        if (res.url().includes('trial') || res.url().includes('proxy')) {
            console.log(`[RESPONSE] ${res.status()} ${res.url()}`);
        }
    });

    console.log("Navigating...");
    await page.goto('https://app.getpostman.com/', { waitUntil: 'networkidle2', timeout: 60000 });
    console.log("Navigation done.");
    
    // Wait for 30s to allow us to manually see what happens or for it to redirect
    await new Promise(r => setTimeout(r, 10000));
    
    await browser.close();
})();
