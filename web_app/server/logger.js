import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Get current date for log file
const getLogFileName = () => {
    const d = new Date();
    return `app-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.log`;
};

const LOG_DIR = path.join(projectRoot, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

let io = null;

export const setSocketIO = (socketIoInstance) => {
    io = socketIoInstance;
};

// Formats a log message
const formatMessage = (tag, message, data = null) => {
    const timestamp = new Date().toISOString();
    let logString = `[${timestamp}] [${tag}] ${message}`;
    if (data) {
        if (typeof data === 'object') {
            logString += `\n${JSON.stringify(data, null, 2)}`;
        } else {
            logString += ` - ${data}`;
        }
    }
    return logString;
};

// Writes to file and emits to Socket.io
const log = (tag, message, data = null) => {
    const logString = formatMessage(tag, message, data);
    
    // Write to file
    const logFile = path.join(LOG_DIR, getLogFileName());
    fs.appendFileSync(logFile, logString + '\n');
    
    // Console output for debugging backend
    console.log(logString);
    
    // Emit to UI if connected
    if (io) {
        io.emit('log', { tag, message, data, timestamp: new Date().toISOString() });
    }
};

export const Logger = {
    input: (msg, data) => log('Input', msg, data),
    output: (msg, data) => log('Output', msg, data),
    process: (msg, data) => log('Process', msg, data),
    err: (msg, data) => log('Err', msg, data),
    bug: (msg, data) => log('Bug', msg, data),
    warn: (msg, data) => log('Warn', msg, data),
    api: (method, url, requestData, responseData) => {
        log('API', `Request: ${method} ${url}`, requestData);
        log('API', `Response: ${method} ${url}`, responseData);
    }
};
