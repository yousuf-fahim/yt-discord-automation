const fs = require('fs').promises;
const path = require('path');

// Monitoring directory structure
const MONITOR_DIR = path.join(process.cwd(), 'monitoring');
const LOGS_DIR = path.join(MONITOR_DIR, 'logs');
const STATS_DIR = path.join(MONITOR_DIR, 'stats');

// File paths
const TRANSCRIPT_STATS = path.join(STATS_DIR, 'transcript-stats.json');
const SUMMARY_STATS = path.join(STATS_DIR, 'summary-stats.json');
const ERROR_LOG = path.join(LOGS_DIR, 'errors.log');
const DAILY_REPORT_LOG = path.join(LOGS_DIR, 'daily-reports.log');

// Initialize monitoring system
async function initMonitoring() {
    await Promise.all([
        fs.mkdir(LOGS_DIR, { recursive: true }),
        fs.mkdir(STATS_DIR, { recursive: true })
    ]);
}

// Stats tracking
const stats = {
    transcripts: {
        total: 0,
        successful: 0,
        failed: 0,
        apiSuccesses: 0,
        apiFails: 0,
        scrapeSuccesses: 0,
        scrapeFails: 0
    },
    summaries: {
        total: 0,
        successful: 0,
        failed: 0,
        daily: {}
    },
    reports: {
        lastGenerated: null,
        totalGenerated: 0,
        failed: 0
    }
};

// Load stats from disk
async function loadStats() {
    try {
        const [transcriptStats, summaryStats] = await Promise.all([
            fs.readFile(TRANSCRIPT_STATS, 'utf8').catch(() => null),
            fs.readFile(SUMMARY_STATS, 'utf8').catch(() => null)
        ]);

        if (transcriptStats) {
            stats.transcripts = { ...stats.transcripts, ...JSON.parse(transcriptStats) };
        }
        if (summaryStats) {
            stats.summaries = { ...stats.summaries, ...JSON.parse(summaryStats) };
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Save stats to disk
async function saveStats() {
    try {
        await Promise.all([
            fs.writeFile(TRANSCRIPT_STATS, JSON.stringify(stats.transcripts, null, 2)),
            fs.writeFile(SUMMARY_STATS, JSON.stringify(stats.summaries, null, 2))
        ]);
    } catch (error) {
        console.error('Error saving stats:', error);
    }
}

// Error logging with categories
async function logError(category, id, error, details = {}) {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = JSON.stringify({
            timestamp,
            category,
            id,
            error: error.message || error,
            details,
            stack: error.stack
        });
        await fs.appendFile(ERROR_LOG, `${logEntry}\n`);
    } catch (err) {
        console.error('Error logging to file:', err);
    }
}

// Track daily summaries
function trackDailySummary(videoId, success = true) {
    const today = new Date().toISOString().split('T')[0];
    stats.summaries.total++;
    if (success) {
        stats.summaries.successful++;
    } else {
        stats.summaries.failed++;
    }
    
    stats.summaries.daily[today] = stats.summaries.daily[today] || {
        count: 0,
        videos: new Set()
    };
    
    stats.summaries.daily[today].count++;
    stats.summaries.daily[today].videos.add(videoId);
    
    saveStats();
}

// Track transcript extraction
function trackTranscript(method, success = true) {
    stats.transcripts.total++;
    if (success) {
        stats.transcripts.successful++;
        if (method === 'api') stats.transcripts.apiSuccesses++;
        if (method === 'scrape') stats.transcripts.scrapeSuccesses++;
    } else {
        stats.transcripts.failed++;
        if (method === 'api') stats.transcripts.apiFails++;
        if (method === 'scrape') stats.transcripts.scrapeFails++;
    }
    
    saveStats();
}

// Track daily report generation
async function trackDailyReport(success = true, details = {}) {
    const timestamp = new Date().toISOString();
    stats.reports.lastGenerated = timestamp;
    stats.reports.totalGenerated++;
    if (!success) stats.reports.failed++;
    
    await fs.appendFile(DAILY_REPORT_LOG, 
        JSON.stringify({ timestamp, success, details }) + '\n'
    );
    saveStats();
}

// Get current day's statistics
function getDailyStats() {
    const today = new Date().toISOString().split('T')[0];
    return {
        summaries: stats.summaries.daily[today] || { count: 0, videos: new Set() },
        transcripts: {
            total: stats.transcripts.total,
            successful: stats.transcripts.successful,
            failed: stats.transcripts.failed
        },
        reports: {
            lastGenerated: stats.reports.lastGenerated,
            totalToday: Object.keys(stats.summaries.daily[today] || {}).length
        }
    };
}

// Initialize on module load
initMonitoring().then(loadStats);

module.exports = {
    logError,
    trackDailySummary,
    trackTranscript,
    trackDailyReport,
    getDailyStats
};
