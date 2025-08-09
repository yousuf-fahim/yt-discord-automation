require('dotenv').config();
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Configuration
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo';
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
            { role: 'system', content: 'You are a helpful assistant that summarizes YouTube video transcripts.' },
            { role: 'user', content: chunkPrompt }
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
          { role: 'system', content: 'You are a helpful assistant that combines multiple summaries into one coherent summary.' },
          { role: 'user', content: combinedSummaryPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });
      
      return finalResponse.choices[0].message.content;
    } else {
      // For single-chunk transcripts, just summarize directly
      const fullPrompt = `${prompt}\n\nTranscript:\n\n${transcript}`;
      
      const response = await openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes YouTube video transcripts. Always return responses in valid JSON format when requested.' },
          { role: 'user', content: fullPrompt }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });
      
      return response.choices[0].message.content;
    }
  } catch (error) {
    console.error('Error generating summary with OpenAI:', error);
    return null;
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
        { role: 'system', content: 'You are an expert content analyst that generates daily reports from video summaries. Create clear, professional reports in natural language (no JSON).' },
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
