#!/usr/bin/env node

/**
 * Manual Daily Report Trigger and Scheduler Info
 * Tests daily report generation and shows upcoming schedule
 */

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { generateDailyReports } = require('./api/report');
const { getSummariesByDate } = require('./utils/cache');

async function testDailyReport() {
  console.log('🧪 Manual Daily Report Test');
  console.log('============================\n');
  
  // Initialize Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });
  
  try {
    // Login to Discord
    console.log('🔐 Logging into Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('✅ Successfully logged into Discord!\n');
    
    // Check today's summaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStr = today.toISOString().split('T')[0];
    console.log(`📅 Checking summaries for today: ${todayStr}`);
    
    const summaries = await getSummariesByDate(today);
    console.log(`📊 Found ${summaries.length} summaries for today\n`);
    
    if (summaries.length > 0) {
      console.log('📝 Summary Details:');
      summaries.forEach((summary, index) => {
        console.log(`  ${index + 1}. Video: ${summary.title || 'Unknown'}`);
        console.log(`     Time: ${new Date(summary.timestamp).toLocaleTimeString()}`);
        console.log(`     Length: ${summary.summary?.length || 0} chars\n`);
      });
    } else {
      console.log('ℹ️ No summaries found for today. The daily report will show "no summaries" message.\n');
    }
    
    // Show next report schedule
    const DAILY_REPORT_HOUR = parseInt(process.env.DAILY_REPORT_HOUR || '18');
    const DAILY_REPORT_MINUTE = parseInt(process.env.DAILY_REPORT_MINUTE || '0');
    
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(DAILY_REPORT_HOUR, DAILY_REPORT_MINUTE, 0, 0);
    
    // If today's report time has passed, show tomorrow's
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
    
    console.log('⏰ Next Scheduled Daily Report:');
    console.log(`   Date: ${nextRun.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`);
    console.log(`   Time: ${nextRun.toLocaleTimeString('en-US', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })}`);
    
    const timeUntilNext = nextRun - now;
    const hoursUntil = Math.floor(timeUntilNext / (1000 * 60 * 60));
    const minutesUntil = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));
    console.log(`   Time until next report: ${hoursUntil}h ${minutesUntil}m\n`);
    
    // Ask if user wants to trigger manually
    console.log('🚀 Triggering Daily Report Manually...\n');
    
    // Generate daily reports
    await generateDailyReports(client);
    
    console.log('\n✅ Manual daily report trigger completed!');
    console.log('📧 Check your Discord #daily-report channel for the reports.');
    
  } catch (error) {
    console.error('❌ Error during daily report test:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
}

// Show report counts for the next few days
async function showUpcomingReports() {
  console.log('\n📈 Upcoming Daily Report Analysis:');
  console.log('=====================================');
  
  for (let i = 1; i <= 3; i++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + i);
    futureDate.setHours(0, 0, 0, 0);
    
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const futureSummaries = await getSummariesByDate(futureDate);
    
    console.log(`Day +${i} (${futureDateStr}): ${futureSummaries.length} summaries available`);
  }
  
  console.log('\nNote: Future dates will show 0 summaries until videos are processed.');
}

// Run the test
testDailyReport().then(() => {
  showUpcomingReports();
}).catch(console.error);
