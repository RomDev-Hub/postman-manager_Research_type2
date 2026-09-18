const puppeteer = require('puppeteer-core');
const fs = require('fs');

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
    
    // Intercept requests to sniff the team creation API
    page.on('request', request => {
        const url = request.url();
        if (request.method() === 'POST' && url.includes('team') && !url.includes('events')) {
            console.log("Intercepted POST request:", url);
            fs.appendFileSync('/home/dev/sniff_results.txt', `[POST] ${url}\n${request.postData()}\n\n`);
        }
    });

    console.log("Navigating to Settings/Team...");
    await page.goto('https://go.postman.co/settings/team', { waitUntil: 'networkidle2', timeout: 30000 });
    
    console.log("Page loaded. Title:", await page.title());
    await page.screenshot({ path: '/home/dev/settings_team.png' });
    const html = await page.content();
    fs.writeFileSync('/home/dev/settings_team.html', html);
    
    await browser.close();
})();
