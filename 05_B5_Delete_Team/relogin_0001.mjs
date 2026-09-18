import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const email = 'hunggreen0001@maildrop.cc';
const password = 'HungGreen0001!';
const profilePath = path.join('/home/dev/ChromeProfiles', email);

(async () => {
    console.log(`Logging in ${email} (Headful)...`);
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/google-chrome',
        userDataDir: profilePath,
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ]
    });

    const page = await browser.newPage();
    await page.goto('https://identity.getpostman.com/login', { waitUntil: 'networkidle2' });
    
    // Wait for either the Cloudflare checkbox or the login form
    await new Promise(r => setTimeout(r, 10000));
    
    const url = page.url();
    if (url.includes('login')) {
        const userInput = await page.$('#username');
        if (userInput) {
            await userInput.type(email);
            await page.click('#sign-in-btn');
            await new Promise(r => setTimeout(r, 2000));
            
            const pwdInput = await page.$('#password');
            if (pwdInput) {
                await pwdInput.type(password);
                await page.click('#sign-in-btn');
            }
        }
        
        console.log("Waiting 20 seconds for Cloudflare and Login to complete...");
        await new Promise(r => setTimeout(r, 20000));
    }
    
    // Check if we reached dashboard
    await page.goto('https://go.postman.co/home', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));
    console.log("Current URL after login attempt:", page.url());
    
    await browser.close();
})();
