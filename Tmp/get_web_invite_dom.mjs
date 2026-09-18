import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

const INVITE_CODE = '12a1b516aa4b1672a6c656a6a1a7d3239abeb51d2071516d39b4acbc3c9783b9';
const EMAIL = 'hunggreen0002@maildrop.cc';
const CDP_PORT = 9922;

const srcProfile = path.join('/home/dev/ChromeProfiles', EMAIL);
const tempRunDir = `/tmp/chrome_turnstile_${Date.now()}`;
fs.mkdirSync(path.join(tempRunDir, 'Default'), { recursive: true });
for (const f of ['Cookies', 'Preferences', 'Secure Preferences', 'Web Data', 'Network Persistent State']) {
  if (fs.existsSync(path.join(srcProfile, 'Default', f))) fs.copyFileSync(path.join(srcProfile, 'Default', f), path.join(tempRunDir, 'Default', f));
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
    const step1Url = `https://app.getpostman.com/join-team?invite_code=${INVITE_CODE}&target=team`;
    await send('Page.navigate', { url: step1Url });
    for (let tick = 0; tick < 20; tick++) {
      await setTimeout(2000);
      const r = await send('Runtime.evaluate', {
        expression: `JSON.stringify({
          url: window.location.href,
          html: document.body ? document.body.innerHTML : '',
          buttons: Array.from(document.querySelectorAll('button, a')).map(b => b.innerText || b.textContent).filter(Boolean).map(t => t.trim().replace(/\\n/g, ' '))
        })`
      });
      const st = JSON.parse(r?.result?.value || '{}');
      if (st.url && st.url.includes('authFlowId')) {
          const hrefRes = await send('Runtime.evaluate', {
              expression: `
                  (() => {
                      const a = Array.from(document.querySelectorAll('a')).find(el => el.innerText.includes('${EMAIL}'));
                      return a ? a.href : null;
                  })()
              `
          });
          if (hrefRes?.result?.value) {
              await send('Page.navigate', { url: hrefRes.result.value });
              continue;
          }
      }
      if (st.url && st.url.includes('web-invite-accept')) {
          console.log("Buttons on web-invite-accept:", st.buttons);
          fs.writeFileSync('web_invite_dom.html', st.html);
          const ss = await send('Page.captureScreenshot', { format: 'png' });
          if (ss?.data) fs.writeFileSync('web_invite_screenshot.png', Buffer.from(ss.data, 'base64'));
          break;
      }
    }
    ws.close();
    try { process.kill(-proc.pid); } catch(e) {}
    process.exit(0);
  });
}
main();
