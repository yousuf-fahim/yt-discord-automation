/**
 * Test VPS Transcript API
 */

const http = require('http');

const API_BASE = 'http://localhost:3000';

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}

async function testAPI() {
  console.log('🧪 Testing VPS Transcript API...\n');

  try {
    // Test health endpoint
    console.log('1️⃣ Testing health endpoint...');
    const health = await makeRequest(`${API_BASE}/health`);
    console.log('Health:', health);

    // Test transcript extraction
    console.log('\n2️⃣ Testing transcript extraction...');
    const videoId = 'jNQXAC9IVRw'; // "Me at the zoo"
    console.log(`Requesting transcript for: ${videoId}`);
    
    const transcript = await makeRequest(`${API_BASE}/transcript/${videoId}`);
    
    if (transcript.success) {
      console.log(`✅ Success! Transcript length: ${transcript.length} characters`);
      console.log(`📝 Preview: "${transcript.transcript.substring(0, 100)}..."`);
    } else {
      console.log(`❌ Failed: ${transcript.error}`);
    }

    // Test with language parameter
    console.log('\n3️⃣ Testing with language parameter...');
    const transcriptWithLang = await makeRequest(`${API_BASE}/transcript/${videoId}?lang=en`);
    
    if (transcriptWithLang.success) {
      console.log(`✅ Language-specific request successful`);
    } else {
      console.log(`❌ Language-specific request failed: ${transcriptWithLang.error}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running: npm start');
  }
}

testAPI();
