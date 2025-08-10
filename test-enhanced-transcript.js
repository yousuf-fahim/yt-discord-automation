require('dotenv').config();
const { getTranscript } = require('./api/transcript');

// Test configuration
const TEST_MODE = process.env.NODE_ENV !== 'production';
const TEST_VIDEOS = [
    {
        id: 'dQw4w9WgXcQ',
        description: 'Regular video with transcripts'
    },
    {
        id: 'jNQXAC9IVRw',
        description: 'Very old video'
    },
    {
        id: 'Ojk1zGhHb-g',
        description: 'Recent video'
    },
    {
        id: 'x0tgdtpjnpc',
        description: 'Fresh test video'
    },
    {
        id: '9bZkp7q19f0',
        description: 'New test video (PSY - GANGNAM STYLE)'
    }
];

async function validateTranscript(transcript) {
    if (!transcript) return false;
    if (transcript.length < 100) return false;
    if (transcript.includes('Error') || transcript.includes('unavailable')) return false;
    return true;
}

async function runTest() {
    console.log('🧪 Starting Enhanced Transcript Extraction Test');
    console.log('============================================\n');
    
    const results = {
        total: 0,
        successful: 0,
        failed: 0,
        timings: []
    };

    for (const video of TEST_VIDEOS) {
        console.log(`Testing Video: ${video.description}`);
        console.log(`ID: ${video.id}`);
        
        try {
            results.total++;
            const startTime = Date.now();
            
            const transcript = await getTranscript(video.id);
            const endTime = Date.now();
            
            const duration = endTime - startTime;
            results.timings.push(duration);
            
            if (await validateTranscript(transcript)) {
                results.successful++;
                console.log('✅ Success!');
                console.log(`⏱️  Time taken: ${duration}ms`);
                console.log(`📝 Length: ${transcript.length} characters`);
                console.log('Preview:', transcript.substring(0, 100), '...\n');
            } else {
                results.failed++;
                console.log('❌ Failed: Invalid or empty transcript\n');
            }
        } catch (error) {
            results.failed++;
            console.log('❌ Error:', error.message, '\n');
        }
    }

    // Print test summary
    console.log('Test Summary');
    console.log('============');
    console.log(`Total tests: ${results.total}`);
    console.log(`Successful: ${results.successful}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Success rate: ${((results.successful / results.total) * 100).toFixed(1)}%`);
    console.log(`Average time: ${(results.timings.reduce((a, b) => a + b, 0) / results.timings.length).toFixed(0)}ms\n`);

    // Print simple stats summary
    console.log('\nStats Summary');
    console.log('=============');
    console.log(`Performance: ${results.successful}/${results.total} transcripts extracted successfully`);
}

// Run the test
console.log(`Mode: ${TEST_MODE ? 'Testing' : 'Production'}\n`);
runTest()
    .then(() => {
        console.log('\n✨ Test completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n💥 Test failed:', error);
        process.exit(1);
    });
