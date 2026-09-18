import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROFILES_DIR = path.join(__dirname, '..', '02_B2_Batch_Login', 'ChromeProfiles');
const SCRATCH_DIR = path.join(__dirname, 'scratch');

(async () => {
    const account = "hunggreen0002@maildrop.cc";
    const srcProfile = path.join(PROFILES_DIR, account);
    const CDP_PORT = 9999;
    const chromeCmd = `/usr/bin/google-chrome --remote-debugging-port=${CDP_PORT} --user-data-dir="${srcProfile}" --profile-directory=Default --no-first-run --no-default-browser-check about:blank`;
    const proc = spawn('/bin/bash', ['-c', chromeCmd], { detached: true });

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
        if (!tabs || !tabs.find) {
            console.error(tabs);
            throw new Error("Could not connect or tabs is not an array");
        }
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
                
                const inviteLink = "https://app.getpostman.com/join-team?invite_code=e09f73c9e4dd05f21855d4babd89a884d0ed70fbff00e42b3181d3c3d4acb4cd";
                await send('Page.navigate', { url: inviteLink });
                
                for (let tick = 0; tick < 15; tick++) {
                    await setTimeout(2000);
                    const r = await send('Runtime.evaluate', { expression: `window.location.href` });
                    const url = r?.result?.value;
                    console.log(`URL: ${url}`);
                    if (url && url.includes('authFlowId')) {
                        const htmlRes = await send('Runtime.evaluate', { expression: `document.body.outerHTML` });
                        fs.writeFileSync(path.join(SCRATCH_DIR, 'authFlowId.html'), htmlRes?.result?.value);
                        console.log("HTML dumped.");
                        break;
                    }
                }
                
                ws.close();
                resolveWs();
            });
        });

    } catch (e) {
        console.error(e);
    } finally {
        try { process.kill(-proc.pid); } catch(e) {}
    }
})();
