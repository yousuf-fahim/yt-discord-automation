#!/usr/bin/env node

/**
 * Manual Daily Report Trigger for Heroku
 * Run: heroku run node api/manual-trigger-report.js -a your-app-name
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { generateDailyReports } = require('./report');
const { getSummariesByDate } = require('../utils/cache');

async function triggerDailyReport() {
  console.log('🚀 Manual Daily Report Trigger');
  console.log('==============================\n');
  
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
  
  try {
    // Login to Discord
    console.log('🔐 Connecting to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('✅ Connected to Discord!\n');
    
    // Check today's summaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    const summaries = await getSummariesByDate(today);
    console.log(`📅 Date: ${todayStr}`);
    console.log(`📊 Summaries available: ${summaries.length}\n`);
    
    if (summaries.length > 0) {
      summaries.forEach((summary, index) => {
        console.log(`  ${index + 1}. ${summary.title || 'Unknown Video'} (${new Date(summary.timestamp).toLocaleTimeString()})`);
      });
      console.log('');
    }
    
    // Show next scheduled report
    const DAILY_REPORT_HOUR = parseInt(process.env.DAILY_REPORT_HOUR || '18');
    const DAILY_REPORT_MINUTE = parseInt(process.env.DAILY_REPORT_MINUTE || '0');
    
    const nextRun = new Date();
    nextRun.setHours(DAILY_REPORT_HOUR, DAILY_REPORT_MINUTE, 0, 0);
    if (nextRun <= new Date()) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    console.log(`⏰ Next scheduled report: ${nextRun.toLocaleString('en-US', {
      timeZone: 'Europe/Paris',
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })}\n`);
    
    // Generate daily reports
    console.log('🔄 Generating daily reports...');
    await generateDailyReports(client);
    
    console.log('✅ Daily report generation completed!');
    console.log('📧 Check your Discord #daily-report channel.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

triggerDailyReport();
