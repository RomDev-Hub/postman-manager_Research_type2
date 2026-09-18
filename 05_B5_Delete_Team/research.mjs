import CDP from 'chrome-remote-interface';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const CHROME_PATHS = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
];

function getChromePath() {
    for (const p of CHROME_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    return 'google-chrome';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    const profileDir = path.resolve('../ChromeProfiles/hunggreen0001@maildrop.cc');
    const port = 9222;

    const lockPath = path.join(profileDir, 'SingletonLock');
    if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch(e){}
    }

    const chromeProcess = spawn(getChromePath(), [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--password-store=basic',
        'https://app.getpostman.com/settings/team/general'
    ], { detached: true, stdio: 'ignore' });

    let client;
    try {
        let retries = 10;
        while (retries > 0) {
            try {
                client = await CDP({ port });
                break;
            } catch(e) {
                retries--;
                await sleep(1000);
            }
        }

        if (!client) throw new Error("Could not connect to CDP");

        const { Page, Runtime, DOM } = client;
        await Page.enable();
        await Runtime.enable();
        await DOM.enable();

        console.log("Connected to Chrome. Waiting 15s for page load & login...");
        await sleep(15000);

        const { data } = await Page.captureScreenshot({ format: 'png' });
        fs.writeFileSync('team_settings.png', Buffer.from(data, 'base64'));

        const html = (await Runtime.evaluate({ expression: 'document.documentElement.outerHTML' })).result.value;
        fs.writeFileSync('team_settings.html', html);

        console.log("Saved team_settings.png and team_settings.html");
    } catch(e) {
        console.error(e);
    } finally {
        if(client) await client.close();
        try { process.kill(-chromeProcess.pid); } catch(e) {}
        try { chromeProcess.kill(); } catch(e) {}
    }
}

main();
