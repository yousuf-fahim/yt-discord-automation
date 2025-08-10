const { getTranscript } = require('./api/transcript');

async function testTranscriptFormat() {
  try {
    console.log('Testing transcript format...');
    const videoId = 'fepKQej1DH0';
    
    console.log(`Getting transcript for video ID: ${videoId}`);
    const transcript = await getTranscript(videoId);
    
    if (transcript) {
      console.log('\nTranscript output (first 500 chars):');
      console.log('-'.repeat(50));
      console.log(transcript.substring(0, 500));
      console.log('-'.repeat(50));
      console.log(`\nTotal length: ${transcript.length} characters`);
    } else {
      console.log('Failed to get transcript');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testTranscriptFormat();
