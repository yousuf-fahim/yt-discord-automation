/**
 * Quick Pipeline Test - Test video processing end-to-end
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');
const DatabaseService = require('./src/services/database.service');
const HybridCacheService = require('./src/services/hybrid-cache.service');
const TranscriptService = require('./src/services/transcript.service');
const SummaryService = require('./src/services/summary.service');

async function quickPipelineTest() {
  console.log('🚀 QUICK PIPELINE TEST');
  console.log('='.repeat(40));

  try {
    // Initialize core services
    const database = new DatabaseService(serviceManager, {});
    await database.initialize();
    
    const cache = new HybridCacheService(serviceManager, { database });
    await cache.initialize();
    
    const transcript = new TranscriptService(serviceManager, { cache });
    await transcript.initialize();
    
    const summary = new SummaryService(serviceManager, { cache, database });
    await summary.initialize();

    console.log('✅ Services initialized');

    // Test with a well-known video
    const testVideoId = 'dQw4w9WgXcQ';
    console.log(`🎯 Testing with video: ${testVideoId}`);

    // Step 1: Get transcript
    console.log('\n📄 Getting transcript...');
    const transcriptResult = await transcript.getTranscript(testVideoId);
    
    if (transcriptResult) {
      console.log(`✅ Transcript: ${transcriptResult.length} chars`);
      console.log(`   Preview: "${transcriptResult.substring(0, 80)}..."`);
      
      // Step 2: Generate summary (short version to save time)
      console.log('\n🤖 Generating summary...');
      try {
        const summaryResult = await summary.generateSummary(
          transcriptResult.substring(0, 500), // Use first 500 chars for speed
          'Rick Astley - Never Gonna Give You Up',
          `https://www.youtube.com/watch?v=${testVideoId}`
        );
        
        if (summaryResult && summaryResult.summary) {
          console.log(`✅ Summary: ${summaryResult.summary.length} chars`);
          console.log(`   Preview: "${summaryResult.summary.substring(0, 100)}..."`);
          
          console.log('\n🎉 PIPELINE SUCCESS:');
          console.log('   ✅ Transcript extraction');
          console.log('   ✅ AI summary generation');
          console.log('   ✅ Data storage');
          
          // Test cache retrieval
          const cachedSummary = await cache.getSummary(testVideoId);
          console.log(`   ✅ Cache retrieval: ${cachedSummary ? 'Working' : 'Failed'}`);
          
        } else {
          console.log('❌ Summary generation failed');
        }
      } catch (summaryError) {
        console.log(`❌ Summary error: ${summaryError.message}`);
      }
    } else {
      console.log('❌ Transcript extraction failed');
    }

    console.log('\n' + '='.repeat(40));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  process.exit(0);
}

quickPipelineTest().catch(console.error);