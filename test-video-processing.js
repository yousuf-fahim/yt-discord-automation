/**
 * Test YouTube video processing manually to debug the flow
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

async function testVideoProcessing() {
  console.log('🧪 TESTING YOUTUBE VIDEO PROCESSING FLOW');
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

    // Get services
    const transcript = await serviceManager.getService('transcript');
    const summary = await serviceManager.getService('summary');
    const report = await serviceManager.getService('report');
    const database = await serviceManager.getService('database');

    // Test with a known working YouTube video
    const testVideoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up
    const testVideoTitle = 'Rick Astley - Never Gonna Give You Up (Official Video)';

    console.log(`\n📹 Testing with video: ${testVideoId}`);

    // Step 1: Get transcript
    console.log('\n1️⃣ Getting transcript...');
    const transcriptResult = await transcript.getTranscript(testVideoId);
    
    if (!transcriptResult) {
      console.log('❌ Failed to get transcript');
      return;
    }
    
    console.log(`✅ Transcript obtained: ${transcriptResult.length} characters`);

    // Step 2: Save transcript to database
    console.log('\n2️⃣ Saving transcript to database...');
    try {
      await database.saveTranscript(testVideoId, transcriptResult);
      console.log('✅ Transcript saved to database');
    } catch (error) {
      console.log(`❌ Failed to save transcript: ${error.message}`);
    }

    // Step 3: Generate summary
    console.log('\n3️⃣ Generating summary...');
    const summaryResult = await summary.generateSummary(transcriptResult, testVideoTitle, `https://www.youtube.com/watch?v=${testVideoId}`, null);
    
    if (!summaryResult || !summaryResult.summary) {
      console.log('❌ Failed to generate summary');
      return;
    }
    
    console.log(`✅ Summary generated: ${summaryResult.summary.length} characters`);
    console.log(`📝 Summary preview: ${summaryResult.summary.substring(0, 200)}...`);

    // Step 4: Save summary via report service
    console.log('\n4️⃣ Saving summary via report service...');
    try {
      await report.saveSummary({
        videoId: testVideoId,
        videoTitle: testVideoTitle,
        summaryContent: summaryResult.summary,
        videoUrl: `https://www.youtube.com/watch?v=${testVideoId}`
      });
      console.log('✅ Summary saved via report service');
    } catch (error) {
      console.log(`❌ Failed to save summary via report service: ${error.message}`);
      console.log('Error details:', error);
    }

    // Step 5: Check database counts
    console.log('\n5️⃣ Checking database counts...');
    const allSummaries = await database.getRecentSummaries(72); // Get last 72 hours
    const allTranscripts = await database.searchTranscripts('', 100); // Get recent transcripts
    
    console.log(`📊 Database counts:`);
    console.log(`   Recent summaries (72h): ${allSummaries.length}`);
    console.log(`   Recent transcripts: ${allTranscripts.length}`);

    // Step 6: Check if our test data is there
    console.log('\n6️⃣ Checking for our test data...');
    const ourSummary = allSummaries.find(s => s.video_id === testVideoId);
    const ourTranscript = allTranscripts.find(t => t.video_id === testVideoId);
    
    console.log(`   Our summary: ${ourSummary ? '✅ FOUND' : '❌ NOT FOUND'}`);
    console.log(`   Our transcript: ${ourTranscript ? '✅ FOUND' : '❌ NOT FOUND'}`);

    if (ourSummary) {
      console.log(`   Summary title: ${ourSummary.title}`);
      console.log(`   Summary date: ${ourSummary.created_at}`);
    }

    // Step 7: Test report generation
    console.log('\n7️⃣ Testing report generation...');
    const dailyReport = await report.generateDailyReport();
    
    if (dailyReport && dailyReport.videos) {
      console.log(`✅ Daily report generated with ${dailyReport.videos.length} videos`);
      
      // Check if our video is in the report
      const ourVideoInReport = dailyReport.videos.find(v => v.videoId === testVideoId);
      console.log(`   Our video in report: ${ourVideoInReport ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log('❌ Daily report generation failed');
    }

    console.log('\n🎯 TEST COMPLETE');
    console.log('If everything shows ✅, then the processing flow is working correctly.');
    console.log('If you see ❌ errors, those are the issues preventing new data from being stored.');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testVideoProcessing().catch(console.error);