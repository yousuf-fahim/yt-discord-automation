#!/usr/bin/env node
/**
 * Model Diagnostic Script
 * Checks actual model being used vs displayed config
 */

require('dotenv').config();

async function diagnoseModelIssue() {
  try {
    console.log('🔍 Diagnosing Model Configuration Issue...\n');
    
    // Import services
    const { serviceManager } = require('./src/core/service-manager');
    const SummaryService = require('./src/services/summary.service');
    const CacheService = require('./src/services/cache.service');
    
    // Initialize services
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('summary', SummaryService, { cache: 'cache' });
    
    await serviceManager.initializeAll();
    
    const summaryService = serviceManager.getService('summary');
    const cacheService = serviceManager.getService('cache');
    
    console.log('📋 Configuration Check:');
    console.log(`  ServiceManager Config Model: ${serviceManager.config.openai.model}`);
    console.log(`  Summary Service Config Model: ${summaryService.config.model}`);
    console.log(`  Environment OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'not set'}`);
    console.log('');
    
    // Test with a simple transcript
    const testTranscript = "This is a test about machine learning and AI development.";
    const testVideoId = 'diagnostic-test-' + Date.now();
    const testVideoTitle = 'Model Diagnostic Test';
    
    console.log('🧪 Testing Summary Generation:');
    console.log(`Using model: ${summaryService.config.model}`);
    
    // Clear any existing cache for this test
    const crypto = require('crypto');
    const hashString = (text) => crypto.createHash('md5').update(text).digest('hex').substring(0, 6);
    const cacheKey = `summary_${summaryService.config.model}_${hashString(testTranscript)}`;
    
    console.log(`Cache key: ${cacheKey}`);
    
    // Check if cached version exists
    const cachedResult = await cacheService.get(cacheKey);
    if (cachedResult) {
      console.log('⚠️  Cached result found - this might be the issue!');
      console.log(`Cached preview: ${cachedResult.substring(0, 100)}...`);
    } else {
      console.log('✅ No cached result found');
    }
    
    // Generate fresh summary with watermark
    const customPrompt = `Summarize this transcript and at the end add: "Model used: ${summaryService.config.model}"`;
    
    console.log('\n🔄 Generating summary with watermark...');
    const startTime = Date.now();
    
    const summary = await summaryService.generateSummary(testTranscript, testVideoId, testVideoTitle, customPrompt);
    
    const responseTime = Date.now() - startTime;
    
    console.log(`✅ Generated in ${responseTime}ms`);
    console.log('\n📝 Summary Result:');
    console.log(summary);
    console.log('');
    
    // Check what model name appears in the summary
    const modelInSummary = summary.match(/Model used: (.+)/i);
    if (modelInSummary) {
      const actualModel = modelInSummary[1].trim();
      console.log('🔍 Analysis:');
      console.log(`  Expected Model: ${summaryService.config.model}`);
      console.log(`  Actual Model in Summary: ${actualModel}`);
      console.log(`  Match: ${summaryService.config.model === actualModel ? '✅ YES' : '❌ NO'}`);
      
      if (summaryService.config.model !== actualModel) {
        console.log('\n⚠️  ISSUE IDENTIFIED: Config shows one model but API uses another!');
        console.log('   This could be due to:');
        console.log('   1. Cached results from different model');
        console.log('   2. Model config not properly updated in service');
        console.log('   3. OpenAI API using different model than requested');
      }
    }
    
    console.log('\n🔧 Recommendation:');
    if (responseTime < 1000) {
      console.log('   - Response was very fast, likely from cache');
      console.log('   - Try clearing cache or using different test content');
    } else {
      console.log('   - Response was slow, likely fresh generation');
      console.log('   - Check if OpenAI API is using correct model');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
    console.error('Stack:', error.stack);
  }
}

diagnoseModelIssue();
