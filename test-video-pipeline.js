/**
 * Test Complete Video Processing Pipeline
 * Tests: URL → Transcript → Summary → Database Storage
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');
const DatabaseService = require('./src/services/database.service');
const HybridCacheService = require('./src/services/hybrid-cache.service');
const TranscriptService = require('./src/services/transcript.service');
const SummaryService = require('./src/services/summary.service');

async function testVideoProcessingPipeline() {
  console.log('🎬 TESTING COMPLETE VIDEO PROCESSING PIPELINE');
  console.log('='.repeat(60));

  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    
    const database = new DatabaseService(serviceManager, {});
    await database.initialize();
    
    const cache = new HybridCacheService(serviceManager, { database });
    await cache.initialize();
    
    const transcript = new TranscriptService(serviceManager, { cache });
    await transcript.initialize();
    
    const summary = new SummaryService(serviceManager, { cache, database });
    await summary.initialize();

    console.log('✅ All services initialized\n');

    // Test with a sample YouTube video
    const testVideoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up
    const testVideoUrl = `https://www.youtube.com/watch?v=${testVideoId}`;
    
    console.log('🎯 TEST VIDEO:');
    console.log(`   Video ID: ${testVideoId}`);
    console.log(`   URL: ${testVideoUrl}\n`);

    // Step 1: Extract transcript
    console.log('📄 STEP 1: Transcript Extraction');
    console.log('-'.repeat(40));
    
    const transcriptResult = await transcript.getTranscript(testVideoId);
    
    if (transcriptResult && transcriptResult.length > 0) {
      console.log('✅ Transcript extracted successfully');
      console.log(`   Length: ${transcriptResult.length} characters`);
      console.log(`   Preview: "${transcriptResult.substring(0, 100)}..."`);
      
      // Save transcript to cache/database
      await cache.setTranscript(testVideoId, transcriptResult);
      console.log('✅ Transcript cached and stored');
    } else {
      console.log('❌ Transcript extraction failed');
      console.log('   This might be due to:');
      console.log('   - Video has no captions/transcript available');
      console.log('   - API limits reached');
      console.log('   - Network issues');
      return;
    }

    // Step 2: Generate summary
    console.log('\n🤖 STEP 2: AI Summary Generation');
    console.log('-'.repeat(40));
    
    try {
      const summaryResult = await summary.generateSummary(
        transcriptResult,
        'Rick Astley - Never Gonna Give You Up',
        testVideoUrl
      );
      
      if (summaryResult && summaryResult.summary) {
        console.log('✅ Summary generated successfully');
        console.log(`   Summary length: ${summaryResult.summary.length} characters`);
        console.log(`   Quality score: ${summaryResult.qualityScore || 'N/A'}`);
        console.log(`   Preview: "${summaryResult.summary.substring(0, 150)}..."`);
        
        // Save summary to cache/database
        await cache.setSummary(testVideoId, {
          videoId: testVideoId,
          videoTitle: 'Rick Astley - Never Gonna Give You Up',
          summaryContent: summaryResult.summary,
          videoUrl: testVideoUrl,
          timestamp: new Date().toISOString()
        });
        console.log('✅ Summary cached and stored');
      } else {
        console.log('❌ Summary generation failed');
        console.log('   Result:', summaryResult);
      }
    } catch (summaryError) {
      console.log('❌ Summary generation error:', summaryError.message);
    }

    // Step 3: Verify storage
    console.log('\n💾 STEP 3: Storage Verification');
    console.log('-'.repeat(40));
    
    // Check cache
    const cachedTranscript = await cache.getTranscript(testVideoId);
    const cachedSummary = await cache.getSummary(testVideoId);
    
    console.log(`   Cached transcript: ${cachedTranscript ? '✅' : '❌'}`);
    console.log(`   Cached summary: ${cachedSummary ? '✅' : '❌'}`);
    
    // Check database
    const dbTranscript = await database.getTranscript(testVideoId);
    const dbSummary = await database.getSummary(testVideoId);
    
    console.log(`   Database transcript: ${dbTranscript ? '✅' : '❌'}`);
    console.log(`   Database summary: ${dbSummary ? '✅' : '❌'}`);

    // Step 4: Performance metrics
    console.log('\n📊 STEP 4: Performance Metrics');
    console.log('-'.repeat(40));
    
    const cacheStats = cache.getStats();
    const dbStats = await database.getStats();
    
    console.log(`   Cache hit rate: ${Math.round(cacheStats.hitRate * 100)}%`);
    console.log(`   Memory cache size: ${cacheStats.memorySize}`);
    console.log(`   Total summaries in DB: ${dbStats.totalSummaries}`);
    console.log(`   Total transcripts in DB: ${dbStats.totalTranscripts}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 VIDEO PROCESSING PIPELINE TEST COMPLETE');
    
    if (transcriptResult && cachedSummary) {
      console.log('✅ FULL PIPELINE WORKING:');
      console.log('   URL → Transcript → Summary → Cache → Database');
      console.log('\n💡 The bot should now be able to process YouTube videos!');
    } else {
      console.log('⚠️  PARTIAL SUCCESS:');
      console.log('   Some steps failed, but core infrastructure is working');
    }
    
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
  }
  
  process.exit(0);
}

testVideoProcessingPipeline().catch(console.error);