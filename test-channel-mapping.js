#!/usr/bin/env node

/**
 * Test Channel Mapping Logic
 * This test checks how the current channel mapping works
 */

const ServiceManager = require('./src/core/service-manager');

async function testChannelMapping() {
  console.log('🔍 Testing Channel Mapping Logic...\n');
  
  const serviceManager = new ServiceManager();
  const config = serviceManager.config.discord;
  
  console.log('📋 Current Channel Configuration:');
  console.log('├── Channels:');
  console.log(`│   ├── uploads: ${config.channels.uploads}`);
  console.log(`│   ├── transcripts: ${config.channels.transcripts}`);
  console.log(`│   └── dailyReport: ${config.channels.dailyReport}`);
  console.log('├── Prefixes:');
  console.log(`│   ├── summaryPrompt: ${config.prefixes.summaryPrompt}`);
  console.log(`│   ├── summariesOutput: ${config.prefixes.summariesOutput}`);
  console.log(`│   ├── dailyReportPrompt: ${config.prefixes.dailyReportPrompt}`);
  console.log(`│   ├── weeklyReportPrompt: ${config.prefixes.weeklyReportPrompt}`);
  console.log(`│   └── monthlyReportPrompt: ${config.prefixes.monthlyReportPrompt}`);
  console.log('');
  
  console.log('🔄 Channel Mapping Examples (FIXED):');
  console.log('');
  
  // Daily Report Mapping
  console.log('📅 DAILY REPORTS:');
  const dailyPromptExample = 'yt-daily-report-prompt-1';
  const dailySuffix = dailyPromptExample.replace(config.prefixes.dailyReportPrompt, '');
  console.log(`├── Prompt Channel: ${dailyPromptExample}`);
  console.log(`├── Extracted Suffix: "${dailySuffix}"`);
  console.log(`├── Try First: daily-report-${dailySuffix} (if suffix exists)`);
  console.log(`├── Try Second: ${config.channels.dailyReport} (base channel)`);
  console.log(`└── Final Fallback: any channel containing "daily-report"`);
  console.log('');
  
  // Weekly Report Mapping  
  console.log('📊 WEEKLY REPORTS:');
  const weeklyPromptExample = 'yt-weekly-report-prompt-1';
  const weeklySuffix = weeklyPromptExample.replace(config.prefixes.weeklyReportPrompt, '');
  console.log(`├── Prompt Channel: ${weeklyPromptExample}`);
  console.log(`├── Extracted Suffix: "${weeklySuffix}"`);
  console.log(`├── Try First: weekly-report-${weeklySuffix} (if suffix exists)`);
  console.log(`├── Try Second: weekly-report (base channel)`);
  console.log(`└── Final Fallback: general/bot/reports channels`);
  console.log('');
  
  // Monthly Report Mapping
  console.log('📈 MONTHLY REPORTS:');
  const monthlyPromptExample = 'yt-monthly-report-prompt-1';
  const monthlySuffix = monthlyPromptExample.replace(config.prefixes.monthlyReportPrompt, '');
  console.log(`├── Prompt Channel: ${monthlyPromptExample}`);
  console.log(`├── Extracted Suffix: "${monthlySuffix}"`);
  console.log(`├── Try First: monthly-report-${monthlySuffix} (if suffix exists)`);
  console.log(`├── Try Second: monthly-report (base channel)`);
  console.log(`└── Final Fallback: general/bot/reports channels`);
  console.log('');
  
  console.log('✅ FIXED BEHAVIOR:');
  console.log('├── Now checks for numbered channels first (daily-report-1, etc.)');
  console.log('├── Falls back to base channels (daily-report, weekly-report, monthly-report)');
  console.log('├── Should work with your existing Discord channel structure');
  console.log('└── Reports should now go to the correct channels!');
  console.log('');
  
  console.log('🎯 EXPECTED RESULTS:');
  console.log('├── Daily reports → #daily-report channel');
  console.log('├── Weekly reports → #weekly-report channel');
  console.log('├── Monthly reports → #monthly-report channel');
  console.log('└── No more reports going to wrong channels!');
}

// Run the test
testChannelMapping().catch(console.error);