/**
 * Summary Service - AI-powered content summarization
 */

const { OpenAI } = require('openai');

class SummaryService {
  constructor(config, openai) {
    this.config = config;
    this.openai = openai;
  }

  // Helper method to get the correct parameters based on model
  getModelParameters(temperature = 0.3) {
    const model = this.config.model.toLowerCase();
    const params = {};
    
    // GPT-5 and o1/o3 models use max_completion_tokens and don't support custom temperature
    if (model.includes('gpt-5') || model.includes('o1') || model.includes('o3')) {
      // These models need more tokens for reasoning
      const minTokens = model.includes('gpt-5') ? 1000 : 500;
      params.max_completion_tokens = Math.max(this.config.maxTokens, minTokens);
      // These models use default temperature only (reasoning models)
    } else {
      // Other models use max_tokens and support custom temperature
      params.max_tokens = this.config.maxTokens;
      params.temperature = temperature;
    }
    
    return params;
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
        ? this.buildCustomPrompt(customPrompt, transcript, videoTitle, videoUrl)
        : this.buildSummaryPrompt(transcript, videoTitle);
      
      const isJsonRequested = customPrompt && (
        customPrompt.toLowerCase().includes('json') || 
        customPrompt.toLowerCase().includes('{') || 
        customPrompt.toLowerCase().includes('}')
      );
      
      const systemMessage = customPrompt 
        ? `You are an advanced content summarizer. Follow the user's specific instructions exactly. ${isJsonRequested ? 'If the prompt asks for JSON format, respond with valid JSON only - no extra text, code blocks, or formatting.' : 'Respond in the format requested by the user\'s prompt.'}`
        : 'You are a helpful assistant that creates concise, informative summaries of YouTube video transcripts. Always respond in plain text format. Do not use JSON, code blocks, or any special formatting unless explicitly requested.';
      
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        ...this.getModelParameters(0.3)
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
      const formattedSummary = this.formatSummaryOutput(summary, videoTitle, isCustomPrompt, customPrompt);
      
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
        ...this.getModelParameters(0.3)
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

  formatSummaryOutput(summary, videoTitle, isCustomPrompt, customPrompt = null) {
    const trimmed = summary.trim();
    
    // For custom prompts, check if JSON was requested
    if (isCustomPrompt && customPrompt) {
      const isJsonRequested = (
        customPrompt.toLowerCase().includes('json') || 
        customPrompt.toLowerCase().includes('{') || 
        customPrompt.toLowerCase().includes('}')
      );
      
      // If JSON was requested, ensure we return clean JSON
      if (isJsonRequested && this.isJsonResponse(trimmed)) {
        // Clean up any markdown formatting that might wrap the JSON
        const cleanJson = trimmed.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        return cleanJson;
      }
    }
    
    return trimmed;
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
        ...this.getModelParameters(0.7)
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
