import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { getBrowserConfig } from '../browser_config.mjs';

const email = process.argv[2];
const teamName = process.argv[3];
const teamDomain = process.argv[4];
const headful = process.argv.includes('--headful');
const useEdge = process.argv.includes('--edge');
const isHeadless = !headful;

if (!email || !teamName || !teamDomain) {
    console.error("Usage: node b3_create_team.mjs <email> <team_name> <team_domain> [--headful] [--edge]");
    process.exit(1);
}

const { executablePath, userDataDir: osDefaultDir } = getBrowserConfig(useEdge ? 'edge' : 'chrome');
// We will use a dedicated sub-folder inside the OS default config to avoid locking issues with the main browser
const profilePath = path.join(osDefaultDir, 'PostmanAutoProfiles', email);

(async () => {
    console.log(`Starting to create team ${teamName} (${teamDomain}) for ${email}`);
    console.log(`Using Profile Path: ${profilePath}`);
    
    const browser = await puppeteer.launch({
        executablePath: executablePath,
        userDataDir: profilePath,
        headless: isHeadless ? "new" : false,
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
    
    console.log("Creating team via API...");
    
    // 1. Create Team
    const createRes = await page.evaluate(async (name, domain) => {
        const resp = await fetch('/_api/ws/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service: "god",
                method: "POST",
                path: "/api/organizations/add",
                body: {
                    name: name,
                    team_domain: domain,
                    preserve_personal_context: false
                }
            })
        });
        return {
            status: resp.status,
            body: await resp.json().catch(() => null)
        };
    }, teamName, teamDomain);
    
    if (createRes.status !== 200 || !createRes.body) {
        console.error("Failed to create team", createRes);
        await browser.close();
        process.exit(1);
    }
    
    const orgId = createRes.body.organization_id;
    let inviteLink = null;
    if (createRes.body.multiuse_invitations && createRes.body.multiuse_invitations.length > 0) {
        inviteLink = createRes.body.multiuse_invitations[0].link;
    }
    
    const returnedDomain = createRes.body.organization_domain || 'go';
    
    console.log(`Success! Organization ID: ${orgId}`);
    console.log(`Invite Link: ${inviteLink}`);
    
    // 2. Upgrade to Enterprise Trial
    console.log(`Activating Enterprise Trial 7 days for Org ${orgId}...`);
    
    // Go to team domain to trigger trial
    await page.goto(`https://${returnedDomain}.postman.co/`, { waitUntil: 'networkidle2' });
    
    const trialRes = await page.evaluate(async (oid) => {
        const resp = await fetch('/_api/ws/proxy', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-entity-team-id': oid
            },
            body: JSON.stringify({
                service: "trial",
                method: "POST",
                path: "/v1/api/start/trial/journey",
                body: {
                    trialId: "enterprise-7-days-trial"
                }
            })
        });
        return {
            status: resp.status,
            body: await resp.json().catch(() => null)
        };
    }, orgId);
    
    if (trialRes.status === 200) {
        console.log("Enterprise Trial Activated Successfully!");
    } else {
        console.error("Trial activation failed", trialRes);
    }
    
    const resString = `Team: ${teamName} | Domain: ${returnedDomain} | Org ID: ${orgId} | Link: ${inviteLink}\n`;
    fs.appendFileSync('invite_links.txt', resString);
    console.log("Saved link to invite_links.txt");
    
    await browser.close();
})();
