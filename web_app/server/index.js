import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Logger, setSocketIO } from './logger.js';
import { getBrowserConfig } from '../../browser_config.mjs';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

setSocketIO(io);

const SETTINGS_PATH = path.join(projectRoot, 'settings.json');
const DB_PATH = path.join(projectRoot, 'database.json');
const LOG_FILE_PATH = path.join(__dirname, '../logs/app.log');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Helper for saving/loading JSON
const readJSON = (file, defaultData) => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return defaultData;
    }
};

const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Centralized logging
const broadcastLog = (msgObj) => {
    const timestamp = msgObj.timestamp || new Date().toISOString();
    const logStr = `[${timestamp}] [${msgObj.tag}] ${msgObj.message}${msgObj.data ? ' ' + JSON.stringify(msgObj.data) : ''}\n`;
    fs.appendFileSync(LOG_FILE_PATH, logStr);
    
    if (!msgObj.timestamp) msgObj.timestamp = timestamp;
    io.emit('log', msgObj);
};

const broadcastSeparator = () => {
    const sep = "===============================================================\n";
    fs.appendFileSync(LOG_FILE_PATH, sep);
    // Option to emit separator to UI if needed, but UI has distinct log lines. Let's emit a special log
    io.emit('log', { tag: 'Process', message: '=========================================', timestamp: new Date().toISOString() });
};

const getSettings = () => readJSON(SETTINGS_PATH, { concurrency: 6, browser: 'chrome' });
const getDb = () => readJSON(DB_PATH, { profiles: [], teams: [] });

// -----------------
// API - Scripts B1
// -----------------
app.post('/api/run/b1', (req, res) => {
    const { count, prefix } = req.body;
    // For now, this is a stub
    io.emit('log', { tag: 'Process', message: `B1 (Stub): Yêu cầu tạo ${count} tài khoản với tiền tố ${prefix}` });
    io.emit('log', { tag: 'Warn', message: 'Tính năng tạo tài khoản (B1) đang được xây dựng. Vui lòng sử dụng tính năng quản lý profile thủ công trước.' });
    res.json({ status: 'ok' });
});

// -----------------
// API - Scripts B2
// -----------------

// API Routes
app.get('/api/settings', (req, res) => {
    res.json(getSettings());
});

app.post('/api/settings', (req, res) => {
    const settings = { ...getSettings(), ...req.body };
    writeJSON(SETTINGS_PATH, settings);
    Logger.process('Settings updated', settings);
    res.json(settings);
});

app.get('/api/profiles', (req, res) => {
    res.json(getDb().profiles);
});

app.post('/api/profiles', (req, res) => {
    const db = getDb();
    db.profiles = req.body;
    writeJSON(DB_PATH, db);
    Logger.process('Profiles updated', { count: db.profiles.length });
    res.json({ success: true });
});

app.get('/api/local-profiles', (req, res) => {
    const chromeProfilesDir = path.join(__dirname, '../../ChromeProfiles');
    if (!fs.existsSync(chromeProfilesDir)) {
        return res.json([]);
    }
    try {
        const dirs = fs.readdirSync(chromeProfilesDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
            .filter(name => name.includes('@')); // basic filter for emails
        res.json(dirs);
    } catch (e) {
        res.json([]);
    }
});

import { spawn } from 'child_process';

let activeB2Process = null;
let activeB4Process = null;

const runScript = (scriptPath, args, res, stepName) => {
    broadcastSeparator();
    Logger.input(`Starting Script: ${path.basename(scriptPath)}`, args);
    io.emit('log', { tag: 'Process', message: `BẮT ĐẦU CHẠY BƯỚC ${stepName.toUpperCase()}`, timestamp: new Date().toISOString() });
    
    // Check if b2 is already running
    if (stepName === 'b2' && activeB2Process) {
        return res.status(400).json({ status: 'error', message: 'B2 is already running' });
    }
    // Check if b4 is already running
    if (stepName === 'b4' && activeB4Process) {
        return res.status(400).json({ status: 'error', message: 'B4 is already running' });
    }

    const child = spawn('node', [scriptPath, ...args].filter(Boolean), {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });
    
    if (stepName === 'b2') {
        activeB2Process = child;
    } else if (stepName === 'b4') {
        activeB4Process = child;
    }

    child.on('message', (msg) => {
        if (msg && msg.type === 'log') {
            const { tag, message, data } = msg;
            Logger[tag?.toLowerCase()] ? Logger[tag.toLowerCase()](message, data) : Logger.process(`[${tag}] ${message}`, data);
            
            // Also append to file log and UI via broadcastLog
            broadcastLog(msg);
        }
    });
    
    child.stdout.on('data', (data) => Logger.output('Stdout', data.toString().trim()));
    child.stderr.on('data', (data) => Logger.err('Stderr', data.toString().trim()));
    
    child.on('close', (code) => {
        Logger.process(`Process exited with code ${code}`);
        io.emit('log', { tag: 'Process', message: `Step ${stepName} exited with code ${code}`, timestamp: new Date().toISOString() });
        broadcastSeparator();
        
        if (stepName === 'b2') {
            activeB2Process = null;
            io.emit('b2_run_done');
        } else if (stepName === 'b4') {
            activeB4Process = null;
            io.emit('b4_run_done');
        }
    });
    
    res.json({ success: true, message: 'Script launched' });
};

app.post('/api/run/b2', (req, res) => {
    const { profiles } = req.body;
    if (!profiles || profiles.length === 0) return res.status(400).json({ error: 'No profiles provided' });
    
    const settings = getSettings();
    const scriptPath = path.join(projectRoot, 'scripts/b2_batch_login.mjs');
    const args = [profiles.join(','), String(settings.concurrency), settings.browser, 'headful'];
    
    runScript(scriptPath, args, res, 'b2');
});

app.post('/api/stop/b2', (req, res) => {
    if (activeB2Process) {
        activeB2Process.kill('SIGINT');
        activeB2Process = null;
        res.json({ status: 'stopped' });
    } else {
        res.json({ status: 'not_running' });
    }
});

app.post('/api/pause/b2', (req, res) => {
    if (activeB2Process) {
        activeB2Process.send({ cmd: 'pause' });
        io.emit('log', { tag: 'Process', message: 'Đã gửi lệnh TẠM DỪNG batch login' });
    }
    res.json({ status: 'ok' });
});

app.post('/api/resume/b2', (req, res) => {
    if (activeB2Process) {
        activeB2Process.send({ cmd: 'resume' });
        io.emit('log', { tag: 'Process', message: 'Đã gửi lệnh TIẾP TỤC batch login' });
    }
    res.json({ status: 'ok' });
});

app.post('/api/stop/b2', (req, res) => {
    if (activeB2Process) {
        activeB2Process.kill();
        activeB2Process = null;
        io.emit('log', { tag: 'Process', message: 'Đã HỦY batch login' });
    }
    res.json({ status: 'stopped' });
});

app.post('/api/open-profile/b2', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing email' });
    const settings = getSettings();
    const child = spawn('node', [
        path.join(__dirname, '../scripts/open_profile.mjs'),
        email,
        settings.browser
    ], { stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
    
    child.on('message', (msg) => {
        if (msg.type === 'log') io.emit('log', msg);
    });
    
    res.json({ status: 'ok' });
});

app.post('/api/audit/b2', (req, res) => {
    const { profiles } = req.body;
    if (!profiles || profiles.length === 0) return res.status(400).json({ error: 'No profiles provided' });

    const settings = getSettings();
    
    const child = spawn('node', [path.join(projectRoot, 'scripts/b2_audit.mjs'), profiles.join(','), settings.browser], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    child.on('message', (msg) => {
        if (msg.type === 'audit_result') {
            io.emit('b2_audit_result', msg.data);
        } else if (msg.type === 'log') {
            io.emit('log', msg);
        }
    });

    child.on('close', () => {
        io.emit('b2_scan_done');
    });

    res.json({ status: 'auditing' });
});

app.post('/api/run/b3', (req, res) => {
    const { email, teamName, teamDomain } = req.body;
    if (!email || !teamName || !teamDomain) return res.status(400).json({ error: 'Missing B3 parameters' });
    
    const settings = getSettings();
    const scriptPath = path.join(projectRoot, 'scripts/b3_create_team.mjs');
    const args = [email, teamName, teamDomain, settings.browser, 'headful'];
    
    runScript(scriptPath, args, res, 'b3');
});

app.post('/api/run/b4', (req, res) => {
    const { profiles, inviteUrls } = req.body;
    if (!profiles || profiles.length === 0 || !inviteUrls) return res.status(400).json({ error: 'Missing B4 parameters' });
    
    const settings = getSettings();
    const scriptPath = path.join(projectRoot, 'scripts/b4_join_team.mjs');
    const args = [profiles.join(','), inviteUrls, String(settings.concurrency), settings.browser];
    
    runScript(scriptPath, args, res, 'b4');
});

app.post('/api/pause/b4', (req, res) => {
    if (activeB4Process) {
        activeB4Process.send({ cmd: 'pause' });
        io.emit('log', { tag: 'Process', message: 'Đã gửi lệnh TẠM DỪNG B4' });
    }
    res.json({ status: 'ok' });
});

app.post('/api/resume/b4', (req, res) => {
    if (activeB4Process) {
        activeB4Process.send({ cmd: 'resume' });
        io.emit('log', { tag: 'Process', message: 'Đã gửi lệnh TIẾP TỤC B4' });
    }
    res.json({ status: 'ok' });
});

app.post('/api/stop/b4', (req, res) => {
    if (activeB4Process) {
        activeB4Process.send({ cmd: 'stop' });
        setTimeout(() => {
            if (activeB4Process) {
                try { activeB4Process.kill('SIGKILL'); } catch(e) {}
                activeB4Process = null;
            }
        }, 5000);
        io.emit('log', { tag: 'Process', message: 'Đang HỦY B4 và đóng các trình duyệt...' });
    }
    res.json({ status: 'stopped' });
});

app.post('/api/run/b6', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Missing B6 parameters' });
    
    const settings = getSettings();
    const scriptPath = path.join(projectRoot, 'scripts/b6_clean_team.mjs');
    const args = [email, settings.browser, 'headful'];
    
    runScript(scriptPath, args, res, 'b6');
});

// Real-time connections
io.on('connection', (socket) => {
    Logger.process('Client connected to Web UI');
    socket.on('disconnect', () => {
        Logger.process('Client disconnected');
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    Logger.process(`Postman Automator Web UI started on http://localhost:${PORT}`);
});
