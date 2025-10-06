/**
 * Test script to verify GPT-5 summary generation works correctly
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');

// Import service classes
const SummaryService = require('./src/services/summary.service');
const CacheService = require('./src/services/cache.service');

async function testSummaryGeneration() {
  console.log('🧪 Testing Summary Service with GPT-5...\n');
  
  try {
    // Register required services
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('summary', SummaryService, ['cache']);
    
    // Initialize services
    await serviceManager.initializeAll();
    
    const summaryService = await serviceManager.getService('summary');
    
    // Check configuration
    console.log('📋 Current Configuration:');
    console.log(`  Model: ${summaryService.config.model}`);
    console.log(`  Max Tokens: ${summaryService.config.maxTokens}`);
    console.log(`  API Key Present: ${!!summaryService.config.apiKey}`);
    console.log();
    
    // Test getModelParameters for GPT-5
    console.log('🔧 Testing getModelParameters for GPT-5:');
    const params = summaryService.getModelParameters(0.3);
    console.log('  Parameters:', JSON.stringify(params, null, 2));
    console.log();
    
    // Test with a simple transcript
    const testTranscript = `
    Welcome to today's tutorial on artificial intelligence. 
    In this video, we'll explore how large language models work.
    First, we'll discuss the transformer architecture that powers these models.
    Then, we'll look at how training data shapes model behavior.
    Finally, we'll examine real-world applications and limitations.
    The key takeaway is understanding the balance between capability and responsibility.
    `;
    
    const testTitle = "Understanding AI and Large Language Models";
    const testUrl = "https://youtube.com/watch?v=test123";
    
    console.log('🎬 Generating test summary...');
    console.log(`  Title: ${testTitle}`);
    console.log(`  Transcript length: ${testTranscript.length} characters`);
    console.log();
    
    const result = await summaryService.generateSummary(
      testTranscript,
      testTitle,
      testUrl,
      null // No custom prompt, use default
    );
    
    console.log('✅ Summary generated successfully!\n');
    console.log('📊 Result:');
    console.log(`  Summary length: ${result.summary.length} characters`);
    console.log(`  Quality score: ${result.qualityScore}/100`);
    console.log(`  Video title: ${result.videoTitle}`);
    console.log();
    console.log('📝 Summary content:');
    console.log('─'.repeat(60));
    console.log(result.summary);
    console.log('─'.repeat(60));
    console.log();
    
    console.log('✅ Test completed successfully!');
    console.log(`   GPT-5 is working correctly for summary generation.`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    
    if (error.response) {
      console.error('\nAPI Response:', error.response.data);
    }
    
    process.exit(1);
  }
}

// Run the test
testSummaryGeneration();
