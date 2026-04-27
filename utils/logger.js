const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "..", "logs");

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function getLogFileName() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}.log`;
}

function writeToFile(level, message, data) {
  const fileName = getLogFileName();
  const filePath = path.join(LOG_DIR, fileName);
  const timestamp = getTimestamp();
  const dataStr = data !== undefined ? " " + JSON.stringify(data) : "";
  const line = `[${timestamp}] [${level}] ${message}${dataStr}\n`;

  fs.appendFileSync(filePath, line, "utf8");
}

const logger = {
  info(message, data) {
    console.log(`[INFO] ${message}`, data !== undefined ? data : "");
    writeToFile("INFO", message, data);
  },

  warn(message, data) {
    console.warn(`[WARN] ${message}`, data !== undefined ? data : "");
    writeToFile("WARN", message, data);
  },

  error(message, data) {
    console.error(`[ERROR] ${message}`, data !== undefined ? data : "");
    writeToFile("ERROR", message, data);
  },

  order(message, data) {
    console.log(`[ORDER] ${message}`, data !== undefined ? data : "");
    writeToFile("ORDER", message, data);
  },
};

module.exports = logger;
