/**
 * Test OpenAI with GPT-4 (known working model)
 */

require('dotenv').config();
const { OpenAI } = require('openai');

async function testWithGPT4() {
  console.log('🧪 TESTING WITH GPT-4 MODEL');
  console.log('='.repeat(40));

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Test with GPT-4 Turbo (known to work)
    console.log('\n🤖 Testing GPT-4 Turbo...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: "You're an advanced content summarizer. Create a JSON summary of the given content."
        },
        {
          role: "user",
          content: `Please summarize this content:
          
          Welcome to this video about modern web development. 
          Today we'll explore React, Vue, and Angular frameworks.
          We'll discuss performance, developer experience, and ecosystem.
          React remains popular for its component-based architecture.
          Vue offers simplicity and ease of learning.
          Angular provides enterprise-grade features.
          Choose based on your project needs and team expertise.
          
          Return JSON format: {"title": "...", "summary": [...], "verdict": "..."}`
        }
      ],
      max_tokens: 500,
      temperature: 0.3
    });
    
    console.log('✅ GPT-4 Turbo response:');
    console.log(completion.choices[0].message.content);
    
    // Test with GPT-5 (if available)
    console.log('\n🚀 Testing GPT-5...');
    try {
      const gpt5Completion = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system", 
            content: "You're an advanced content summarizer. Create a JSON summary."
          },
          {
            role: "user",
            content: "Summarize: This is a test of GPT-5 model availability."
          }
        ],
        max_completion_tokens: 100
      });
      
      console.log('✅ GPT-5 response:');
      console.log(gpt5Completion.choices[0].message.content);
      
    } catch (gpt5Error) {
      console.log('❌ GPT-5 not available:', gpt5Error.message);
      console.log('💡 Recommendation: Use GPT-4 Turbo instead');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  process.exit(0);
}

testWithGPT4();