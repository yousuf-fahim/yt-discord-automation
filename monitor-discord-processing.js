/**
 * Real-time Discord message monitoring to debug processing issues
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

async function monitorDiscordProcessing() {
  console.log('🔍 REAL-TIME DISCORD MESSAGE MONITORING');
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
    const database = await serviceManager.getService('database');
    
    // Wait for bot to be ready
    console.log('\n⏳ Waiting for Discord bot to be ready...');
    
    await new Promise((resolve) => {
      discord.client.once('ready', () => {
        console.log(`✅ Bot ready: ${discord.client.user.tag}`);
        resolve();
      });
    });

    console.log('\n🎯 Bot is now monitoring messages. Post a YouTube link in Discord to test...');
    console.log('📊 Current database counts:');
    
    const currentSummaries = await database.getRecentSummaries(24);
    const currentTranscripts = await database.searchTranscripts('', 10);
    console.log(`   Recent summaries (24h): ${currentSummaries.length}`);
    console.log(`   Recent transcripts: ${currentTranscripts.length}`);

    // Enhanced message monitoring with detailed logging
    let messageCount = 0;
    
    const messageHandler = async (message) => {
      messageCount++;
      console.log(`\n📨 Message #${messageCount} received at ${new Date().toLocaleTimeString()}`);
      console.log(`   Channel: #${message.channel.name}`);
      console.log(`   Author: ${message.author.username} (bot: ${message.author.bot})`);
      console.log(`   Content: "${message.content}"`);
      
      // Check processing conditions
      const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
      const match = message.content.match(youtubeRegex);
      const shouldProcess = discord.shouldProcessChannel(message.channel.name);
      const isOwnBot = message.author.id === discord.client.user?.id;
      const isTrustedBot = message.author.bot && discord.isTrustedBot(message.author);
      
      console.log(`   🔍 Analysis:`);
      console.log(`      YouTube link: ${match ? `YES (${match[1]})` : 'NO'}`);
      console.log(`      Channel allowed: ${shouldProcess ? 'YES' : 'NO'}`);
      console.log(`      Own bot: ${isOwnBot ? 'YES (skip)' : 'NO'}`);
      console.log(`      Trusted bot: ${isTrustedBot ? 'YES' : 'NO'}`);
      
      const willProcess = match && shouldProcess && !isOwnBot && (!message.author.bot || isTrustedBot);
      console.log(`      🎯 WILL PROCESS: ${willProcess ? 'YES' : 'NO'}`);
      
      if (willProcess) {
        console.log(`   ⚡ Processing video: ${match[1]}`);
        console.log(`   🕐 Started processing at: ${new Date().toLocaleTimeString()}`);
        
        // Track database changes
        const beforeSummaries = await database.getRecentSummaries(1);
        const beforeTranscripts = await database.searchTranscripts(match[1], 1);
        
        console.log(`   📊 Database before processing:`);
        console.log(`      Recent summaries: ${beforeSummaries.length}`);
        console.log(`      This video transcript: ${beforeTranscripts.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
        
        // Wait a bit and check database changes
        setTimeout(async () => {
          try {
            const afterSummaries = await database.getRecentSummaries(1);
            const afterTranscripts = await database.searchTranscripts(match[1], 1);
            
            console.log(`   📊 Database after processing (30s later):`);
            console.log(`      Recent summaries: ${afterSummaries.length}`);
            console.log(`      This video transcript: ${afterTranscripts.length > 0 ? 'EXISTS' : 'NOT FOUND'}`);
            
            const summaryAdded = afterSummaries.length > beforeSummaries.length;
            const transcriptAdded = afterTranscripts.length > beforeTranscripts.length;
            
            console.log(`   🎯 Results:`);
            console.log(`      Transcript saved: ${transcriptAdded ? 'YES ✅' : 'NO ❌'}`);
            console.log(`      Summary saved: ${summaryAdded ? 'YES ✅' : 'NO ❌'}`);
            
            if (!transcriptAdded && !summaryAdded) {
              console.log(`   🚨 ERROR: Nothing was saved to database!`);
            }
          } catch (error) {
            console.log(`   ❌ Error checking database: ${error.message}`);
          }
        }, 30000); // Check after 30 seconds
        
        // Also check after 60 seconds for summary (takes longer)
        setTimeout(async () => {
          try {
            const finalSummaries = await database.getRecentSummaries(1);
            const videoSummary = finalSummaries.find(s => s.video_id === match[1]);
            
            console.log(`   📊 Final check (60s): Summary for ${match[1]}: ${videoSummary ? 'SAVED ✅' : 'NOT SAVED ❌'}`);
            
            if (videoSummary) {
              console.log(`      Title: ${videoSummary.title}`);
              console.log(`      Created: ${videoSummary.created_at}`);
            }
          } catch (error) {
            console.log(`   ❌ Error in final check: ${error.message}`);
          }
        }, 60000); // Check after 60 seconds
      }
    };

    discord.client.on('messageCreate', messageHandler);

    console.log('\n👂 Monitoring active. Post YouTube links in Discord to see real-time processing...');
    console.log('   Press Ctrl+C to stop monitoring');
    
    // Keep monitoring until interrupted
    process.on('SIGINT', () => {
      console.log('\n🔚 Stopping monitor...');
      discord.client.off('messageCreate', messageHandler);
      console.log('✅ Monitor stopped');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Monitor error:', error);
  }
}

monitorDiscordProcessing().catch(console.error);