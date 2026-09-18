import puppeteer from '/media/dev/Data/_Dev/05_Projects/personal/_postman_endpoint/Research/_postman_edge_manager/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer.js';

(async () => {
    console.log("Starting Puppeteer...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log("Browser launched. Opening page...");
    const page = await browser.newPage();
    
    console.log("Navigating to Postman login...");
    await page.goto('https://identity.getpostman.com/login', { waitUntil: 'networkidle2' });
    
    console.log("Page loaded. Title:", await page.title());
    
    // Check if we reached the login page or got blocked
    const content = await page.content();
    if (content.includes("Cloudflare") || content.includes("Just a moment...")) {
        console.log("Blocked by Cloudflare/CAPTCHA.");
    } else {
        console.log("Login page seems accessible.");
    }
    
    await browser.close();
})();
