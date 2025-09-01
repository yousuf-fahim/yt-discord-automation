/**
 * Test ProxyMesh Integration
 * Quick test to verify proxy configuration is working
 */

const YouTubeTranscriptApiService = require('./src/services/youtube-transcript-api.service.js');

async function testProxyIntegration() {
  console.log('🧪 Testing ProxyMesh Integration...\n');

  try {
    // Initialize service with proxy config
    console.log('1️⃣ Creating service with proxy configuration...');
    const service = new YouTubeTranscriptApiService({
      cacheEnabled: false, // Disable cache for testing
      retryAttempts: 1,
      timeout: 30000,
      proxyConfig: process.env.PROXY_HOST ? {
        host: process.env.PROXY_HOST,
        port: process.env.PROXY_PORT || '31280',
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD
      } : null
    });

    // Health check
    console.log('2️⃣ Running health check...');
    const health = await service.healthCheck();
    console.log('Health status:', health);

    if (health.proxy_configured) {
      console.log('✅ Proxy detected and configured!');
    } else {
      console.log('❌ No proxy configuration detected');
      return;
    }

    // Test with a simple video
    console.log('\n3️⃣ Testing transcript extraction with proxy...');
    const testVideoId = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video
    
    console.log(`📺 Extracting transcript for video: ${testVideoId}`);
    const transcript = await service.getTranscript(testVideoId);

    if (transcript) {
      console.log(`✅ SUCCESS! Proxy is working!`);
      console.log(`📝 Transcript length: ${transcript.length} characters`);
      console.log(`📝 Preview: "${transcript.substring(0, 100)}..."`);
    } else {
      console.log('❌ No transcript returned');
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    
    if (error.message.includes('YouTube blocked request')) {
      console.log('💡 This suggests the proxy is not working properly');
    } else if (error.message.includes('GenericProxyConfig')) {
      console.log('💡 Proxy configuration syntax issue');
    } else {
      console.log('💡 Check proxy credentials and connectivity');
    }
  }
}

// Run the test
testProxyIntegration().catch(console.error);
