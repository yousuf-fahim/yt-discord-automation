/**
 * Test VPS Integration
 * Tests the multi-source transcript service with VPS client
 */

const TranscriptService = require('./src/services/transcript.service');

// Mock dependencies
const mockServiceManager = {
  logger: {
    info: (msg, data) => console.log(`ℹ️  ${msg}`, data || ''),
    warn: (msg, data) => console.log(`⚠️  ${msg}`, data || ''),
    error: (msg, error) => console.log(`❌ ${msg}`, error?.message || error || '')
  }
};

const mockDependencies = {
  cache: {
    // Mock cache service
  }
};

async function testVPSIntegration() {
  console.log('🧪 Testing VPS Integration...\n');

  try {
    // Test without VPS URL (local only)
    console.log('1️⃣ Testing local-only mode...');
    delete process.env.VPS_TRANSCRIPT_API_URL;
    
    const localService = new TranscriptService(mockServiceManager, mockDependencies);
    
    const localHealth = await localService.healthCheck();
    console.log('Local health:', localHealth);

    // Test with VPS URL
    console.log('\n2️⃣ Testing VPS mode...');
    process.env.VPS_TRANSCRIPT_API_URL = 'http://your-droplet-ip:3000'; // Replace with actual IP
    
    const vpsService = new TranscriptService(mockServiceManager, mockDependencies);
    
    const vpsHealth = await vpsService.healthCheck();
    console.log('VPS health:', vpsHealth);

    // Test transcript extraction
    console.log('\n3️⃣ Testing transcript extraction...');
    const testVideoId = 'jNQXAC9IVRw'; // "Me at the zoo"
    
    const transcript = await vpsService.getTranscript(testVideoId);
    
    if (transcript) {
      console.log(`✅ Success! Transcript length: ${transcript.length} characters`);
      console.log(`📝 Preview: "${transcript.substring(0, 100)}..."`);
    } else {
      console.log('❌ No transcript returned');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('VPS_TRANSCRIPT_API_URL')) {
      console.log('\n💡 This is expected when VPS is not yet deployed');
    }
  }
}

testVPSIntegration().catch(console.error);
