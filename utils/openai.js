require('dotenv').config();
const { OpenAI } = require('openai');

// Initialize OpenAI client
console.log('Initializing OpenAI client...');
console.log('API Key present:', !!process.env.OPENAI_API_KEY);
console.log('API Key length:', process.env.OPENAI_API_KEY?.length);

// Validate API key format
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ ERROR: OPENAI_API_KEY is not set in environment variables');
}

let openai;
try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log('OpenAI client initialized');
} catch (error) {
  console.error('❌ ERROR initializing OpenAI client:', error.message);
  // Create a dummy client that will log errors
  openai = {
    chat: {
      completions: {
        create: async () => {
          throw new Error('OpenAI client failed to initialize. Check your API key.');
        }
      }
    }
  };
}

// Configuration
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';  // Update to the more stable gpt-4o model
const MAX_TOKENS = 16000; // Safe limit for most models

/**
 * Splits text into chunks that fit within token limits
 * @param {string} text - Text to split
 * @param {number} maxTokens - Maximum tokens per chunk
 * @returns {Array<string>} - Array of text chunks
 */
function splitTextIntoChunks(text, maxTokens = MAX_TOKENS) {
  // Rough estimate: 1 token ~= 4 characters for English text
  const charsPerToken = 4;
  const maxChars = maxTokens * charsPerToken * 0.75; // 75% to be safe
  
  // Split text into chunks
  const chunks = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.substring(i, i + maxChars));
  }
  
  return chunks;
}

/**
 * Generates a summary using OpenAI
 * @param {string} transcript - Video transcript
 * @param {string} prompt - Summarization prompt
 * @returns {Promise<string|null>} - Generated summary or null
 */
async function generateSummary(transcript, prompt) {
  try {
    // Check if transcript needs to be split
    const chunks = splitTextIntoChunks(transcript);
    
    if (chunks.length > 1) {
      console.log(`Transcript split into ${chunks.length} chunks`);
      
      // For multi-chunk transcripts, we need to summarize each chunk
      // and then combine the summaries
      const chunkSummaries = [];
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        
        const chunkPrompt = `${prompt}\n\nThis is part ${i + 1} of ${chunks.length} of the transcript:\n\n${chunks[i]}`;
        
        const response = await openai.chat.completions.create({
          model: OPENAI_MODEL,
          messages: [
            { role: 'system', content: 'You\'re an advanced content summarizer. Your task is to analyze the transcript of a YouTube video and return a concise summary in JSON format only. Include the video\'s topic, key points, and any noteworthy mentions. Do not include anything outside of the JSON block. Be accurate, structured, and informative.' },
            { role: 'user', content: `Format your response like this:
{
  "title": "Insert video title here",
  "summary": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ],
  "noteworthy_mentions": [
    "Person, project, or tool name if mentioned",
    "Important reference or example"
  ],
  "verdict": "Brief 1-line overall takeaway"
}

Here's the transcript to analyze:

${chunkPrompt}` }
          ],
          temperature: 0.5,
          max_tokens: 1000
        });
        
        const chunkSummary = response.choices[0].message.content;
        chunkSummaries.push(chunkSummary);
      }
      
      // Now combine the chunk summaries
      const combinedSummaryPrompt = `
        Below are summaries of different parts of a YouTube video transcript.
        Please combine them into a single coherent summary following the format specified in the original request:
        
        ${chunkSummaries.join('\n\n---\n\n')}
        
        Original format request:
        ${prompt}
      `;
      
      const finalResponse = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You\'re an advanced content summarizer. Your task is to combine multiple transcript summaries into a single coherent JSON summary. Be accurate, structured, and informative.' },
          { role: 'user', content: `Format your response like this:
{
  "title": "Insert video title here",
  "summary": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ],
  "noteworthy_mentions": [
    "Person, project, or tool name if mentioned",
    "Important reference or example"
  ],
  "verdict": "Brief 1-line overall takeaway"
}

Here are the summaries to combine:

${combinedSummaryPrompt}` }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });
      
      return finalResponse.choices[0].message.content;
    } else {
      // For single-chunk transcripts, just summarize directly
      const fullPrompt = `${prompt}\n\nTranscript:\n\n${transcript}`;
      
      // Extract video title from transcript
      const titleMatch = transcript.match(/Title: (.*?)\n/);
      const videoTitle = titleMatch ? titleMatch[1] : 'Unknown Title';
      
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You\'re an advanced content summarizer. Your task is to analyze the transcript of a YouTube video and return a concise summary in JSON format only. Include the video\'s topic, key points, and any noteworthy mentions. Do not include anything outside of the JSON block. Use the exact title from the transcript. Be accurate, structured, and informative.' },
          { role: 'user', content: fullPrompt + `\n\nFormat your response like this, using the exact title from the transcript:
{
  "title": "${videoTitle}",
  "summary": [
    "Key point 1",
    "Key point 2",
    "Key point 3"
  ],
  "noteworthy_mentions": [
    "Person, project, or tool name if mentioned",
    "Important reference or example"
  ],
  "verdict": "Brief 1-line overall takeaway"
}

Here's the transcript to analyze:

${fullPrompt}` }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });
      
      return response.choices[0].message.content;
    }
  } catch (error) {
    console.error('❌ Error generating summary with OpenAI:', error);
    
    // More detailed error logging
    if (error.response) {
      console.error('OpenAI API error status:', error.response.status);
      console.error('OpenAI API error data:', error.response.data);
      console.error('OpenAI API error headers:', error.response.headers);
    } else {
      console.error('Error message:', error.message);
    }
    
    // Return a formatted error message
    return JSON.stringify({
      title: "Error Generating Summary",
      summary: ["Failed to generate summary due to an API error."],
      noteworthy_mentions: ["Error type: " + (error.type || "Unknown")],
      verdict: "Summary generation failed. Please check server logs for details."
    });
  }
}

/**
 * Generates a daily report using OpenAI
 * @param {Array} summaries - Array of summaries
 * @param {string} prompt - Report generation prompt
 * @returns {Promise<string|null>} - Generated report or null
 */
async function generateDailyReport(summaries, prompt) {
  try {
    // Convert summaries to a string
    const summariesText = summaries
      .map(summary => `Video ID: ${summary.videoId}\nSummary:\n${summary.summary}`)
      .join('\n\n---\n\n');
    
    const fullPrompt = `${prompt}\n\nToday's Summaries:\n\n${summariesText}`;
    
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: `You are an expert content analyst that generates daily reports from video summaries. Follow this exact format:

📆 Daily Report

Highlights
• First highlight point
• Second highlight point
(2-3 key points from today's videos)

🏆 Top Videos
1. "Video Title 1": 8/10
   ○ Brief one-line explanation why
2. "Video Title 2": 7/10
   ○ Brief one-line explanation why

Key Topics
• Topic 1
• Topic 2
• Topic A
• Topic B
• Noteworthy Mentions: Person A, Tool B, Company X

Takeaways
• Main insight from Video 1
• Main insight from Video 2
• Noteworthy trends or connections

👍 Recommendations
• Specific recommendation for viewers
• Which video to prioritize and why

Make it concise, informative, and well-structured. Use bullet points and keep sections clearly separated.` },
        { role: 'user', content: fullPrompt }
      ],
      temperature: 0.5,
      max_tokens: 2000
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating daily report with OpenAI:', error);
    return null;
  }
}

module.exports = {
  generateSummary,
  generateDailyReport,
  splitTextIntoChunks
};
