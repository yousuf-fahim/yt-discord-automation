/**
 * Test YouTube Transcript API Service
 * Verifies the free YouTube transcript extraction is working
 */

const YouTubeTranscriptApiService = require('../src/services/youtube-transcript-api.service.js');

async function testYouTubeTranscriptApi() {
  console.log('🧪 Testing YouTube Transcript API Service...\n');

  try {
    // Initialize service
    console.log('1️⃣ Initializing service...');
    const service = new YouTubeTranscriptApiService({
      cacheEnabled: true,
      retryAttempts: 2,
      timeout: 30000
    });

    // Health check
    console.log('2️⃣ Running health check...');
    const health = await service.healthCheck();
    console.log('Health status:', health);

    if (health.status !== 'healthy') {
      console.log('❌ Service not healthy. Please run setup script first:');
      console.log('   bash scripts/setup-youtube-transcript-api.sh');
      return;
    }

    // Test with a known video
    console.log('\n3️⃣ Testing with sample video...');
    const testVideoId = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video
    
    console.log(`📺 Extracting transcript for video: ${testVideoId}`);
    const transcript = await service.getTranscript(testVideoId);

    if (transcript) {
      console.log(`✅ Success! Transcript length: ${transcript.length} characters`);
      console.log(`📝 Preview: "${transcript.substring(0, 200)}..."`);
      
      // Test caching
      console.log('\n4️⃣ Testing cache functionality...');
      const startTime = Date.now();
      const cachedTranscript = await service.getTranscript(testVideoId);
      const cacheTime = Date.now() - startTime;
      
      if (cachedTranscript && cacheTime < 1000) {
        console.log(`✅ Cache working! Retrieved in ${cacheTime}ms`);
      } else {
        console.log('⚠️ Cache may not be working properly');
      }

      console.log('\n🎉 All tests passed! The service is ready for production.');
      console.log('\n💡 To use in your project:');
      console.log('   const service = new YouTubeTranscriptApiService();');
      console.log('   const transcript = await service.getTranscript(videoId);');
      
    } else {
      console.log('❌ Failed to extract transcript');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.message.includes('youtube-transcript-api not installed')) {
      console.log('\n💡 To fix this, run:');
      console.log('   pip install youtube-transcript-api');
      console.log('   # or');
      console.log('   bash scripts/setup-youtube-transcript-api.sh');
    } else if (error.message.includes('Python execution failed')) {
      console.log('\n💡 Python path issues. Try setting PYTHON_PATH environment variable');
    } else {
      console.log('\n💡 Check the error above and ensure all dependencies are installed');
    }
  }
}

// Run the test
if (require.main === module) {
  testYouTubeTranscriptApi().catch(console.error);
}

module.exports = { testYouTubeTranscriptApi };
