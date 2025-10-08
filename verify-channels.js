#!/usr/bin/env node

/**
 * Channel Mapping Verification Script
 * This script helps verify that reports are being sent to the correct channels
 */

const ServiceManager = require('./src/core/service-manager');

async function verifyChannelMapping() {
  console.log('🔍 Channel Mapping Verification\n');
  
  try {
    const serviceManager = new ServiceManager();
    await serviceManager.initialize();
    
    const discordService = serviceManager.services.get('discord');
    if (!discordService) {
      console.log('❌ Discord service not found. Make sure the bot is configured.');
      return;
    }
    
    // Wait for Discord client to be ready
    if (!discordService.client.isReady()) {
      console.log('🔄 Waiting for Discord client to be ready...');
      await new Promise(resolve => {
        discordService.client.once('ready', resolve);
      });
    }
    
    const guild = discordService.client.guilds.cache.get(discordService.config.guildId);
    if (!guild) {
      console.log('❌ Discord guild not found. Check DISCORD_GUILD_ID.');
      return;
    }
    
    console.log(`✅ Connected to Discord server: ${guild.name}\n`);
    
    // Check report channels
    console.log('📊 Report Channel Analysis:');
    console.log('');
    
    // Daily Report Channels
    console.log('📅 DAILY REPORT CHANNELS:');
    const dailyChannels = guild.channels.cache.filter(ch => 
      ch.name && ch.name.includes('daily-report')
    );
    if (dailyChannels.size === 0) {
      console.log('❌ No daily report channels found');
    } else {
      dailyChannels.forEach(channel => {
        console.log(`✅ Found: #${channel.name} (ID: ${channel.id})`);
      });
    }
    console.log('');
    
    // Weekly Report Channels
    console.log('📊 WEEKLY REPORT CHANNELS:');
    const weeklyChannels = guild.channels.cache.filter(ch => 
      ch.name && ch.name.includes('weekly-report')
    );
    if (weeklyChannels.size === 0) {
      console.log('❌ No weekly report channels found');
    } else {
      weeklyChannels.forEach(channel => {
        console.log(`✅ Found: #${channel.name} (ID: ${channel.id})`);
      });
    }
    console.log('');
    
    // Monthly Report Channels  
    console.log('📈 MONTHLY REPORT CHANNELS:');
    const monthlyChannels = guild.channels.cache.filter(ch => 
      ch.name && ch.name.includes('monthly-report')
    );
    if (monthlyChannels.size === 0) {
      console.log('❌ No monthly report channels found');
    } else {
      monthlyChannels.forEach(channel => {
        console.log(`✅ Found: #${channel.name} (ID: ${channel.id})`);
      });
    }
    console.log('');
    
    // Check prompt channels
    console.log('📝 PROMPT CHANNELS:');
    console.log('');
    
    const config = discordService.config;
    
    // Daily prompt channels
    const dailyPromptChannels = guild.channels.cache.filter(ch => 
      ch.name && (
        ch.name.startsWith(config.prefixes.dailyReportPrompt) ||
        ch.name === config.prefixes.dailyReportPrompt.slice(0, -1)
      )
    );
    console.log('📅 Daily Report Prompt Channels:');
    if (dailyPromptChannels.size === 0) {
      console.log('❌ No daily report prompt channels found');
    } else {
      dailyPromptChannels.forEach(channel => {
        const suffix = channel.name.replace(config.prefixes.dailyReportPrompt, '');
        const expectedOutput = suffix ? `daily-report-${suffix}` : 'daily-report';
        console.log(`✅ #${channel.name} → expected output: #${expectedOutput}`);
      });
    }
    console.log('');
    
    // Weekly prompt channels
    const weeklyPromptChannels = guild.channels.cache.filter(ch => 
      ch.name && (
        ch.name.startsWith(config.prefixes.weeklyReportPrompt) ||
        ch.name === config.prefixes.weeklyReportPrompt.slice(0, -1)
      )
    );
    console.log('📊 Weekly Report Prompt Channels:');
    if (weeklyPromptChannels.size === 0) {
      console.log('❌ No weekly report prompt channels found');
    } else {
      weeklyPromptChannels.forEach(channel => {
        const suffix = channel.name.replace(config.prefixes.weeklyReportPrompt, '');
        const expectedOutput = suffix ? `weekly-report-${suffix}` : 'weekly-report';
        console.log(`✅ #${channel.name} → expected output: #${expectedOutput}`);
      });
    }
    console.log('');
    
    // Monthly prompt channels
    const monthlyPromptChannels = guild.channels.cache.filter(ch => 
      ch.name && (
        ch.name.startsWith(config.prefixes.monthlyReportPrompt) ||
        ch.name === config.prefixes.monthlyReportPrompt.slice(0, -1)
      )
    );
    console.log('📈 Monthly Report Prompt Channels:');
    if (monthlyPromptChannels.size === 0) {
      console.log('❌ No monthly report prompt channels found');
    } else {
      monthlyPromptChannels.forEach(channel => {
        const suffix = channel.name.replace(config.prefixes.monthlyReportPrompt, '');
        const expectedOutput = suffix ? `monthly-report-${suffix}` : 'monthly-report';
        console.log(`✅ #${channel.name} → expected output: #${expectedOutput}`);
      });
    }
    console.log('');
    
    console.log('🎯 VERIFICATION SUMMARY:');
    console.log('├── Check that each prompt channel has a corresponding output channel');
    console.log('├── If using numbered prompts (e.g., yt-daily-report-prompt-1),');
    console.log('│   ensure numbered outputs exist (e.g., daily-report-1)');
    console.log('├── Otherwise, reports will use base channels (daily-report, etc.)');
    console.log('└── The fix should now properly handle both scenarios!');
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  verifyChannelMapping();
}

module.exports = { verifyChannelMapping };