import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

const INVITE_CODE = '12a1b516aa4b1672a6c656a6a1a7d3239abeb51d2071516d39b4acbc3c9783b9';
const EMAIL = 'hunggreen0002@maildrop.cc';
const CDP_PORT = 9750;
const PROFILES_DIR = '/home/dev/ChromeProfiles';

const srcProfile = path.join(PROFILES_DIR, EMAIL);
const tempRunDir = `/tmp/chrome_turnstile_${Date.now()}`;
fs.mkdirSync(path.join(tempRunDir, 'Default'), { recursive: true });
for (const f of ['Cookies', 'Preferences', 'Secure Preferences', 'Web Data', 'Network Persistent State']) {
  const s = path.join(srcProfile, 'Default', f);
  const d = path.join(tempRunDir, 'Default', f);
  if (fs.existsSync(s)) fs.copyFileSync(s, d);
}
const lsSrc = path.join(srcProfile, 'Default', 'Local Storage');
if (fs.existsSync(lsSrc)) {
  fs.cpSync(lsSrc, path.join(tempRunDir, 'Default', 'Local Storage'), { recursive: true });
}

const chromeCmd = `/usr/bin/xvfb-run -a -s "-screen 0 1920x1080x24" /usr/bin/google-chrome --remote-debugging-port=${CDP_PORT} --user-data-dir=${tempRunDir} --profile-directory=Default --no-first-run --no-default-browser-check --disable-gpu about:blank`;
const proc = spawn('/bin/bash', ['-c', chromeCmd], { detached: true });

async function main() {
  await setTimeout(4000);
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  const tabs = await res.json();
  const pageTab = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  let id = 1;
  const send = (m, p={}) => new Promise(r => {
    const cur = id++;
    const h = (e) => { const d = JSON.parse(e.data); if (d.id === cur) { ws.removeEventListener('message', h); r(d.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
  });
  ws.addEventListener('open', async () => {
    await send('Page.enable');
    await send('Runtime.enable');
    const step1Url = `https://identity.getpostman.com/login?cta=join-team&invite_code=${INVITE_CODE}&is_signup=0&continue=https%3A%2F%2Fapp.getpostman.com%2Fweb-invite-accept%3Finvite_code%3D${INVITE_CODE}%26activate%3D`;
    await send('Page.navigate', { url: step1Url });
    for (let tick = 0; tick < 12; tick++) {
      await setTimeout(2000);
      const r = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
          url: window.location.href,
          title: document.title,
          buttons: Array.from(document.querySelectorAll('button, a, div[role="button"], li')).map(b => b.innerText || b.textContent).filter(Boolean).map(t => t.trim().replace(/\\n/g, ' '))
        })`
      });
      const st = JSON.parse(r?.result?.value || '{}');
      console.log(`[Tick ${tick+1}] URL: ${st.url}`);
      console.log(`Buttons: ${JSON.stringify(st.buttons?.slice(0, 10))}`);
      if (st.buttons && st.buttons.some(b => b.includes(EMAIL))) {
         console.log("Found email button, clicking it!");
         await send('Runtime.evaluate', {
            expression: `
              const el = Array.from(document.querySelectorAll('li, button, a, div')).find(el => el.innerText.includes('${EMAIL}'));
              if(el) el.click();
            `
         });
      }
    }
    ws.close();
    try { process.kill(-proc.pid); } catch(e) {}
    process.exit(0);
  });
}
main();
