/**
 * Test script to verify context window handling for large transcripts
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');

// Import service classes
const SummaryService = require('./src/services/summary.service');
const CacheService = require('./src/services/cache.service');

async function testLargeTranscript() {
  console.log('🧪 Testing Large Transcript Context Window Handling...\n');
  
  try {
    // Register required services
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('summary', SummaryService, ['cache']);
    
    // Initialize services
    await serviceManager.initializeAll();
    
    const summaryService = serviceManager.getService('summary');
    
    // Check configuration
    console.log('📋 Current Configuration:');
    console.log(`  Model: ${summaryService.config.model}`);
    console.log(`  Max Tokens: ${summaryService.config.maxTokens}`);
    console.log();
    
    // Create test transcripts of different sizes
    const testCases = [
      {
        name: 'Small (500 tokens)',
        transcript: generateTranscript(500),
        title: 'Small Video Test'
      },
      {
        name: 'Medium (5,000 tokens)',
        transcript: generateTranscript(5000),
        title: 'Medium Video Test'
      },
      {
        name: 'Large (20,000 tokens)',
        transcript: generateTranscript(20000),
        title: 'Large Video Test'
      },
      {
        name: 'Extra Large (50,000 tokens)',
        transcript: generateTranscript(50000),
        title: 'Extra Large Video Test'
      }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📹 Testing: ${testCase.name}`);
      console.log(`${'='.repeat(60)}\n`);
      
      const originalLength = testCase.transcript.length;
      const estimatedTokens = Math.ceil(originalLength / 4);
      
      console.log(`Original transcript:`);
      console.log(`  - Characters: ${originalLength.toLocaleString()}`);
      console.log(`  - Estimated tokens: ${estimatedTokens.toLocaleString()}`);
      
      // Test optimization
      const optimized = summaryService.optimizeTranscriptContext(testCase.transcript);
      const optimizedLength = optimized.length;
      const optimizedTokens = Math.ceil(optimizedLength / 4);
      
      console.log(`\nOptimized transcript:`);
      console.log(`  - Characters: ${optimizedLength.toLocaleString()}`);
      console.log(`  - Estimated tokens: ${optimizedTokens.toLocaleString()}`);
      console.log(`  - Reduction: ${((1 - optimizedLength/originalLength) * 100).toFixed(1)}%`);
      
      // Check against input context window (110K for GPT-5)
      const maxInputTokens = 110000; // GPT-5 input limit
      const fitsInWindow = optimizedTokens <= maxInputTokens;
      console.log(`\n${fitsInWindow ? '✅' : '⚠️'} Fits in context window: ${fitsInWindow} (max: ${maxInputTokens.toLocaleString()} tokens)`);
      
      if (testCase.name === 'Small (500 tokens)') {
        console.log('\n🎬 Generating actual summary for small transcript...');
        
        try {
          const result = await summaryService.generateSummary(
            testCase.transcript,
            testCase.title,
            'https://youtube.com/watch?v=test',
            null
          );
          
          console.log('✅ Summary generated successfully!');
          console.log(`  - Summary length: ${result.summary.length} characters`);
          console.log(`  - Quality score: ${result.qualityScore}/100`);
        } catch (error) {
          console.error('❌ Summary generation failed:', error.message);
        }
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 Summary');
    console.log(`${'='.repeat(60)}\n`);
    console.log(`Model: ${summaryService.config.model}`);
    console.log(`Max output tokens: ${summaryService.config.maxTokens}`);
    console.log(`\nContext Window Limits by Model:`);
    console.log(`  - GPT-5: ~120K tokens input`);
    console.log(`  - GPT-4 Turbo/4o: ~120K tokens input`);
    console.log(`  - GPT-4: ~6K tokens input`);
    console.log(`  - o1/o3: ~100K tokens input`);
    console.log(`\n✅ All tests completed!`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

/**
 * Generate a transcript of approximately the specified token count
 */
function generateTranscript(targetTokens) {
  // ~4 characters per token, ~10 words per line
  const wordsNeeded = targetTokens * 0.75; // Conservative estimate
  const linesNeeded = Math.ceil(wordsNeeded / 10);
  
  const sentences = [
    'Welcome to this comprehensive tutorial on artificial intelligence and machine learning.',
    'Today we are going to explore the fundamentals of neural networks and deep learning.',
    'The transformer architecture has revolutionized natural language processing in recent years.',
    'Large language models like GPT have shown remarkable capabilities across various tasks.',
    'Understanding the underlying mechanisms is crucial for effective application of these technologies.',
    'Let us dive deep into the mathematics and theory behind these powerful models.',
    'Training data quality and quantity play essential roles in model performance.',
    'Fine-tuning and prompt engineering are important techniques for optimizing results.',
    'Ethical considerations and responsible AI development are paramount in this field.',
    'The future of AI holds both tremendous promise and significant challenges to address.'
  ];
  
  let transcript = '';
  for (let i = 0; i < linesNeeded; i++) {
    transcript += sentences[i % sentences.length] + '\n';
  }
  
  return transcript;
}

// Run the test
testLargeTranscript();
