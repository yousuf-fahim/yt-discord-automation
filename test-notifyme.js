require('dotenv').config();
const { isYouTubeLink, extractVideoId } = require('./utils/youtube');
const { getTranscript } = require('./api/transcript');

// Test NotifyMe-style YouTube links
async function testNotifyMe() {
  console.log('Testing NotifyMe YouTube link detection and transcript extraction');
  
  // Test cases
  const testCases = [
    { 
      name: 'Standard YouTube URL', 
      url: 'https://www.youtube.com/watch?v=q3Astu36nx8',
      expectedId: 'q3Astu36nx8'
    },
    { 
      name: 'Short URL', 
      url: 'https://youtu.be/q3Astu36nx8',
      expectedId: 'q3Astu36nx8'
    },
    { 
      name: 'Just the ID', 
      url: 'q3Astu36nx8',
      expectedId: 'q3Astu36nx8'
    },
    { 
      name: 'NotifyMe format', 
      url: 'youtu.be/q3Astu36nx8',
      expectedId: 'q3Astu36nx8'
    }
  ];
  
  // Test link detection and ID extraction
  for (const test of testCases) {
    const isYoutube = isYouTubeLink(test.url);
    const videoId = extractVideoId(test.url);
    
    console.log(`\nTest: ${test.name}`);
    console.log(`URL: ${test.url}`);
    console.log(`Is YouTube link: ${isYoutube}`);
    console.log(`Extracted ID: ${videoId}`);
    console.log(`Expected ID: ${test.expectedId}`);
    console.log(`Result: ${videoId === test.expectedId ? '✅ PASS' : '❌ FAIL'}`);
  }
  
  // Test transcript extraction
  console.log('\n\nTesting transcript extraction for video ID: q3Astu36nx8');
  try {
    const transcript = await getTranscript('q3Astu36nx8');
    
    if (transcript) {
      console.log('\n✅ Successfully extracted transcript');
      console.log(`Transcript length: ${transcript.length} characters`);
      console.log('\nFirst 200 characters:');
      console.log(transcript.substring(0, 200) + '...');
      
      // Check if it's the default Tactiq message
      const isTactiqDefault = transcript.includes('Focus on the Meeting, let AI handle the notes');
      if (isTactiqDefault) {
        console.log('\n❌ WARNING: This appears to be the default Tactiq message, not a real transcript');
      } else {
        console.log('\n✅ This appears to be a real transcript (not the default Tactiq message)');
      }
    } else {
      console.log('\n❌ Failed to extract transcript');
    }
  } catch (error) {
    console.error('\n❌ Error extracting transcript:', error);
  }
}

// Run the tests
testNotifyMe();

