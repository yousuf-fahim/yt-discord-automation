require('dotenv').config();
const { getTranscript } = require('./api/transcript');

async function testTranscriptExtraction() {
    // Test video IDs (mix of different types)
    const testVideos = [
        'dQw4w9WgXcQ',  // Regular video with transcripts
        'jNQXAC9IVRw',  // Very old video
        'Ojk1zGhHb-g'   // Recent video
    ];

    for (const videoId of testVideos) {
        console.log(`\n=== Testing video ${videoId} ===`);
        try {
            const transcript = await getTranscript(videoId);
            if (transcript) {
                console.log(`✅ Success! Transcript length: ${transcript.length} chars`);
                console.log('First 200 chars:', transcript.substring(0, 200));
            } else {
                console.log('❌ No transcript returned');
            }
        } catch (error) {
            console.error('❌ Error:', error);
        }
    }
}

// Run the test
console.log('Starting transcript extraction test...');
testTranscriptExtraction().then(() => {
    console.log('\nTest completed');
    process.exit(0);
}).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
