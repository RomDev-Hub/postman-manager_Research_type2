import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

(async () => {
    const profilePath = '/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc';
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            `--user-data-dir=${profilePath}`,
            '--disable-dev-shm-usage'
        ]
    });

    const page = await browser.newPage();
    console.log("Navigating...");
    await page.goto("https://identity.getpostman.com/login?cta=join-team&invite_code=12a1b516aa4b1672a6c656a6a1a7d3239abeb51d2071516d39b4acbc3c9783b9&continue=https%3A%2F%2Fapp.getpostman.com%2Fweb-invite-accept%3Finvite_code%3D12a1b516aa4b1672a6c656a6a1a7d3239abeb51d2071516d39b4acbc3c9783b9", { waitUntil: 'networkidle2', timeout: 60000 });
    
    await new Promise(r => setTimeout(r, 10000)); // wait 10s for CF
    
    console.log("URL:", page.url());
    const html = await page.content();
    if (html.includes("Just a moment") || html.includes("Cloudflare")) {
        console.log("Cloudflare detected!");
    } else {
        console.log("No Cloudflare detected.");
        console.log(html.substring(0, 500));
        
        const username = await page.$('#username');
        console.log("Has #username?", !!username);
    }
    
    await browser.close();
})();
