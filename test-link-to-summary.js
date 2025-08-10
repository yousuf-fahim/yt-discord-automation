const fs = require('fs').promises;
const { getTranscript } = require('./api/transcript');
const { generateSummary } = require('./utils/openai');
const { extractVideoId } = require('./utils/youtube');

async function testLinkToSummary(url) {
    try {
        console.log('Testing link-to-summary pipeline...');
        console.log('URL:', url);
        
        // Get video ID
        const videoId = extractVideoId(url);
        console.log('Video ID:', videoId);
        
        // Get transcript
        console.log('Getting transcript...');
        const transcript = await getTranscript(videoId);
        
        if (!transcript) {
            throw new Error('Failed to get transcript');
        }
        
        console.log(`Got transcript (${transcript.length} chars)`);
        
        // Generate summary
        console.log('Generating summary...');
        const startTime = Date.now();
        const summary = await generateSummary(transcript, 'Please summarize this video transcript.');
        const endTime = Date.now();
        
        if (!summary) {
            throw new Error('Failed to generate summary');
        }
        
        // Get video title from the transcript
        const titleMatch = transcript.match(/Video Title: (.*?)\n/);
        const videoTitle = titleMatch ? titleMatch[1] : videoId;

        // Write results
        const results = `Link-to-Summary Test Results
----------------------------
Video Title: ${videoTitle}
Transcript Length: ${transcript.length} characters
Summary Length: ${summary.length} characters

Time Breakdown:
Total Time: ${((endTime - startTime) / 1000).toFixed(2)} seconds

Summary:
${summary}
`;
        
        await fs.writeFile('test-link-to-summary-results.txt', results);
        console.log('Results written to test-link-to-summary-results.txt');
        
    } catch (error) {
        console.error('Error in test:', error);
        process.exit(1);
    }
}

// Get URL from command line
const url = process.argv[2];
if (!url) {
    console.error('Please provide a YouTube URL as an argument');
    process.exit(1);
}

testLinkToSummary(url);
