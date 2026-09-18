const puppeteer = require('puppeteer-core');

(async () => {
    console.log("Starting Puppeteer with hunggreen0001 profile...");
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
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log("Navigating to Postman Web App...");
    await page.goto('https://go.postman.co/home', { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log("Page loaded. Title:", await page.title());
    
    // Save screenshot
    await page.screenshot({ path: '/home/dev/.gemini/antigravity-ide/brain/ce3d2167-717c-491d-8aa3-7826e98d3c1d/postman_dashboard.png' });
    console.log("Screenshot saved.");
    
    // Dump page HTML to analyze selectors
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('/home/dev/postman_dashboard.html', html);
    
    await browser.close();
})();
