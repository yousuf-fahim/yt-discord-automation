#!/usr/bin/env node

/**
 * Bot Deployment Diagnostic Tool
 * Helps identify why the Discord bot isn't responding after deployment
 */

require('dotenv').config();

console.log('🔍 Discord Bot Deployment Diagnostic');
console.log('====================================');

// Critical Environment Variables
const requiredVars = {
  'DISCORD_BOT_TOKEN': {
    value: process.env.DISCORD_BOT_TOKEN,
    required: true,
    description: 'Discord bot token for authentication'
  },
  'DISCORD_GUILD_ID': {
    value: process.env.DISCORD_GUILD_ID,
    required: true,
    description: 'Discord server (guild) ID where bot operates'
  },
  'OPENAI_API_KEY': {
    value: process.env.OPENAI_API_KEY,
    required: true,
    description: 'OpenAI API key for summarization'
  },
  'YOUTUBE_TRANSCRIPT_IO_TOKEN': {
    value: process.env.YOUTUBE_TRANSCRIPT_IO_TOKEN,
    required: true,
    description: 'YouTube Transcript IO API token'
  }
};

// Optional but recommended
const optionalVars = {
  'PORT': process.env.PORT,
  'NODE_ENV': process.env.NODE_ENV,
  'YOUTUBE_API_KEY': process.env.YOUTUBE_API_KEY,
  'DISCORD_YT_SUMMARIES_CHANNEL': process.env.DISCORD_YT_SUMMARIES_CHANNEL,
  'DISCORD_TRUSTED_BOTS': process.env.DISCORD_TRUSTED_BOTS,
  'DAILY_REPORT_HOUR': process.env.DAILY_REPORT_HOUR,
  'DAILY_REPORT_MINUTE': process.env.DAILY_REPORT_MINUTE
};

console.log('\n🔑 Environment Variables Check:');
console.log('==============================');

let missingRequired = [];
let hasIssues = false;

// Check required variables
for (const [key, config] of Object.entries(requiredVars)) {
  const status = config.value ? '✅' : '❌';
  const masked = config.value ? `${config.value.substring(0, 8)}...` : 'NOT SET';
  console.log(`${status} ${key}: ${masked}`);
  
  if (!config.value) {
    console.log(`   ⚠️  ${config.description}`);
    missingRequired.push(key);
    hasIssues = true;
  }
}

console.log('\n📋 Optional Variables:');
console.log('=====================');

// Check optional variables
for (const [key, value] of Object.entries(optionalVars)) {
  const status = value ? '✅' : '⚪';
  const display = value || 'Using default';
  console.log(`${status} ${key}: ${display}`);
}

console.log('\n🏥 Service Dependencies Check:');
console.log('=============================');

// Test basic service initialization
async function testServices() {
  try {
    // Test Discord.js import
    const Discord = require('discord.js');
    console.log('✅ Discord.js: Available');
    
    // Test OpenAI import
    const OpenAI = require('openai');
    console.log('✅ OpenAI: Available');
    
    // Test cron
    const cron = require('node-cron');
    console.log('✅ Node-cron: Available');
    
    // Test service manager
    const { serviceManager } = require('./src/core/service-manager');
    console.log('✅ Service Manager: Available');
    
  } catch (error) {
    console.log(`❌ Dependency Error: ${error.message}`);
    hasIssues = true;
  }
}

// Test Discord token validity
async function testDiscordConnection() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.log('❌ Discord Connection: Cannot test - missing token');
    return;
  }
  
  try {
    const { Client, GatewayIntentBits } = require('discord.js');
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    console.log('🔄 Testing Discord connection...');
    
    const loginPromise = client.login(process.env.DISCORD_BOT_TOKEN);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );
    
    await Promise.race([loginPromise, timeoutPromise]);
    
    client.once('ready', () => {
      console.log('✅ Discord Connection: Successfully connected');
      console.log(`   Bot: ${client.user.tag}`);
      console.log(`   Guilds: ${client.guilds.cache.size}`);
      client.destroy();
    });
    
  } catch (error) {
    console.log(`❌ Discord Connection: ${error.message}`);
    hasIssues = true;
  }
}

// Main diagnostic
async function runDiagnostic() {
  await testServices();
  await testDiscordConnection();
  
  console.log('\n📊 Summary:');
  console.log('==========');
  
  if (missingRequired.length > 0) {
    console.log(`❌ Missing ${missingRequired.length} required environment variables:`);
    missingRequired.forEach(key => console.log(`   - ${key}`));
    console.log('\n🔧 Fix: Set these environment variables in your deployment platform');
  }
  
  if (hasIssues) {
    console.log('\n🚨 Issues found! Bot may not work properly.');
    console.log('\n💡 Common deployment solutions:');
    console.log('   1. Verify all environment variables are set');
    console.log('   2. Check Discord bot permissions in server');
    console.log('   3. Ensure bot token has correct intents enabled');
    console.log('   4. Verify deployment platform is using correct Procfile');
    console.log('   5. Check logs for specific error messages');
  } else {
    console.log('✅ All checks passed! Bot should be working.');
  }
  
  console.log('\n🔍 Next steps if bot still not responding:');
  console.log('   1. Check deployment platform logs');
  console.log('   2. Verify bot is actually running (not just deployed)');
  console.log('   3. Test slash commands registration with /health');
  console.log('   4. Check Discord bot permissions and scopes');
}

// Run if called directly
if (require.main === module) {
  runDiagnostic().catch(console.error);
}

module.exports = { runDiagnostic };
