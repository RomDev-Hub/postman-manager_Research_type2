const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-data-dir=/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log("Navigating to billing/add-team...");
    await page.goto('https://go.postman.co/billing/add-team', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await page.screenshot({ path: '/home/dev/add_team.png' });
    console.log("Saved add_team.png");
    
    await browser.close();
})();
