const puppeteer = require('puppeteer');

(async () => {
    const profilePath = '/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc';
    console.log("Launching Chrome with profile:", profilePath);
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: '/usr/bin/google-chrome',
        userDataDir: profilePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ],
        defaultViewport: null,
    });

    const page = await browser.newPage();
    
    // Intercept network requests
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.method() !== 'OPTIONS' && request.method() !== 'GET') {
            console.log(`[REQ] ${request.method()} ${request.url()}`);
            if (request.postData()) {
                console.log(`[BODY] ${request.postData()}`);
            }
        }
        request.continue();
    });

    await page.goto('https://dark-station-9710368.postman.co/billing/add-team', { waitUntil: 'networkidle2' });
    
    console.log("Navigated to billing page. Waiting 10 seconds to allow you to interact (or we will try to click manually)");
    await page.waitForTimeout(5000);

    // Let's take a screenshot to see what it looks like
    await page.screenshot({ path: '/home/dev/scratch/billing_trial.png' });

    // Try to click "Start 14-day Enterprise Trial" if it exists.
    // The button might have text like "Start Trial" or "Enterprise"
    try {
        const elements = await page.$x("//button[contains(., 'Start') and contains(., 'Trial')]");
        if (elements.length > 0) {
            console.log("Found Trial button! Clicking...");
            await elements[0].click();
            await page.waitForTimeout(5000);
            await page.screenshot({ path: '/home/dev/scratch/billing_trial_after_click.png' });
        } else {
            console.log("Could not find the Start Trial button.");
        }
    } catch (e) {
        console.log("Error clicking button:", e.message);
    }

    await browser.close();
})();
