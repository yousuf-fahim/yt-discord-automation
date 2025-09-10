/**
 * Summary Service - AI-powered content summarization
 */

const { OpenAI } = require('openai');

class SummaryService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.cache = dependencies.cache;
    this.logger = serviceManager.logger;
    this.config = serviceManager.config.openai;
    
    this.openai = new OpenAI({
      apiKey: this.config.apiKey
    });
  }

  async initialize() {
    // Test OpenAI connection
    try {
      await this.openai.models.list();
      this.logger.info('Summary service initialized with OpenAI');
    } catch (error) {
      this.logger.error('OpenAI initialization failed', error);
      throw error;
    }
  }

  async generateSummary(transcript, videoTitle, videoUrl, customPrompt = null) {
    const cacheKey = `summary_${this.hashString(transcript + (customPrompt || ''))}`;
    
    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug('Using cached summary');
      return cached;
    }

    try {
      const prompt = customPrompt 
        ? this.buildCustomPrompt(transcript, videoTitle, customPrompt)
        : this.buildSummaryPrompt(transcript, videoTitle);
      
      const systemMessage = customPrompt 
        ? 'You are an advanced content summarizer. Follow the user\'s specific instructions exactly. Output ONLY what is requested - do not add extra formatting, headers, or explanations unless specifically asked.'
        : 'You are a helpful assistant that creates concise, informative summaries of YouTube video transcripts.';
      
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.3
      });

      const summary = response.choices[0].message.content;
      
      // Format the output if it's JSON from a custom prompt
      const formattedSummary = this.formatSummaryOutput(summary, videoTitle, customPrompt);
      
      // Cache the result
      await this.cache.set(cacheKey, formattedSummary);
      
      this.logger.info(`Generated summary for: ${videoTitle}${customPrompt ? ' (custom prompt)' : ''}`);
      return formattedSummary;
      
    } catch (error) {
      this.logger.error('Summary generation failed', error);
      throw error;
    }
  }

  buildSummaryPrompt(transcript, title) {
    return `Please provide a comprehensive summary of this YouTube video transcript.

Video Title: ${title}

Transcript:
${transcript}

Please provide:
1. A brief overview (2-3 sentences)
2. Key points discussed (bullet points)
3. Main conclusions or takeaways

Keep the summary concise but informative, focusing on the most important content.`;
  }

  buildCustomPrompt(transcript, title, customPrompt) {
    return `${customPrompt}

Video Title: ${title}

Transcript:
${transcript}

IMPORTANT FORMATTING REQUIREMENTS:
- If the prompt asks for JSON format, respond ONLY with valid JSON
- Do not include any text before or after the JSON block
- Do not include markdown code blocks or backticks
- Ensure the JSON structure includes: title, summary (array), noteworthy_mentions (array), verdict (string)
- Make sure all JSON strings are properly escaped and the JSON is valid`;
  }

  formatSummaryOutput(summary, videoTitle, isCustomPrompt) {
    // For custom prompts, follow the prompt instructions exactly - don't modify output
    if (isCustomPrompt) {
      return summary.trim();
    }
    
    // For regular summaries, return as-is
    return summary;
  }

  isJsonResponse(text) {
    const trimmed = text.trim();
    return trimmed.startsWith('{') && trimmed.endsWith('}');
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  async healthCheck() {
    try {
      await this.openai.models.list();
      return {
        status: 'ok',
        model: this.config.model,
        apiKeyConfigured: !!this.config.apiKey
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }
}

module.exports = SummaryService;
