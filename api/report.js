require('dotenv').config();
const cron = require('node-cron');
const { getChannelsByPrefix, getPinnedMessage, getChannelByName, postToChannel } = require('../utils/discord');
const { generateDailyReport } = require('../utils/openai');
const { getSummariesByDate } = require('../utils/cache');
const { cleanCache } = require('../utils/cache-manager');

// Configuration
const DAILY_REPORT_PROMPT_PREFIX = process.env.DAILY_REPORT_PROMPT_PREFIX || 'yt-daily-report-prompt-';
const DAILY_REPORT_CHANNEL = process.env.DISCORD_DAILY_REPORT_CHANNEL || 'daily-report';
const DAILY_REPORT_HOUR = parseInt(process.env.DAILY_REPORT_HOUR || '18');
const DAILY_REPORT_MINUTE = parseInt(process.env.DAILY_REPORT_MINUTE || '0');

/**
 * Sets up the daily report scheduler
 * @param {import('discord.js').Client} client - Discord client
 */
function setupDailyReport(client) {
  console.log('Setting up daily report scheduler...');
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  // Convert target time (CEST/CET) to UTC for cron
  const now = new Date();
  const targetDate = new Date(now);
  targetDate.setHours(DAILY_REPORT_HOUR, DAILY_REPORT_MINUTE, 0);

  // Determine if we're in CEST (UTC+2) or CET (UTC+1)
  const stdTimezoneOffset = () => {
    const jan = new Date(now.getFullYear(), 0, 1);
    const jul = new Date(now.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  };
  
  const isDST = () => {
    return now.getTimezoneOffset() < stdTimezoneOffset();
  };

  // Adjust for CEST/CET
  const utcOffset = isDST() ? 2 : 1; // CEST = UTC+2, CET = UTC+1
  const utcHour = (DAILY_REPORT_HOUR - utcOffset + 24) % 24;
  const cronExpression = `${DAILY_REPORT_MINUTE} ${utcHour} * * *`;
  
  console.log(`Setting up daily report scheduler with cron: ${cronExpression}`);
  console.log(`This will run at ${DAILY_REPORT_HOUR}:${DAILY_REPORT_MINUTE.toString().padStart(2, '0')} CEST`);
  
  // Schedule health check (runs every 6 hours and after report generation)
  let lastStatusMessage = null;
  let summariesCollected = 0;

  cron.schedule('0 */6 * * *', async () => {
    try {
      const channel = await getChannelByName(client, DAILY_REPORT_CHANNEL);
      if (channel) {
        const nextRun = new Date();
        nextRun.setHours(DAILY_REPORT_HOUR, DAILY_REPORT_MINUTE, 0, 0);
        if (nextRun < new Date()) nextRun.setDate(nextRun.getDate() + 1);
        
        // Delete previous status message if it exists
        if (lastStatusMessage) {
          try {
            await lastStatusMessage.delete();
          } catch (error) {
            console.log('Could not delete previous status message:', error.message);
          }
        }
        
        // Send new status message
        const statusMessage = await channel.send({
          content: `🟢 Daily report bot status update\n` +
                  `Summaries collected today: ${summariesCollected}\n` +
                  `Next report scheduled for: ${nextRun.toLocaleString('en-US', {
                    timeZone: 'Europe/Paris',
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                  })}`,
          flags: ['SuppressNotifications']
        });
        
        lastStatusMessage = statusMessage;
      }
    } catch (error) {
      console.error('Error sending health check message:', error);
    }
  });

  // Schedule the daily report job
  cron.schedule(cronExpression, async () => {
    console.log('Running daily report job...');
    try {
      // Generate daily reports
      await generateDailyReports(client);
      
      // Clean cache (files older than 30 days or if total size exceeds 500MB)
      try {
        console.log('Running scheduled cache cleanup...');
        const cacheResult = await cleanCache({ maxAgeDays: 30, maxSizeMB: 500 });
        console.log(`Cache cleanup: removed ${cacheResult.cleaned} files, new size: ${cacheResult.sizeAfter} MB`);
      } catch (cacheError) {
        console.error('Error during cache cleanup:', cacheError);
      }
      
      // Send confirmation message
      const channel = await getChannelByName(client, DAILY_REPORT_CHANNEL);
      if (channel) {
        await channel.send({
          content: '✅ Daily report generation completed',
          flags: ['SuppressNotifications']
        });
      }
    } catch (error) {
      console.error('Error generating daily reports:', error);
      
      // Send error message
      const channel = await getChannelByName(client, DAILY_REPORT_CHANNEL);
      if (channel) {
        await channel.send({
          content: '❌ Error generating daily report. Check server logs for details.',
          flags: ['SuppressNotifications']
        });
      }
    }
  });
}

/**
 * Generates daily reports and posts them to Discord
 * @param {import('discord.js').Client} client - Discord client
 * @returns {Promise<void>}
 */
async function generateDailyReports(client) {
  try {
    // Get today's date (reset to midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Log statistics for verification
    const todayStr = today.toISOString().split('T')[0];
    const stats = global.summaryStats?.[todayStr] || { count: 0, videos: new Set(), lastUpdate: null };
    
    console.log('=== Daily Report Statistics ===');
    console.log(`Date: ${todayStr}`);
    console.log(`Summaries tracked: ${stats.count}`);
    console.log(`Unique videos: ${stats.videos.size}`);
    console.log(`Last summary update: ${stats.lastUpdate}`);
    
    // Get all summaries from today
    const summaries = await getSummariesByDate(today);
    
    if (summaries.length === 0) {
      console.log('No summaries found for today, skipping daily report');
      
      // Send notification about no summaries
      const channel = await getChannelByName(client, DAILY_REPORT_CHANNEL);
      if (channel) {
        await channel.send({
          content: `ℹ️ No summaries were generated today (${todayStr})`,
          flags: ['SuppressNotifications']
        });
      }
      return;
    }
    
    console.log(`Found ${summaries.length} summaries for today`);
    
    // Verify summary count matches our tracking
    if (stats.count > 0 && summaries.length !== stats.count) {
      console.warn(`Warning: Tracked summary count (${stats.count}) differs from actual summaries found (${summaries.length})`);
    }
    
    // Get all report prompt channels
    const promptChannels = await getChannelsByPrefix(client, DAILY_REPORT_PROMPT_PREFIX);
    
    if (promptChannels.length === 0) {
      console.warn('No daily report prompt channels found');
      return;
    }
    
    console.log(`Found ${promptChannels.length} daily report prompt channels`);
    
    // Get the daily report channel
    const reportChannel = await getChannelByName(client, DAILY_REPORT_CHANNEL);
    
    if (!reportChannel) {
      console.error(`Daily report channel '${DAILY_REPORT_CHANNEL}' not found`);
      return;
    }
    
    // Process each prompt channel
    for (const promptChannel of promptChannels) {
      try {
        console.log(`Processing daily report prompt channel: ${promptChannel.name}`);
        
        // Get the pinned prompt
        const prompt = await getPinnedMessage(promptChannel);
        if (!prompt) {
          console.warn(`No pinned prompt found in channel ${promptChannel.name}`);
          continue;
        }
        
        // Extract the prompt index (e.g., "1" from "yt-daily-report-prompt-1")
        const promptIndex = promptChannel.name.substring(DAILY_REPORT_PROMPT_PREFIX.length);
        
        console.log(`Generating daily report with prompt ${promptIndex}...`);
        
        // Generate the report
        const report = await generateDailyReport(summaries, prompt);
        
        if (!report) {
          console.error(`Failed to generate daily report with prompt ${promptIndex}`);
          continue;
        }
        
        // Format the date for the report title
        const dateStr = today.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        // Post the daily report to the channel in plain text format as requested in the prompt
        console.log(`Posting daily report to ${reportChannel.name}...`);
        
        await postToChannel(
          reportChannel,
          `**DAILY REPORT: ${dateStr}**\n\n${report}\n\n*Generated with prompt ${promptIndex}*`
        );
        
        console.log(`Daily report posted to ${reportChannel.name}`);
      } catch (error) {
        console.error(`Error processing daily report prompt channel ${promptChannel.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error generating daily reports:', error);
  }
}

module.exports = {
  setupDailyReport,
  generateDailyReports
};
