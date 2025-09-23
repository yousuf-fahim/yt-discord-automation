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
        ? 'You are an advanced content summarizer. Follow the user\'s specific instructions exactly. Respond in the format requested by the user\'s prompt. Do not add JSON formatting, code blocks, or extra markup unless the prompt explicitly asks for it.'
        : 'You are a helpful assistant that creates concise, informative summaries of YouTube video transcripts. Always respond in plain text format. Do not use JSON, code blocks, or any special formatting unless explicitly requested.';
      
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
      
      // Debug logging for JSON detection
      const isJson = this.isJsonResponse(summary);
      const isCustomPrompt = !!customPrompt;
      
      // Log detailed information about the response
      this.logger.debug(`Summary generated for "${videoTitle}": ${summary.length} chars, JSON: ${isJson}, Custom: ${isCustomPrompt}`);
      
      if (isJson && !isCustomPrompt) {
        this.logger.warn('⚠️  UNEXPECTED JSON: AI returned JSON format for regular summary without custom prompt', {
          videoTitle: videoTitle?.substring(0, 50),
          summaryPreview: summary.substring(0, 200),
          promptUsed: this.buildSummaryPrompt('...', videoTitle).substring(0, 100)
        });
      } else if (isJson && isCustomPrompt && !customPrompt.toLowerCase().includes('json')) {
        this.logger.warn('⚠️  POTENTIAL ISSUE: AI returned JSON but custom prompt doesn\'t mention JSON', {
          videoTitle: videoTitle?.substring(0, 50),
          promptPreview: customPrompt.substring(0, 100)
        });
      } else if (isJson && isCustomPrompt) {
        this.logger.info('✅ AI returned JSON format for custom prompt (appears intentional)');
      }
      
      // Format the output if it's JSON from a custom prompt
      const formattedSummary = this.formatSummaryOutput(summary, videoTitle, isCustomPrompt);
      
      // Cache the result
      await this.cache.set(cacheKey, formattedSummary);
      
      this.logger.info(`Generated summary for: ${videoTitle}${customPrompt ? ' (custom prompt)' : ''}`);
      return formattedSummary;
      
    } catch (error) {
      this.logger.error('Summary generation failed', error);
      throw error;
    }
  }

  async generateCustomReport(summariesData, customPrompt) {
    try {
      this.logger.info('Generating custom report with OpenAI...');
      
      const systemMessage = 'You are an advanced report generator. Follow the user\'s instructions exactly for format and content. Output exactly what is requested - do not add extra formatting, headers, or explanations unless specifically asked for in the prompt.';
      
      const userPrompt = `${customPrompt}

Data to process:
${summariesData}`;

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.config.maxTokens,
        temperature: 0.3
      });

      const report = response.choices[0].message.content;
      
      // Debug logging for report format
      const isJson = this.isJsonResponse(report);
      if (isJson) {
        this.logger.info('📋 Custom report generated in JSON format', {
          promptPreview: customPrompt.substring(0, 50)
        });
      } else {
        this.logger.info('📋 Custom report generated in text format', {
          promptPreview: customPrompt.substring(0, 50)
        });
      }
      
      this.logger.info('Custom report generated successfully');
      return report.trim();
      
    } catch (error) {
      this.logger.error('Custom report generation failed', error);
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

  buildCustomPrompt(customPrompt, transcript, videoTitle, videoUrl) {
    return `${customPrompt}

TRANSCRIPT:
${transcript}

VIDEO TITLE: ${videoTitle}
VIDEO URL: ${videoUrl}`;
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

  /**
   * Generate custom daily report using OpenAI
   * @param {string} customPrompt - Custom prompt from Discord
   * @param {string} reportContent - The default report content
   * @returns {Promise<string>} - Generated custom report
   */
  async generateCustomDailyReport(customPrompt, reportContent) {
    try {
      this.logger.debug('Generating custom daily report with OpenAI');
      
      const messages = [
        {
          role: "system",
          content: "You are an AI assistant that generates custom daily reports based on user prompts. Follow the user's instructions exactly and maintain their preferred format and style."
        },
        {
          role: "user", 
          content: this.buildCustomReportPrompt(customPrompt, reportContent)
        }
      ];

      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: messages,
        max_tokens: this.config.maxTokens,
        temperature: 0.7
      });

      const customReport = response.choices[0]?.message?.content?.trim();
      
      if (!customReport) {
        this.logger.warn('Empty response from OpenAI for custom daily report');
        return reportContent; // Fallback to default report
      }

      // Debug logging for daily reports
      const isJson = this.isJsonResponse(customReport);
      this.logger.debug(`Custom daily report generated: ${customReport.length} chars, JSON: ${isJson}`);
      
      if (isJson && !customPrompt.toLowerCase().includes('json')) {
        this.logger.warn('⚠️  UNEXPECTED JSON: Daily report returned JSON but prompt doesn\'t mention JSON', {
          promptPreview: customPrompt.substring(0, 100),
          reportPreview: customReport.substring(0, 200)
        });
      }
      
      return customReport;

    } catch (error) {
      this.logger.error('Error generating custom daily report with OpenAI:', error);
      return reportContent; // Fallback to default report
    }
  }

  /**
   * Build prompt for custom daily report
   */
  buildCustomReportPrompt(customPrompt, reportContent) {
    return `${customPrompt}

DEFAULT REPORT CONTENT:
${reportContent}`;
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
