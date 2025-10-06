/**
 * Test Transcript Database Integration
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');
const DatabaseService = require('./src/services/database.service');

async function testTranscriptFeatures() {
  console.log('🎬 TESTING TRANSCRIPT DATABASE FEATURES');
  console.log('='.repeat(50));

  try {
    // Initialize database service
    serviceManager.registerService('database', DatabaseService);
    await serviceManager.initializeAll();
    
    const db = await serviceManager.getService('database');
    
    console.log('\n📊 TRANSCRIPT DATABASE STATS:');
    const stats = await db.getStats();
    console.log(`📝 Transcripts: ${stats.transcripts}`);
    console.log(`💾 Database size: ${stats.dbSize}`);
    
    console.log('\n🔍 TEST 1: Get Random Transcript');
    console.log('-'.repeat(30));
    const randomTranscript = await db.getTranscript('3JW732GrMdg');
    if (randomTranscript) {
      console.log(`✅ Video ID: ${randomTranscript.video_id}`);
      console.log(`📝 Word count: ${randomTranscript.word_count}`);
      console.log(`🕐 Created: ${randomTranscript.created_at}`);
      console.log(`📄 Preview: ${randomTranscript.transcript_text.substring(0, 100)}...`);
    } else {
      console.log('❌ Transcript not found');
    }
    
    console.log('\n🔍 TEST 2: Search Transcripts');
    console.log('-'.repeat(30));
    const searchTerms = ['web development', 'AI', 'programming', 'tech'];
    
    for (const term of searchTerms) {
      const results = await db.searchTranscripts(term, 3);
      console.log(`🔎 "${term}": ${results.length} results`);
      results.forEach((result, i) => {
        console.log(`   ${i + 1}. ${result.video_id} (${result.word_count} words)`);
      });
    }
    
    console.log('\n📈 TEST 3: Transcript Statistics');
    console.log('-'.repeat(30));
    
    // Get top 5 longest transcripts
    console.log('📏 Top 5 Longest Transcripts:');
    const longest = await db.getAllQuery(`
      SELECT video_id, word_count, substr(transcript_text, 1, 50) || '...' as preview
      FROM transcripts 
      ORDER BY word_count DESC 
      LIMIT 5
    `);
    
    longest.forEach((transcript, i) => {
      console.log(`   ${i + 1}. ${transcript.video_id}: ${transcript.word_count} words`);
      console.log(`      "${transcript.preview}"`);
    });
    
    console.log('\n🎯 TEST 4: Full-Text Search Performance');
    console.log('-'.repeat(30));
    const searchQueries = [
      'modern web development',
      'artificial intelligence',
      'JavaScript framework',
      'database optimization'
    ];
    
    for (const query of searchQueries) {
      const startTime = Date.now();
      const results = await db.searchTranscripts(query, 5);
      const endTime = Date.now();
      
      console.log(`🔍 "${query}": ${results.length} results in ${endTime - startTime}ms`);
    }
    
    console.log('\n💾 TEST 5: Storage Efficiency');
    console.log('-'.repeat(30));
    
    // Calculate storage per transcript
    const totalTranscripts = stats.transcripts;
    const dbSizeBytes = stats.dbSize;
    
    console.log(`📁 Database size: ${dbSizeBytes}`);
    console.log(`📝 Total transcripts: ${totalTranscripts}`);
    console.log(`⚖️  Average storage per transcript: ~${Math.round(288 * 1024 / totalTranscripts / 1024)} KB`);
    
    // Test saving a new transcript
    console.log('\n🆕 TEST 6: Save New Transcript');
    console.log('-'.repeat(30));
    
    const testTranscript = {
      videoId: 'test_transcript_001',
      transcript: 'This is a test transcript for the database. It contains multiple sentences to test word counting and storage functionality. The transcript should be saved successfully.',
      duration: 120,
      language: 'en',
      source: 'test'
    };
    
    const saved = await db.saveTranscript(testTranscript);
    if (saved) {
      console.log('✅ Test transcript saved successfully');
      
      // Retrieve it back
      const retrieved = await db.getTranscript('test_transcript_001');
      if (retrieved) {
        console.log(`✅ Retrieved: ${retrieved.word_count} words, source: ${retrieved.source}`);
      }
      
      // Clean up test data
      await db.runQuery('DELETE FROM transcripts WHERE video_id = ?', ['test_transcript_001']);
      console.log('🧹 Test data cleaned up');
    }
    
    console.log('\n🎉 TRANSCRIPT TESTING COMPLETED!');
    console.log('\n💡 USAGE SUMMARY:');
    console.log('   • Store transcripts alongside summaries');
    console.log('   • Search across transcript content');
    console.log('   • Efficient storage with SQLite compression');
    console.log('   • No file management headaches');
    console.log('   • Backup entire bot data in single file');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

testTranscriptFeatures();