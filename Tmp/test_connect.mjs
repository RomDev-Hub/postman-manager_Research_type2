import puppeteer from 'puppeteer-core';

async function run() {
    try {
        const response = await fetch('http://localhost:9222/json/version');
        const data = await response.json();
        console.log("Connecting to:", data.webSocketDebuggerUrl);
        
        const browser = await puppeteer.connect({ browserWSEndpoint: data.webSocketDebuggerUrl, defaultViewport: null });
        const page = await browser.newPage();
        
        const inviteLink = "https://app.getpostman.com/join-team?invite_code=86785a55cabfdc59ed293a8f48d257ff737db0f326dcf60a3e5486f7a24f4662";
        console.log("Navigating to invite link...");
        await page.goto(inviteLink, { waitUntil: 'networkidle2' });
        
        console.log("Current URL:", page.url());
        
        // Take a screenshot
        await page.screenshot({ path: "/home/dev/.gemini/antigravity-ide/brain/ce3d2167-717c-491d-8aa3-7826e98d3c1d/scratch/test_connect_result.png" });
        
        // Wait and see if it's the login page
        await new Promise(r => setTimeout(r, 5000));
        console.log("Current URL after 5s:", page.url());
        await page.screenshot({ path: "/home/dev/.gemini/antigravity-ide/brain/ce3d2167-717c-491d-8aa3-7826e98d3c1d/scratch/test_connect_result2.png" });
        
        // If login page, try to fill password
        if (page.url().includes('identity.getpostman.com/login')) {
            console.log("Login page detected. Attempting to fill password...");
            try {
                await page.waitForSelector('#password', { timeout: 5000 });
                await page.type('#password', 'Pass@0909');
                
                await page.evaluate(() => {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sign In'));
                    if (btn) btn.click();
                });
                
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
                console.log("Navigation complete. URL:", page.url());
            } catch (e) {
                console.error("Login failed:", e.message);
            }
        }
        
        await browser.disconnect();
    } catch (e) {
        console.error(e);
    }
}
run();
