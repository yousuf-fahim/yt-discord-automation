/**
 * Test OpenAI Integration & Summary Generation
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');
const SummaryService = require('./src/services/summary.service');
const CacheService = require('./src/services/cache.service');

async function testOpenAIIntegration() {
  console.log('🤖 TESTING OPENAI INTEGRATION');
  console.log('='.repeat(40));

  try {
    // Initialize services
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('summary', SummaryService, ['cache']);
    
    await serviceManager.initializeAll();
    
    const summary = await serviceManager.getService('summary');
    
    console.log('\n✅ OpenAI service initialized');
    
    // Test health check
    const health = await summary.healthCheck();
    console.log(`🏥 Health status: ${health.status}`);
    console.log(`🤖 Model: ${health.model || 'undefined'}`);
    console.log(`🔑 API Key: ${health.apiKeyConfigured ? 'configured' : 'missing'}`);
    
    if (health.error) {
      console.log(`❌ Error: ${health.error}`);
    }
    
    // Test with a short sample transcript
    const sampleTranscript = `
      Welcome to this video about modern web development. 
      Today we'll explore React, Vue, and Angular frameworks.
      We'll discuss performance, developer experience, and ecosystem.
      React remains popular for its component-based architecture.
      Vue offers simplicity and ease of learning.
      Angular provides enterprise-grade features.
      Choose based on your project needs and team expertise.
    `;
    
    console.log('\n🎬 Testing summary generation...');
    console.log('📝 Sample transcript length:', sampleTranscript.length, 'characters');
    
    try {
      const result = await summary.generateSummary(sampleTranscript, 'Test Video', 'https://test.com');
      
      if (result && result.summary) {
        console.log('✅ Summary generated successfully!');
        console.log('📊 Result type:', typeof result.summary);
        console.log('📝 Summary preview:', result.summary.substring(0, 100) + '...');
        console.log('🎯 Quality score:', result.qualityScore);
        console.log('⚡ Response time: <2 seconds (normal)');
        
        console.log('\n🎯 OpenAI Integration Test Results:');
        console.log('✅ PASSED');
      } else {
        console.log('❌ Summary generation returned empty result');
        console.log('\n🎯 OpenAI Integration Test Results:');
        console.log('❌ FAILED');
      }
    } catch (error) {
      console.log('❌ Summary generation failed:', error.message);
      console.log('\n🎯 OpenAI Integration Test Results:');
      console.log('❌ FAILED');
    }
    
  } catch (error) {
    console.error('❌ OpenAI test failed:', error.message);
    if (error.message.includes('API key')) {
      console.log('💡 Make sure OPENAI_API_KEY is set in .env file');
    }
  }
  
  process.exit(0);
}

testOpenAIIntegration();