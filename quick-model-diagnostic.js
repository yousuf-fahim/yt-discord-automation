#!/usr/bin/env node
/**
 * Simple Model Issue Diagnostic
 * Directly tests the configuration vs actual model issue
 */

require('dotenv').config();
const { OpenAI } = require('openai');

async function quickModelDiagnostic() {
  try {
    console.log('🔍 Quick Model Diagnostic\n');
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Check configuration sources
    console.log('📋 Configuration Sources:');
    console.log(`  Environment OPENAI_MODEL: ${process.env.OPENAI_MODEL || 'not set'}`);
    console.log(`  Default fallback: gpt-4-turbo`);
    console.log('');
    
    // Test direct API call with GPT-5
    console.log('🧪 Testing Direct API Call with GPT-5:');
    
    try {
      const startTime = Date.now();
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Always end your response with "Model used: [your actual model name]"' },
          { role: 'user', content: 'Summarize: This is a test about AI development. At the end, mention what model you are.' }
        ],
        max_completion_tokens: 200
      });
      
      const responseTime = Date.now() - startTime;
      const content = response.choices[0].message.content;
      
      console.log(`✅ Response in ${responseTime}ms:`);
      console.log(content);
      console.log('');
      
      // Check what model is actually reported
      const modelMatch = content.match(/Model used: (.+)/i);
      if (modelMatch) {
        const reportedModel = modelMatch[1].trim();
        console.log('🔍 Analysis:');
        console.log(`  Requested: gpt-5`);
        console.log(`  Reported: ${reportedModel}`);
        console.log(`  Match: ${reportedModel.includes('gpt-5') || reportedModel.includes('GPT-5') ? '✅ YES' : '❌ NO'}`);
      }
      
    } catch (error) {
      console.log(`❌ GPT-5 failed: ${error.message}`);
    }
    
    // Now test with gpt-4o-mini to see if it's being used instead
    console.log('\n🧪 Testing GPT-4o-mini for comparison:');
    
    try {
      const startTime = Date.now();
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Always end your response with "Model used: [your actual model name]"' },
          { role: 'user', content: 'Summarize: This is a test about AI development. At the end, mention what model you are.' }
        ],
        max_tokens: 200,
        temperature: 0.1
      });
      
      const responseTime = Date.now() - startTime;
      const content = response.choices[0].message.content;
      
      console.log(`✅ Response in ${responseTime}ms:`);
      console.log(content);
      console.log('');
      
    } catch (error) {
      console.log(`❌ GPT-4o-mini failed: ${error.message}`);
    }
    
    console.log('🔧 Potential Issues:');
    console.log('1. Cache returning old gpt-4o-mini results');
    console.log('2. Discord command not properly updating service config');
    console.log('3. Service manager config not syncing with summary service');
    console.log('4. Environment variable overriding Discord command setting');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

quickModelDiagnostic();
