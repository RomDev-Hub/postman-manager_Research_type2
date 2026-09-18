import puppeteer from 'puppeteer';
import path from 'path';

const email = process.argv[2];
if (!email) {
    console.error("Please provide email");
    process.exit(1);
}
const profilePath = path.join('/home/dev/ChromeProfiles', email);

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        userDataDir: profilePath,
        headless: "new",
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    await page.goto('https://identity.getpostman.com/login', {waitUntil: 'networkidle2'});
    
    // Check if already logged in
    if (page.url().includes('/me/account') || page.url().includes('go.postman.co')) {
        console.log("Already logged in");
        await browser.close();
        return;
    }

    await page.type('#username', email);
    await page.type('#password', 'hunggreen0001');
    await page.click('#sign-in-btn');
    await page.waitForNavigation({waitUntil: 'networkidle2'});
    console.log("Logged in!");
    await browser.close();
})();
