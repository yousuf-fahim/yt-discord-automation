/**
 * Test with a truly massive transcript to demonstrate optimization
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');

// Import service classes
const SummaryService = require('./src/services/summary.service');
const CacheService = require('./src/services/cache.service');

async function testMassiveTranscript() {
  console.log('🧪 Testing MASSIVE Transcript (exceeds GPT-5 context)...\n');
  
  try {
    // Register required services
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('summary', SummaryService, ['cache']);
    
    // Initialize services
    await serviceManager.initializeAll();
    
    const summaryService = serviceManager.getService('summary');
    
    console.log('📋 Configuration:');
    console.log(`  Model: ${summaryService.config.model}`);
    console.log(`  Max Output Tokens: ${summaryService.config.maxTokens}`);
    console.log(`  Max Input Tokens: 110,000 (GPT-5 limit)\n`);
    
    // Create a MASSIVE transcript (150K tokens - exceeds even GPT-5's limit!)
    const massiveTranscript = generateMassiveTranscript(150000);
    const originalLength = massiveTranscript.length;
    const estimatedTokens = Math.ceil(originalLength / 4);
    
    console.log('📹 Original Transcript:');
    console.log(`  - Characters: ${originalLength.toLocaleString()}`);
    console.log(`  - Estimated tokens: ${estimatedTokens.toLocaleString()}`);
    console.log(`  - Status: ❌ EXCEEDS GPT-5 context window (110K tokens)\n`);
    
    // Test optimization
    console.log('🔄 Applying smart optimization...\n');
    const optimized = summaryService.optimizeTranscriptContext(massiveTranscript, {
      extractionStrategy: 'smart'
    });
    
    const optimizedLength = optimized.length;
    const optimizedTokens = Math.ceil(optimizedLength / 4);
    
    console.log('\n✅ Optimized Transcript:');
    console.log(`  - Characters: ${optimizedLength.toLocaleString()}`);
    console.log(`  - Estimated tokens: ${optimizedTokens.toLocaleString()}`);
    console.log(`  - Reduction: ${((1 - optimizedLength/originalLength) * 100).toFixed(1)}%`);
    console.log(`  - Status: ${optimizedTokens <= 110000 ? '✅' : '❌'} ${optimizedTokens <= 110000 ? 'Fits' : 'Still exceeds'} in GPT-5 context window\n`);
    
    // Show the structure
    console.log('📝 Optimized Transcript Structure:');
    const lines = optimized.split('\n');
    const previewLines = 3;
    
    console.log('\n  Beginning (first 3 lines):');
    lines.slice(0, previewLines).forEach((line, i) => {
      console.log(`    ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`);
    });
    
    console.log('\n  [...middle content marker...]');
    
    const middleMarker = lines.findIndex(line => line.includes('[... middle content ...]'));
    if (middleMarker > 0) {
      console.log(`\n  Middle section (around line ${middleMarker}):`);
      lines.slice(middleMarker - 1, middleMarker + 2).forEach(line => {
        console.log(`    ${line}`);
      });
    }
    
    console.log('\n  [...later content marker...]');
    
    console.log('\n  End (last 3 lines):');
    lines.slice(-previewLines).forEach(line => {
      console.log(`    ${line.substring(0, 80)}${line.length > 80 ? '...' : ''}`);
    });
    
    console.log('\n\n' + '='.repeat(60));
    console.log('💡 Key Points:');
    console.log('='.repeat(60));
    console.log('1. GPT-5 has 128K total context (110K usable for input)');
    console.log('2. For transcripts under 110K tokens: Full transcript used');
    console.log('3. For larger transcripts: Smart extraction (beginning + middle + end)');
    console.log('4. This preserves intro, key content, and conclusions');
    console.log('5. Alternative strategies: key_sections, truncate, or default\n');
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

/**
 * Generate a massive transcript of the specified token count
 */
function generateMassiveTranscript(targetTokens) {
  const wordsNeeded = targetTokens * 0.75;
  const linesNeeded = Math.ceil(wordsNeeded / 10);
  
  const sentences = [
    'Welcome to this comprehensive tutorial on artificial intelligence and machine learning.',
    'Today we are going to explore the fundamentals of neural networks and deep learning.',
    'The transformer architecture has revolutionized natural language processing in recent years.',
    'Large language models like GPT have shown remarkable capabilities across various tasks.',
    'Understanding the underlying mechanisms is crucial for effective application of these technologies.',
    'Let us dive deep into the mathematics and theory behind these powerful models.',
    'Training data quality and quantity play essential roles in model performance and accuracy.',
    'Fine-tuning and prompt engineering are important techniques for optimizing AI results.',
    'Ethical considerations and responsible AI development are paramount in this rapidly evolving field.',
    'The future of AI holds both tremendous promise and significant challenges that we must address.',
    'Attention mechanisms allow models to focus on relevant parts of the input sequence dynamically.',
    'Backpropagation and gradient descent are fundamental algorithms for training neural networks.',
    'Transfer learning enables us to leverage pre-trained models for new specific tasks efficiently.',
    'Embeddings represent words and concepts as dense vectors in high-dimensional semantic spaces.',
    'Regularization techniques help prevent overfitting and improve model generalization on unseen data.'
  ];
  
  let transcript = '';
  for (let i = 0; i < linesNeeded; i++) {
    transcript += sentences[i % sentences.length] + '\n';
  }
  
  return transcript;
}

// Run the test
testMassiveTranscript();
