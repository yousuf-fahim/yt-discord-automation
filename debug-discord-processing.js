/**
 * Diagnostic script to check Discord bot message processing
 */

require('dotenv').config();
const ServiceManager = require('./src/core/service-manager');

// Import service classes
const DiscordService = require('./src/services/discord.service');
const TranscriptService = require('./src/services/transcript.service');
const SummaryService = require('./src/services/summary.service');
const ReportService = require('./src/services/report.service');
const HybridCacheService = require('./src/services/hybrid-cache.service');
const DatabaseService = require('./src/services/database.service');

async function debugDiscordBot() {
  console.log('🔍 DISCORD BOT MESSAGE PROCESSING DIAGNOSTIC');
  console.log('=' .repeat(50));

  const serviceManager = new ServiceManager();
  
  try {
    // Register services
    serviceManager.registerService('database', DatabaseService);
    serviceManager.registerService('cache', HybridCacheService, ['database']);
    serviceManager.registerService('transcript', TranscriptService, ['cache']);
    serviceManager.registerService('summary', SummaryService, ['cache', 'database']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache', 'database']);
    serviceManager.registerService('discord', DiscordService, ['transcript', 'summary', 'report']);

    // Initialize services
    await serviceManager.initializeAll();
    console.log('✅ Services initialized');

    const discord = await serviceManager.getService('discord');
    
    // Check bot configuration
    console.log('\n🤖 Bot Configuration:');
    console.log(`Guild ID: ${discord.config.guildId}`);
    console.log(`Upload channel: ${discord.config.channels.uploads}`);
    console.log(`Allowed patterns: ${discord.config.allowedChannelPatterns.join(', ')}`);
    console.log(`Trusted bots: ${discord.config.trustedBots.join(', ')}`);

    // Wait for bot to be ready
    console.log('\n⏳ Waiting for Discord bot to be ready...');
    
    await new Promise((resolve) => {
      discord.client.once('ready', () => {
        console.log(`✅ Bot ready: ${discord.client.user.tag}`);
        resolve();
      });
    });

    // Check guild access
    const guild = discord.client.guilds.cache.get(discord.config.guildId);
    if (!guild) {
      console.log(`❌ Cannot access guild: ${discord.config.guildId}`);
      return;
    }
    
    console.log(`✅ Guild found: ${guild.name} (${guild.memberCount} members)`);

    // List all channels to see what's available
    console.log('\n📋 Available channels:');
    guild.channels.cache.forEach(channel => {
      if (channel.type === 0) { // Text channel
        const shouldProcess = discord.shouldProcessChannel(channel.name);
        console.log(`  ${shouldProcess ? '✅' : '⚪'} #${channel.name} (${shouldProcess ? 'will process' : 'will ignore'})`);
      }
    });

    // Test channel processing logic
    console.log('\n🧪 Testing channel processing logic:');
    const testChannels = ['youtube', 'general', 'random', 'yt-uploads', 'links', 'videos'];
    testChannels.forEach(channelName => {
      const shouldProcess = discord.shouldProcessChannel(channelName);
      console.log(`  ${shouldProcess ? '✅' : '❌'} ${channelName}: ${shouldProcess ? 'WILL PROCESS' : 'WILL IGNORE'}`);
    });

    // Test YouTube link detection
    console.log('\n🔗 Testing YouTube link detection:');
    const testMessages = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'Check this out: https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=jNQXAC9IVRw me at the zoo',
      'Just some random text without links'
    ];
    
    testMessages.forEach(content => {
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const match = content.match(youtubeRegex);
      console.log(`  ${match ? '✅' : '❌'} "${content}" -> ${match ? `Video ID: ${match[1]}` : 'No match'}`);
    });

    // Monitor message events for 30 seconds
    console.log('\n👂 Monitoring messages for 30 seconds...');
    console.log('   Send some YouTube links in Discord to test processing');
    
    let messageCount = 0;
    let processedCount = 0;
    
    const messageHandler = async (message) => {
      messageCount++;
      console.log(`\n📨 Message #${messageCount} received:`);
      console.log(`   Channel: #${message.channel.name}`);
      console.log(`   Author: ${message.author.username} (bot: ${message.author.bot})`);
      console.log(`   Content: "${message.content}"`);
      
      // Check if this would be processed
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const match = message.content.match(youtubeRegex);
      const shouldProcess = discord.shouldProcessChannel(message.channel.name);
      const isOwnBot = message.author.id === discord.client.user?.id;
      const isTrustedBot = message.author.bot && discord.isTrustedBot(message.author);
      
      console.log(`   YouTube link: ${match ? `YES (${match[1]})` : 'NO'}`);
      console.log(`   Channel allowed: ${shouldProcess ? 'YES' : 'NO'}`);
      console.log(`   Own bot: ${isOwnBot ? 'YES (skip)' : 'NO'}`);
      console.log(`   Trusted bot: ${isTrustedBot ? 'YES' : 'NO'}`);
      
      const willProcess = match && shouldProcess && !isOwnBot && (!message.author.bot || isTrustedBot);
      console.log(`   🎯 WILL PROCESS: ${willProcess ? 'YES' : 'NO'}`);
      
      if (willProcess) {
        processedCount++;
        console.log(`   ⚡ Processing video: ${match[1]}`);
      }
    };

    discord.client.on('messageCreate', messageHandler);

    // Wait 30 seconds
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Remove listener
    discord.client.off('messageCreate', messageHandler);

    console.log(`\n📊 Monitoring Results:`);
    console.log(`   Total messages received: ${messageCount}`);
    console.log(`   Videos processed: ${processedCount}`);

    // Check database for any new records
    const database = await serviceManager.getService('database');
    const currentSummaries = await database.getAllSummaries();
    const currentTranscripts = await database.getAllTranscripts();
    
    console.log(`\n💾 Current database counts:`);
    console.log(`   Summaries: ${currentSummaries.length}`);
    console.log(`   Transcripts: ${currentTranscripts.length}`);

    // Test trigger-report manually
    console.log(`\n📊 Testing manual report generation...`);
    const report = await serviceManager.getService('report');
    const dailyReport = await report.generateDailyReport();
    
    if (dailyReport && dailyReport.videos && dailyReport.videos.length > 0) {
      console.log(`✅ Daily report generated with ${dailyReport.videos.length} videos`);
      console.log(`   Report date: ${dailyReport.date}`);
      console.log(`   Report summary: ${dailyReport.summary ? dailyReport.summary.substring(0, 100) + '...' : 'No summary'}`);
    } else {
      console.log(`⚠️ Daily report generated but no videos found`);
      console.log(`   This might be why trigger-report shows "No activity"`);
    }

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    console.log('\n🔚 Diagnostic complete. Bot will remain running for testing.');
    console.log('   Press Ctrl+C to exit');
  }
}

debugDiscordBot().catch(console.error);