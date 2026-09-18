import puppeteer from 'puppeteer';
import { getBrowserConfig } from './_Tool_postman_Sep17/browser_config.mjs';

(async () => {
    const { executablePath, userDataDir } = getBrowserConfig('edge');
    console.log({ executablePath, userDataDir });
    
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        userDataDir: userDataDir,
        headless: "new",
        args: [
            '--no-sandbox',
            '--profile-directory=hunggreen0001@maildrop.cc'
        ]
    });
    console.log("Launched edge!");
    await browser.close();
})();
