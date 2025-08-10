require('dotenv').config();
const { getTranscript } = require('./api/transcript');
const { saveTranscript, getTranscriptFromCache } = require('./utils/cache');
const fs = require('fs').promises;
const path = require('path');

// This is a mock function to simulate transcript extraction
// In a real scenario, we would use the actual getTranscript function
async function mockGetTranscript(videoId) {
  console.log(`Simulating transcript extraction for video ID: ${videoId}`);
  
  // Create a mock transcript
  const mockTranscript = `This is a mock transcript for video ${videoId}.
It contains multiple lines of text.
This would normally be the actual transcript from YouTube.`;
  
  // Ensure cache directory exists
  await fs.mkdir(path.join(process.cwd(), 'cache'), { recursive: true });
  
  // Save the mock transcript to cache
  const filePath = path.join(process.cwd(), 'cache', `${videoId}.txt`);
  await fs.writeFile(filePath, mockTranscript, 'utf8');
  
  console.log(`Mock transcript saved to ${filePath}`);
  
  return mockTranscript;
}

async function testTranscriptExtraction() {
  // Get video ID from command line argument or use default
  const urlOrId = process.argv[2] || '0jk1zGhHb-g';
  const videoId = urlOrId.includes('watch?v=') ? urlOrId.split('watch?v=')[1].split('&')[0] : urlOrId;
  
  try {
    console.log('Testing transcript extraction with real function:');
    console.log('------------------------------');
    console.log(`Video ID: ${videoId}`);
    console.log(`Video URL: https://www.youtube.com/watch?v=${videoId}`);
    
    // Use the actual getTranscript function
    console.time('Transcript extraction');
    const transcript = await getTranscript(videoId);
    console.timeEnd('Transcript extraction');
    
    if (transcript) {
      console.log('✅ Transcript extracted successfully!');
      console.log('------------------------------');
      console.log(`Transcript length: ${transcript.length} characters`);
      console.log('First 300 characters of transcript:');
      console.log(transcript.substring(0, 300) + '...');
      console.log('------------------------------');
      
      // Save full transcript to a file for inspection
      const outputPath = path.join(process.cwd(), 'test-transcript-output.txt');
      await fs.writeFile(outputPath, transcript, 'utf8');
      console.log(`Full transcript saved to: ${outputPath}`);
    } else {
      console.error('❌ Failed to extract transcript');
    }
  } catch (error) {
    console.error('❌ Error testing transcript extraction:', error);
  }
}

// Run the test
testTranscriptExtraction();
