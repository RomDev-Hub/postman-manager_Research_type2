import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function run() {
    try {
        const response = await fetch('http://localhost:9222/json/version');
        const data = await response.json();
        const browser = await puppeteer.connect({ browserWSEndpoint: data.webSocketDebuggerUrl });
        const pages = await browser.pages();
        for (let i = 0; i < pages.length; i++) {
            await pages[i].screenshot({ path: `/home/dev/.gemini/antigravity-ide/brain/ce3d2167-717c-491d-8aa3-7826e98d3c1d/scratch/page_${i}.png` });
            console.log(`Saved page_${i}.png, URL: ${pages[i].url()}`);
        }
        await browser.disconnect();
    } catch (e) {
        console.error(e);
    }
}
run();
