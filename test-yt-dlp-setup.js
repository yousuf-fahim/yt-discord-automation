#!/usr/bin/env node

/**
 * Test script to verify yt-dlp installation in production environment
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function testYtDlpSetup() {
  console.log('🔍 Testing yt-dlp installation...');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Platform:', process.platform);
  console.log('Working directory:', process.cwd());
  
  const possiblePaths = [
    'yt-dlp',
    '/app/.heroku/python/bin/yt-dlp',
    '~/.local/bin/yt-dlp',
    'python3 -m yt_dlp'
  ];
  
  console.log('\n📋 Testing possible yt-dlp commands:');
  
  for (const ytdlpPath of possiblePaths) {
    try {
      console.log(`\n⏳ Testing: ${ytdlpPath}`);
      const { stdout, stderr } = await execAsync(`${ytdlpPath} --version`);
      console.log(`✅ SUCCESS! Version: ${stdout.trim()}`);
      if (stderr) console.log(`   stderr: ${stderr.trim()}`);
      
      // Test with a simple video
      console.log(`   🎬 Testing video download capability...`);
      const testCmd = `${ytdlpPath} --no-download --get-title --ignore-config --no-playlist https://www.youtube.com/watch?v=dQw4w9WgXcQ`;
      const { stdout: titleOutput } = await execAsync(testCmd);
      console.log(`   🏆 Video title: ${titleOutput.trim()}`);
      
      return ytdlpPath;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message.split('\n')[0]}`);
    }
  }
  
  console.log('\n❌ No working yt-dlp installation found');
  
  // Additional diagnostics
  console.log('\n🔧 Additional diagnostics:');
  try {
    const { stdout } = await execAsync('which python3');
    console.log(`Python3 path: ${stdout.trim()}`);
  } catch (e) {
    console.log('Python3 not found');
  }
  
  try {
    const { stdout } = await execAsync('pip3 list | grep yt-dlp');
    console.log(`pip3 yt-dlp: ${stdout.trim()}`);
  } catch (e) {
    console.log('yt-dlp not found in pip3 list');
  }
  
  try {
    const { stdout } = await execAsync('find /app -name "*yt-dlp*" -type f 2>/dev/null');
    console.log(`yt-dlp files found: ${stdout.trim()}`);
  } catch (e) {
    console.log('No yt-dlp files found in /app');
  }
  
  return null;
}

// Run the test
testYtDlpSetup()
  .then(workingCmd => {
    if (workingCmd) {
      console.log(`\n🎉 RESULT: Use "${workingCmd}" for yt-dlp commands`);
      process.exit(0);
    } else {
      console.log('\n💀 RESULT: No working yt-dlp installation found');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('\n💥 Test script error:', err);
    process.exit(1);
  });
