const puppeteer = require('puppeteer-core');

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome-stable',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--user-data-dir=/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc']
    });
    
    const page = await browser.newPage();
    await page.goto('https://go.postman.co/home', { waitUntil: 'domcontentloaded' });
    
    // Wait a bit for React to render
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const elements = await page.evaluate(() => {
        const result = [];
        document.querySelectorAll('button, a, div[role="button"]').forEach(el => {
            const text = el.innerText ? el.innerText.trim() : '';
            if (text && text.length < 50 && (text.toLowerCase().includes('team') || text.toLowerCase().includes('trial') || text.toLowerCase().includes('upgrade'))) {
                result.push({ tag: el.tagName, text: text, className: el.className, href: el.href || '' });
            }
        });
        return result;
    });
    
    console.log(JSON.stringify(elements, null, 2));
    await browser.close();
})();
