#!/usr/bin/env node

/**
 * Heroku Deployment Readiness Test
 * Tests all critical components for Heroku deployment
 */

require('dotenv').config();

// Simulate Heroku environment
process.env.DYNO = 'web.1';
process.env.NODE_ENV = 'production';

async function testHerokuReadiness() {
  console.log('🧪 Testing Heroku Deployment Readiness');
  console.log('=====================================\n');

  const tests = [];
  
  // Test 1: Environment Variables
  console.log('1. Testing Environment Variables...');
  const requiredEnvVars = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_GUILD_ID', 
    'OPENAI_API_KEY'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.log(`❌ Missing environment variables: ${missingVars.join(', ')}`);
    tests.push(false);
  } else {
    console.log('✅ All required environment variables present');
    tests.push(true);
  }

  // Test 2: Node.js Version
  console.log('\n2. Testing Node.js Version...');
  const nodeVersion = process.version;
  const minVersion = 'v18.0.0';
  if (nodeVersion >= minVersion) {
    console.log(`✅ Node.js version ${nodeVersion} is compatible`);
    tests.push(true);
  } else {
    console.log(`❌ Node.js version ${nodeVersion} is too old (minimum: ${minVersion})`);
    tests.push(false);
  }

  // Test 3: Python and yt-dlp
  console.log('\n3. Testing Python and yt-dlp...');
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    // Test Python
    const { stdout: pythonVersion } = await execAsync('python3 --version');
    console.log(`✅ Python available: ${pythonVersion.trim()}`);
    
    // Test yt-dlp module
    try {
      await execAsync('python3 -m yt_dlp --version', { timeout: 10000 });
      console.log('✅ yt-dlp module accessible');
      tests.push(true);
    } catch (err) {
      console.log('❌ yt-dlp module not accessible:', err.message);
      tests.push(false);
    }
  } catch (err) {
    console.log('❌ Python not available:', err.message);
    tests.push(false);
  }

  // Test 4: Transcript Module
  console.log('\n4. Testing Transcript Module...');
  try {
    // Test module import
    const { getTranscript } = require('./api/transcript');
    console.log('✅ Transcript module imports successfully');
    
    // Test with Heroku environment simulation
    console.log('📡 Testing transcript extraction with Heroku simulation...');
    
    // Use a simple, reliable video for testing
    const testVideoId = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video
    const result = await getTranscript(testVideoId);
    
    if (result && result.length > 0) {
      console.log(`✅ Transcript extraction successful (${result.length} characters)`);
      tests.push(true);
    } else {
      console.log('❌ Transcript extraction failed');
      tests.push(false);
    }
  } catch (err) {
    console.log('❌ Transcript module error:', err.message);
    tests.push(false);
  }

  // Test 5: Discord Module
  console.log('\n5. Testing Discord Module...');
  try {
    const { Client } = require('discord.js');
    const client = new Client({ intents: ['Guilds'] });
    console.log('✅ Discord.js module loads successfully');
    client.destroy();
    tests.push(true);
  } catch (err) {
    console.log('❌ Discord module error:', err.message);
    tests.push(false);
  }

  // Test 6: OpenAI Module
  console.log('\n6. Testing OpenAI Module...');
  try {
    const { generateSummary } = require('./utils/openai');
    console.log('✅ OpenAI module loads successfully');
    tests.push(true);
  } catch (err) {
    console.log('❌ OpenAI module error:', err.message);
    tests.push(false);
  }

  // Test 7: File System Permissions
  console.log('\n7. Testing File System Permissions...');
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const testDir = process.env.DYNO ? '/tmp/test-permissions' : './temp/test-permissions';
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, 'test.txt'), 'test');
    await fs.unlink(path.join(testDir, 'test.txt'));
    await fs.rmdir(testDir);
    
    console.log('✅ File system permissions working');
    tests.push(true);
  } catch (err) {
    console.log('❌ File system permission error:', err.message);
    tests.push(false);
  }

  // Results
  console.log('\n📊 Test Results');
  console.log('===============');
  const passed = tests.filter(t => t).length;
  const total = tests.length;
  
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Success Rate: ${Math.round((passed/total) * 100)}%`);
  
  if (passed === total) {
    console.log('\n🎉 ALL TESTS PASSED - Ready for Heroku deployment!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed - Fix issues before deploying to Heroku');
    process.exit(1);
  }
}

// Run tests
testHerokuReadiness().catch(err => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});
