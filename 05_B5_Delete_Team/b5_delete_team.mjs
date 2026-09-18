import puppeteer from 'puppeteer-core';
import path from 'path';
import { getBrowserConfig } from '../browser_config.mjs';

const email = process.argv[2];
const teamDomain = process.argv[3];
const headful = process.argv.includes('--headful');
const useEdge = process.argv.includes('--edge');
const isHeadless = !headful;

if (!email || !teamDomain) {
    console.error("Usage: node b5_delete_team.mjs <email> <teamDomain> [--headful] [--edge]");
    process.exit(1);
}

const { executablePath, userDataDir: osDefaultDir } = getBrowserConfig(useEdge ? 'edge' : 'chrome');
const profilePath = path.join(osDefaultDir, 'PostmanAutoProfiles', email);

(async () => {
    console.log(`Starting b5_delete_team for ${email}, target team: ${teamDomain}`);
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
    
    // --- 1. Remove all other members ---
    const membersUrl = `https://${teamDomain}.postman.co/settings/team/members`;
    console.log(`Navigating to team members page: ${membersUrl}`);
    await page.goto(membersUrl, { waitUntil: 'networkidle2' });
    
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
    
    await new Promise(r => setTimeout(r, 8000)); // Wait for members to load
    
    console.log("Attempting to remove other members...");
    
    // We loop to remove members one by one.
    let maxAttempts = 10;
    while (maxAttempts-- > 0) {
        // Try to find an actions menu button. Often they are buttons with aria-haspopup="menu" or just three dots.
        // In Postman, it might be a button inside the member row.
        // We will just look for all text that says "Remove from team" directly, or try to open menus.
        
        // Let's click all buttons that might be menus to reveal "Remove from team"
        const buttons = await page.$$('button');
        let menuClicked = false;
        
        for (let btn of buttons) {
            // We don't want to click things like "Invite People" or "Leave" here.
            const text = await page.evaluate(e => e.innerText, btn);
            const aria = await page.evaluate(e => e.getAttribute('aria-label') || '', btn);
            if (!text && aria.toLowerCase().includes('action')) {
                // likely a 3-dots menu
                try {
                    await btn.click();
                    await new Promise(r => setTimeout(r, 1000));
                    menuClicked = true;
                } catch(e) {}
            }
        }
        
        // Now look for "Remove from team" option
        const divs = await page.$$('div, span, button, a');
        let removeOpt = null;
        for (let el of divs) {
            const text = await page.evaluate(e => e.innerText, el);
            if (text && text.trim().toLowerCase() === 'remove from team') {
                const isVisible = await page.evaluate(e => e.offsetParent !== null, el);
                if (isVisible) {
                    removeOpt = el;
                    break;
                }
            }
        }
        
        if (removeOpt) {
            console.log("Found 'Remove from team', clicking...");
            await removeOpt.click();
            await new Promise(r => setTimeout(r, 2000));
            
            // Confirm modal
            const confirmBtns = await page.$$('button');
            for(let cBtn of confirmBtns) {
                const cText = await page.evaluate(e => e.innerText, cBtn);
                if (cText && (cText.trim().toLowerCase() === 'remove' || cText.trim().toLowerCase() === 'confirm')) {
                    await cBtn.click();
                    console.log("Clicked confirm remove.");
                    await new Promise(r => setTimeout(r, 3000));
                    break;
                }
            }
        } else {
            console.log("No more members to remove (or couldn't find the button).");
            break; 
        }
    }
    
    // --- 2. Leave the team ---
    const accountUrl = `https://${teamDomain}.postman.co/settings/me/account`;
    console.log(`Navigating to account teams page: ${accountUrl}`);
    await page.goto(accountUrl, { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 5000));
    
    console.log("Clicking on 'Teams' in sidebar...");
    const els = await page.$$('a');
    for(let el of els) {
        const text = await page.evaluate(e => e.innerText, el);
        if (text && text.trim() === 'Teams') {
            await el.click();
            break;
        }
    }
    
    await new Promise(r => setTimeout(r, 3000));
    
    const leaveButtons = await page.$$('button');
    let leaveButton = null;
    for(let btn of leaveButtons) {
        const text = await page.evaluate(e => e.innerText, btn);
        if (text && text.trim().toLowerCase() === 'leave') {
            leaveButton = btn;
            break;
        }
    }

    if (leaveButton) {
        console.log("Found 'Leave' button, clicking...");
        await leaveButton.click();
        await new Promise(r => setTimeout(r, 3000));
        
        console.log("Looking for 'Delete workspaces' option...");
        const radios = await page.$$('input[type="radio"]');
        if (radios.length >= 2) {
            console.log("Selecting the second radio button (Delete workspaces)...");
            await radios[1].click();
        } else {
            const labels = await page.$$('label');
            for(let label of labels) {
                const text = await page.evaluate(e => e.innerText, label);
                if (text && text.toLowerCase().includes('delete workspaces')) {
                    await label.click();
                    break;
                }
            }
        }
        await new Promise(r => setTimeout(r, 1000));

        const strongs = await page.$$('strong');
        let teamName = "";
        for(let s of strongs) {
            const text = await page.evaluate(e => e.innerText, s);
            if (text && text.length > 0 && text !== 'Delete workspaces') {
                teamName = text.trim();
                break;
            }
        }
        
        if (!teamName) {
            const h2s = await page.$$('h2');
            for(let h of h2s) {
                const text = await page.evaluate(e => e.innerText, h);
                if (text && text.includes('Leave and delete')) {
                    teamName = text.replace('Leave and delete ', '').replace(' team?', '').trim();
                    break;
                }
            }
        }

        console.log("Extracted team name for confirmation:", teamName);
        
        const inputs = await page.$$('input[type="text"]');
        let confirmInput = null;
        for(let input of inputs) {
            const isVisible = await page.evaluate(e => e.offsetParent !== null, input);
            if (isVisible) {
                confirmInput = input;
                break;
            }
        }

        if (confirmInput && teamName) {
            console.log(`Typing team name '${teamName}' into confirm input...`);
            await confirmInput.type(teamName);
            await new Promise(r => setTimeout(r, 1000));
        }

        const confirmButtons = await page.$$('button');
        for(let btn of confirmButtons) {
            const text = await page.evaluate(e => e.innerText, btn);
            if (text && (text.trim() === 'Leave and Delete Team' || text.trim() === 'Leave Team')) {
                console.log(`Clicking confirm button: ${text.trim()}...`);
                await btn.click();
                break;
            }
        }
        
        console.log("Waiting 15 seconds to allow for Cloudflare verification or completion...");
        await new Promise(r => setTimeout(r, 15000));
        
        console.log("Checking final URL:", page.url());
        const screenshotPath = path.join('/home/dev/_Tool_postman_Sep17/05_B5_Delete_Team', `${email}_deleted.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Screenshot saved to ${screenshotPath}`);

    } else {
        console.log("No 'Leave' button found. Maybe already left or not in a team?");
    }

    console.log("Finished B5.");
    await browser.close();
})();
