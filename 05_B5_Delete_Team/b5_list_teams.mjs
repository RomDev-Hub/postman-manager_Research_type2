import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { getBrowserConfig } from '../browser_config.mjs';

const email = process.argv[2];
const headful = process.argv.includes('--headful');
const useEdge = process.argv.includes('--edge');
const isHeadless = !headful;

if (!email) {
    console.error("Usage: node b5_list_teams.mjs <email> [--headful] [--edge]");
    process.exit(1);
}

const { executablePath, userDataDir: osDefaultDir } = getBrowserConfig(useEdge ? 'edge' : 'chrome');
const profilePath = path.join(osDefaultDir, 'PostmanAutoProfiles', email);

(async () => {
    console.log(`Starting b5_list_teams for ${email}`);
    console.log(`Using Profile Path: ${profilePath}`);
    
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        userDataDir: profilePath,
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,800',
            '--no-errdialogs',
            '--hide-crash-restore-bubble'
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    
    console.log("Navigating to Postman to setup cookies...");
    await page.goto('https://go.postman.co/settings/me/account', { waitUntil: 'networkidle2' });
    
    if (page.url().includes('/login') || page.url().includes('identity.getpostman.com')) {
        console.log("On login page. Waiting for extension to auto-fill and login (up to 30s)...");
        try {
            await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
        } catch (e) {
            console.error("Timeout waiting for login. Please login manually.");
            await browser.close();
            process.exit(1);
        }
    }
    
    console.log("Fetching user information and teams via API...");
    
    // Fetch User ID first
    const userRes = await page.evaluate(async () => {
        const resp = await fetch('/_api/ws/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: "god",
                method: "GET",
                path: "/api/users/me"
            })
        });
        return resp.json();
    });
    
    if (!userRes || !userRes.id) {
        console.error("Failed to fetch user ID", userRes);
        await browser.close();
        process.exit(1);
    }
    
    const userId = userRes.id;
    
    // Fetch Organizations
    const orgsRes = await page.evaluate(async (uid) => {
        const resp = await fetch('/_api/ws/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: "god",
                method: "GET",
                path: `/api/users/${uid}/organizations`
            })
        });
        return resp.json();
    }, userId);
    
    const teams = [];
    if (orgsRes && orgsRes.data && Array.isArray(orgsRes.data)) {
        for (const org of orgsRes.data) {
            let role = "member";
            if (org.roles && org.roles.includes("admin")) {
                role = "admin";
            }
            teams.push({
                id: org.id,
                name: org.name,
                domain: org.team_domain,
                roles: org.roles
            });
        }
    }
    
    console.log("\n--- TEAMS ---");
    console.table(teams);
    console.log("-------------\n");
    
    await browser.close();
})();
