require('dotenv').config();
const { splitTextIntoChunks } = require('./utils/openai');

// Mock OpenAI function to avoid actual API calls
async function mockGenerateSummary(transcript, prompt) {
  console.log('Simulating OpenAI API call for summary generation');
  console.log(`Prompt length: ${prompt.length} characters`);
  console.log(`Transcript length: ${transcript.length} characters`);
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return `{
  "title": "Mock Summary Title",
  "summary": ["This is a mock summary point 1", "This is a mock summary point 2"],
  "noteworthy_mentions": ["Mock mention 1"],
  "verdict": "This is a mock verdict"
}`;
}

// Test the text chunking functionality
function testTextChunking() {
  console.log('Testing text chunking:');
  console.log('------------------------------');
  
  // Create a long test text
  const testText = 'A'.repeat(50000);
  console.log(`Test text length: ${testText.length} characters`);
  
  // Split into chunks
  const chunks = splitTextIntoChunks(testText, 4000);
  console.log(`Split into ${chunks.length} chunks`);
  
  chunks.forEach((chunk, index) => {
    console.log(`Chunk ${index + 1}: ${chunk.length} characters`);
  });
  
  console.log('------------------------------');
}

// Test the summary generation
async function testSummaryGeneration() {
  console.log('Testing summary generation:');
  console.log('------------------------------');
  
  const mockTranscript = `This is a mock transcript.
It contains multiple lines of text.
This would normally be the actual transcript from YouTube.`;
  
  const mockPrompt = `You're an advanced content summarizer.
Your task is to analyze the transcript of a YouTube video and return a concise summary in JSON format only.
Include the video's topic, key points, and any noteworthy mentions.
Do not include anything outside of the JSON block. Be accurate, structured, and informative.

Format:
{
  "title": "Insert video title here",
  "summary": ["Point 1", "Point 2"],
  "noteworthy_mentions": ["Mention 1"],
  "verdict": "Brief takeaway"
}`;
  
  const summary = await mockGenerateSummary(mockTranscript, mockPrompt);
  
  console.log('Generated summary:');
  console.log('------------------------------');
  console.log(summary);
  console.log('------------------------------');
}

// Run the tests
async function runTests() {
  testTextChunking();
  await testSummaryGeneration();
}

runTests();
