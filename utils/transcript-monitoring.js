const fs = require('fs').promises;
const path = require('path');

// Store error logs in logs directory
const LOGS_DIR = path.join(process.cwd(), 'logs');
const ERROR_LOG_FILE = path.join(LOGS_DIR, 'transcript-errors.log');
const STATS_FILE = path.join(LOGS_DIR, 'transcript-stats.json');

// Ensure logs directory exists
async function ensureLogsDir() {
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating logs directory:', error);
    }
}

// Track transcript extraction attempts and results
const stats = {
    totalAttempts: 0,
    successful: 0,
    failed: 0,
    apiSuccesses: 0,
    apiFails: 0,
    scrapeSuccesses: 0,
    scrapeFails: 0,
    lastUpdated: null
};

async function loadStats() {
    try {
        await ensureLogsDir();
        const data = await fs.readFile(STATS_FILE, 'utf8');
        Object.assign(stats, JSON.parse(data));
    } catch (error) {
        // File doesn't exist or is corrupted, use default stats
        console.log('No previous stats found, starting fresh');
    }
}

async function saveStats() {
    try {
        await ensureLogsDir();
        await fs.writeFile(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (error) {
        console.error('Error saving stats:', error);
    }
}

async function logTranscriptError(videoId, method, error) {
    try {
        await ensureLogsDir();
        const timestamp = new Date().toISOString();
        const logEntry = `${timestamp} | ${videoId} | ${method} | ${error}\n`;
        await fs.appendFile(ERROR_LOG_FILE, logEntry);
    } catch (error) {
        console.error('Error logging transcript error:', error);
    }
}

function updateStats(success, method) {
    stats.totalAttempts++;
    if (success) {
        stats.successful++;
        if (method === 'api') stats.apiSuccesses++;
        if (method === 'scrape') stats.scrapeSuccesses++;
    } else {
        stats.failed++;
        if (method === 'api') stats.apiFails++;
        if (method === 'scrape') stats.scrapeFails++;
    }
    stats.lastUpdated = new Date().toISOString();
    saveStats();
}

// Load stats on module initialization
loadStats();

module.exports = {
    logTranscriptError,
    updateStats
};
