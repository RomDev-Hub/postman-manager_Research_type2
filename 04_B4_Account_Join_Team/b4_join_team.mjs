import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { getBrowserConfig } from '../browser_config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INVITE_LINKS_FILE = path.join(__dirname, '..', '03_B3_Team_And_Trial_API', 'invite_links.txt');
const { executablePath, userDataDir: osDefaultDir } = getBrowserConfig('chrome');
const PROFILES_DIR = path.join(osDefaultDir, 'PostmanAutoProfiles');
const SCRATCH_DIR = path.join(__dirname, 'scratch');

if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });

const secondaryAccounts = [
    "hunggreen0002@maildrop.cc",
    "hunggreen0003@maildrop.cc",
    "hunggreen0004@maildrop.cc",
    "hunggreen0005@maildrop.cc",
];

async function getInviteLinks() {
    let teams = [];
    if (fs.existsSync(INVITE_LINKS_FILE)) {
        const lines = fs.readFileSync(INVITE_LINKS_FILE, 'utf-8').split('\n');
        teams = lines.map(l => l.trim()).filter(l => l.includes('http'))
            .map(l => l.includes('Link: ') ? l.split('Link: ')[1].trim() : l);
    }
    return teams;
}

async function processAccount(account, links) {
    console.log(`\n--- [${account}] Launching Profile ---`);

    const srcProfile = path.join(PROFILES_DIR, account);
    const CDP_PORT = 9000 + Math.floor(Math.random() * 999);
    
    // Launch Chrome with flags to suppress "Profile error occurred" and crash bubbles
    const chromeCmd = `"${executablePath}" --remote-debugging-port=${CDP_PORT} --user-data-dir="${srcProfile}" --profile-directory=Default --no-first-run --no-default-browser-check --no-errdialogs --hide-crash-restore-bubble about:blank`;
    const proc = spawn('/bin/bash', ['-c', chromeCmd], { detached: true });

    let accountResults = [];

    try {
        let res, tabs;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
                tabs = await res.json();
                break;
            } catch (err) {
                await setTimeout(1000);
            }
        }
        if (!tabs) throw new Error("Could not connect to CDP port");
        
        const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
        
        const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
        let msgId = 1;
        const send = (m, p = {}) => new Promise(r => {
            const cur = msgId++;
            const h = (e) => { const d = JSON.parse(e.data); if (d.id === cur) { ws.removeEventListener('message', h); r(d.result); } };
            ws.addEventListener('message', h);
            ws.send(JSON.stringify({ id: cur, method: m, params: p }));
        });

        await new Promise(async (resolveWs) => {
            ws.addEventListener('open', async () => {
                await send('Page.enable');
                await send('Runtime.enable');
                
                for (let i = 0; i < links.length; i++) {
                    const inviteLink = links[i];
                    console.log(`[${account}] Navigating to Team ${i+1} link...`);
                    await send('Page.navigate', { url: inviteLink });
                    
                    let isSuccess = false;
                    let reason = "timeout";
                    let turnstileStuckCount = 0;
                    
                    for (let tick = 0; tick < 30; tick++) {
                        await setTimeout(2000);
                        
                        const r = await send('Runtime.evaluate', {
                            expression: `JSON.stringify({
                                url: window.location.href,
                                buttons: Array.from(document.querySelectorAll('button, a, div[role="button"], li')).map(b => b.innerText || b.textContent).filter(Boolean).map(t => t.trim().replace(/\\n/g, ' ')),
                                isTurnstile: document.body ? document.body.innerText.includes('security verification') || document.body.innerText.includes('Cloudflare') || document.body.innerText.includes('Just a moment') : false,
                                isVerifyEmail: document.body ? document.body.innerText.includes('Verify your email') : false,
                                isInReview: document.body ? document.body.innerText.includes('Your request to join this team is in review') : false
                            })`
                        });
                        
                        const st = JSON.parse(r?.result?.value || '{}');
                        
                        if (st.isTurnstile) {
                            turnstileStuckCount++;
                            console.log(`[${account}] [Tick ${tick}] Captcha detected. Waiting...`);
                            if (turnstileStuckCount > 5) tick--;
                        } else {
                            turnstileStuckCount = 0;
                            console.log(`[${account}] [Tick ${tick}] URL: ${st.url} | Verify: ${st.isVerifyEmail} | Review: ${st.isInReview}`);
                            
                            // Check Login Page
                            if (st.url && st.url.includes('identity.getpostman.com/login')) {
                                try {
                                    await send('Runtime.evaluate', {
                                        expression: `
                                            if (!window.hasAttemptedLogin) {
                                                const passInput = document.querySelector('input[type="password"]');
                                                if (passInput && passInput.value === '') {
                                                    passInput.value = 'Pass@0909';
                                                    passInput.dispatchEvent(new Event('input', { bubbles: true }));
                                                    
                                                    const emailInput = document.querySelector('input[name="username"]');
                                                    if (emailInput && !emailInput.value) {
                                                        emailInput.value = '${account}';
                                                        emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                                                    }
                                                }
                                                
                                                const tsInput = document.querySelector('[name="cf-turnstile-response"]');
                                                const tsWrapper = document.querySelector('#turnstile-widget, .cf-turnstile, iframe[src*="cloudflare"]');
                                                const isCaptchaSolved = (!tsWrapper && !tsInput) || (tsInput && tsInput.value.length > 0);
                                                
                                                if (isCaptchaSolved && passInput && passInput.value) {
                                                    let signInBtn = document.getElementById('sign-in-btn') || document.querySelector('button[type="submit"]');
                                                    if (!signInBtn) {
                                                        const btns = Array.from(document.querySelectorAll('button'));
                                                        signInBtn = btns.find(b => b.innerText.toLowerCase().includes('sign in'));
                                                    }
                                                    
                                                    if (signInBtn && !signInBtn.disabled) {
                                                        signInBtn.click();
                                                        window.hasAttemptedLogin = true;
                                                    }
                                                }
                                            }
                                        `
                                    });
                                } catch(e) {}
                            }
                        }
                        
                        if (st.isVerifyEmail) {
                            isSuccess = false;
                            reason = "verify_email_required";
                            break;
                        }
                        
                        if (st.isInReview) {
                            isSuccess = true;
                            reason = "in_review";
                            break;
                        }
                        
                        if (st.url && st.url.includes('authFlowId')) {
                            const htmlRes = await send('Runtime.evaluate', { expression: `document.body.outerHTML` });
                            if (htmlRes && htmlRes.result && htmlRes.result.value) {
                                fs.writeFileSync(path.join(SCRATCH_DIR, `${account}_authflow.html`), htmlRes.result.value);
                            }
                            
                            const hrefRes = await send('Runtime.evaluate', {
                                expression: `(() => {
                                    const els = Array.from(document.querySelectorAll('a.pm-card-account')).filter(el => el.innerText && el.innerText.includes('${account}'));
                                    if (els.length > 0) { els[0].click(); return true; }
                                    return false;
                                })()`
                            });
                        }
                        
                        if (st.buttons && st.buttons.length > 0) {
                            const joinBtn = st.buttons.find(t => t.toLowerCase().includes('keep separate') || t.toLowerCase() === 'join' || t.toLowerCase() === 'accept');
                            if (joinBtn) {
                                await send('Runtime.evaluate', {
                                    expression: `(() => { const el = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.toLowerCase().includes('${joinBtn.toLowerCase()}')); if (el) el.click(); })()`
                                });
                            }
                        }
                        
                        if (st.url && (st.url.includes('.postman.co/') || (!st.url.includes('web-invite-accept') && !st.url.includes('authFlowId') && !st.url.includes('identity.getpostman.com')))) {
                            if (st.url.includes('workspace') || st.url.includes('team_home') || st.url.includes('dashboard') || st.url.includes('/home') || st.url.includes('/onboarding/')) {
                               isSuccess = true;
                               reason = "joined";
                               break;
                            }
                        }
                    }
                    
                    console.log(`[${account}] Team ${i+1} -> Success: ${isSuccess} | Reason: ${reason}`);
                    accountResults.push({ team: `Team ${i+1}`, account, success: isSuccess, reason: reason });
                    
                    // Screenshot before next link
                    const ss = await send('Page.captureScreenshot', { format: 'png' });
                    if (ss?.data) fs.writeFileSync(path.join(SCRATCH_DIR, `${account}_team${i+1}_end.png`), Buffer.from(ss.data, 'base64'));
                    
                    // Clear attempted login flag for next link
                    await send('Runtime.evaluate', { expression: 'window.hasAttemptedLogin = false;' });
                    await setTimeout(2000); // short wait before next link
                }
                
                ws.close();
                resolveWs();
            });
            ws.addEventListener('error', resolveWs);
        });

    } catch (e) {
        console.error(`[${account}] Error: ${e.message}`);
        // Pad the remaining results with errors
        while(accountResults.length < links.length) {
            accountResults.push({ team: `Team ${accountResults.length+1}`, account, success: false, reason: `error: ${e.message}` });
        }
    } finally {
        try { process.kill(-proc.pid); } catch(e) {}
    }
    
    return accountResults;
}

(async () => {
    const links = await getInviteLinks();
    if (links.length === 0) {
        console.log("No invite links found in B3.");
        return;
    }
    
    console.log(`Found ${links.length} team invites to process.`);
    console.log(`Processing ${secondaryAccounts.length} accounts concurrently (batch size: 4)`);
    
    const BATCH_SIZE = 4;
    const allResults = [];
    
    for (let i = 0; i < secondaryAccounts.length; i += BATCH_SIZE) {
        const batch = secondaryAccounts.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(acc => processAccount(acc, links));
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(resArray => allResults.push(...resArray));
    }
    
    console.log('\n====================== FINAL REPORT ======================');
    allResults.forEach(r => {
        console.log(`Team: ${r.team} | Account: ${r.account} | Success: ${r.success} | Reason: ${r.reason}`);
    });
    console.log('==========================================================');
    
    fs.writeFileSync('b4_report.json', JSON.stringify(allResults, null, 2));
})();
