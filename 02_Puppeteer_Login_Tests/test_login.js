const puppeteer = require('puppeteer-core');

(async () => {
    console.log("Starting Puppeteer...");
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log("Browser launched. Opening page...");
    const page = await browser.newPage();
    
    // Setup a custom User Agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    
    console.log("Navigating to Postman login...");
    await page.goto('https://identity.getpostman.com/login', { waitUntil: 'networkidle2' });
    
    console.log("Page loaded. Title:", await page.title());
    
    // Check for cloudflare or username field
    const content = await page.content();
    if (content.includes("Just a moment...") || content.includes("Cloudflare")) {
        console.log("Blocked by Cloudflare/CAPTCHA.");
        await browser.close();
        return;
    }
    
    console.log("Attempting to find username field...");
    try {
        await page.waitForSelector('#username', { timeout: 5000 });
        console.log("Found username field. Entering email...");
        await page.type('#username', 'hunggreen0001@maildrop.cc');
        
        await page.waitForSelector('#password', { timeout: 5000 });
        console.log("Found password field. Entering password...");
        await page.type('#password', 'Pass@0909');
        
        console.log("Clicking sign in...");
        await page.click('#sign-in-btn');
        
        console.log("Waiting for navigation after login...");
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
        
        console.log("Success! Current URL:", page.url());
        
        // Extract cookies
        const cookies = await page.cookies();
        console.log("Extracted", cookies.length, "cookies.");
        const sid = cookies.find(c => c.name === 'postman.sid');
        console.log("Session ID present:", !!sid);
        
    } catch (e) {
        console.log("Error during login sequence:", e.message);
    }
    
    await browser.close();
})();
