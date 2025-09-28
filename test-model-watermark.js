#!/usr/bin/env node
/**
 * Test Model Watermark Fix
 * Verifies that summaries now show the correct model in watermark
 */

require('dotenv').config();

async function testModelWatermark() {
  try {
    console.log('🧪 Testing Model Watermark Fix\n');
    
    const { serviceManager } = require('./src/core/service-manager');
    const SummaryService = require('./src/services/summary.service');
    
    // Initialize summary service
    const summaryService = new SummaryService(serviceManager, {});
    
    console.log('📋 Configuration:');
    console.log(`  Environment Model: ${process.env.OPENAI_MODEL}`);
    console.log(`  Service Model: ${summaryService.config.model}`);
    console.log('');
    
    // Test transcript
    const testTranscript = "Jessica Wu discusses building Sola, an AI-driven automation platform. The company has achieved 5x revenue growth and secured Series A funding from a16z. She emphasizes the importance of selling before building and maintaining strong customer relationships.";
    
    console.log('🔄 Testing Regular Summary with Model Watermark...');
    
    const startTime = Date.now();
    const summary = await summaryService.generateSummary(
      testTranscript, 
      'watermark-test-' + Date.now(), 
      'Sola AI Platform Discussion'
    );
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Generated in ${responseTime}ms`);
    console.log('\n📝 Summary Result:');
    console.log(summary);
    console.log('');
    
    // Check if watermark shows correct model
    const watermarkMatch = summary.match(/LLM used: (.+)$/i);
    if (watermarkMatch) {
      const reportedModel = watermarkMatch[1].trim();
      console.log('🔍 Watermark Analysis:');
      console.log(`  Expected: ${summaryService.config.model}`);
      console.log(`  Reported: ${reportedModel}`);
      console.log(`  ✅ Match: ${reportedModel === summaryService.config.model ? 'YES' : 'NO'}`);
    } else {
      console.log('❌ No watermark found in summary');
    }
    
    console.log('\n🎉 Watermark test complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testModelWatermark();
