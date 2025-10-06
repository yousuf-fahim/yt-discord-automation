/**
 * Debug OpenAI Configuration
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');

async function debugOpenAI() {
  console.log('🔍 DEBUG OPENAI CONFIGURATION');
  console.log('='.repeat(40));

  // Check environment variables
  console.log('\n📋 Environment Variables:');
  console.log(`OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 7)}...` : 'NOT SET'}`);
  console.log(`OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'NOT SET (will use default)'}`);
  console.log(`OPENAI_MAX_TOKENS: ${process.env.OPENAI_MAX_TOKENS || 'NOT SET (will use default)'}`);

  // Check service manager config
  console.log('\n⚙️ Service Manager Config:');
  const config = serviceManager.loadConfig();
  console.log(`Config API Key: ${config.openai.apiKey ? `${config.openai.apiKey.substring(0, 7)}...` : 'NOT SET'}`);
  console.log(`Config Model: ${config.openai.model}`);
  console.log(`Config Max Tokens: ${config.openai.maxTokens}`);

  // Test direct OpenAI initialization
  console.log('\n🤖 Testing Direct OpenAI Initialization:');
  try {
    const { OpenAI } = require('openai');
    const directOpenAI = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    console.log('✅ Direct OpenAI client created');
    
    // Test API call
    const models = await directOpenAI.models.list();
    console.log(`✅ API call successful - found ${models.data.length} models`);
    
    // Test simple completion
    const completion = await directOpenAI.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "user", content: "Say 'OpenAI test successful'" }
      ],
      max_tokens: 10
    });
    
    console.log(`✅ Test completion: ${completion.choices[0].message.content}`);
    
  } catch (error) {
    console.error('❌ Direct OpenAI test failed:', error.message);
  }

  process.exit(0);
}

debugOpenAI();