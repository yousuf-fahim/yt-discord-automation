/**
 * Summary Service - AI-powered content summarization
 */

const { OpenAI } = require('openai');

class SummaryService {
  constructor(serviceManager, dependencies) {
    // Handle both old (direct config/openai) and new (ServiceManager) initialization
    if (serviceManager.config) {
      // New ServiceManager pattern
    this.serviceManager = serviceManager;
      this.config = serviceManager.config.openai;
    this.logger = serviceManager.logger;
      this.cache = dependencies?.cache;
    
      // Initialize OpenAI client
    this.openai = new OpenAI({
      apiKey: this.config.apiKey
    });
    } else {
      // Legacy direct initialization (for backward compatibility)
      this.config = serviceManager; // First param is actually config
      this.openai = dependencies; // Second param is actually openai client
      this.logger = console;
      this.cache = null;
    }
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
      if (this.openai) {
      await this.openai.models.list();
      this.logger.info('Summary service initialized with OpenAI');
      } else {
        throw new Error('OpenAI client not initialized');
      }
    } catch (error) {
      this.logger.error('OpenAI initialization failed', error);
      throw error;
    }
  }

  /**
   * Intelligently truncate transcript for better AI processing
   * @param {string} transcript - Full video transcript
   * @param {Object} options - Truncation options
   * @returns {string} Optimized transcript
   */
  optimizeTranscriptContext(transcript, options = {}) {
    const {
      maxTokens = 4000,  // Typical OpenAI context window
      extractionStrategy = 'key_sections',
      minSectionLength = 50,
      maxSections = 10
    } = options;

    // Basic preprocessing
    const cleanedTranscript = transcript
      .replace(/\[.*?\]/g, '')  // Remove brackets
      .replace(/\(.*?\)/g, '')  // Remove parentheses
      .replace(/\n{2,}/g, '\n')  // Normalize newlines
      .trim();

    // Strategy-based extraction
    switch (extractionStrategy) {
      case 'key_sections': {
        // Extract most informative sections
        const sections = cleanedTranscript.split('\n')
          .filter(section => section.length >= minSectionLength)
          .sort((a, b) => b.length - a.length);  // Prioritize longer sections

        const selectedSections = sections
          .slice(0, maxSections)
          .sort((a, b) => cleanedTranscript.indexOf(a) - cleanedTranscript.indexOf(b));

        return selectedSections.join('\n');
      }

      case 'sliding_window': {
        // Use sliding window approach
        const words = cleanedTranscript.split(/\s+/);
        const windowSize = Math.floor(maxTokens / 4);  // Rough token estimation
        
        const windows = [];
        for (let i = 0; i < words.length; i += windowSize) {
          windows.push(words.slice(i, i + windowSize).join(' '));
        }

        return windows[0];  // Return first window, could be enhanced later
      }

      default:
        return cleanedTranscript;
    }
  }

  /**
   * Generate advanced system prompt with dynamic instructions
   * @param {string} videoTitle - Title of the video
   * @param {Object} options - Prompt customization options
   * @returns {string} Refined system prompt
   */
  generateAdvancedSystemPrompt(videoTitle, options = {}) {
    const {
      tone = 'professional',
      detailLevel = 'comprehensive',
      outputFormat = 'markdown'
    } = options;

    const toneInstructions = {
      'professional': 'Use a clear, concise, and objective tone.',
      'conversational': 'Use a friendly, engaging, and slightly informal tone.',
      'academic': 'Maintain a scholarly and analytical tone with precise language.'
    };

    const detailLevelInstructions = {
      'brief': 'Focus on the most critical 3-5 key points.',
      'moderate': 'Provide a balanced overview with main points and supporting details.',
      'comprehensive': 'Offer an in-depth analysis covering nuanced aspects of the content.'
    };

    const outputFormatInstructions = {
      'markdown': '- Use markdown formatting\n- Include headers, bullet points, and emphasis\n- Ensure readability',
      'plain': 'Use simple, clean text without special formatting',
      'structured': 'Use a clear, hierarchical structure with numbered/nested points'
    };

    return `You are an expert content summarizer. Your task is to generate a high-quality summary.

VIDEO CONTEXT: ${videoTitle}

CORE INSTRUCTIONS:
1. ${toneInstructions[tone]}
2. ${detailLevelInstructions[detailLevel]}
3. ${outputFormatInstructions[outputFormat]}

ADVANCED GUIDELINES:
- Extract the most meaningful and impactful information
- Prioritize insights over mere repetition
- Maintain the original context and intent of the content
- Be objective and avoid personal bias
- If the content lacks substantial information, clearly state that

OUTPUT REQUIREMENTS:
- Maximum length: 500-750 words
- Ensure coherence and logical flow
- Proofread for clarity and precision

CRITICAL CONSTRAINTS:
- Do NOT hallucinate or add information not present in the source
- If key information is missing, indicate gaps in understanding
- Provide a neutral, fact-based summary`;
  }

  /**
   * Generate summary with advanced quality control
   * @param {string} transcript - Video transcript
   * @param {string} videoTitle - Video title
   * @param {string} videoUrl - Video URL
   * @param {string} customPrompt - Optional custom prompt
   * @returns {Promise<string>} Generated summary
   */
  async generateSummary(transcript, videoTitle, videoUrl, customPrompt = null) {
    try {
      // Optimize transcript context
      const optimizedTranscript = this.optimizeTranscriptContext(transcript);

      // Determine prompt strategy
      const systemPrompt = customPrompt || this.generateAdvancedSystemPrompt(videoTitle, {
        tone: 'professional',
        detailLevel: 'comprehensive',
        outputFormat: 'markdown'
      });

      // Call OpenAI with enhanced parameters
      const summaryResponse = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',  // Use latest model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: optimizedTranscript }
        ],
        temperature: 0.3,  // Lower temperature for more consistent output
        max_tokens: 750,
        top_p: 0.8,
        frequency_penalty: 0.2,
        presence_penalty: 0.1
      });

      const summary = summaryResponse.choices[0].message.content.trim();

      // Optional: Add quality scoring/validation
      const qualityScore = this.evaluateSummaryQuality(summary, optimizedTranscript);

      return {
        summary,
        qualityScore,
        videoTitle,
        videoUrl
      };
    } catch (error) {
      this.logger.error('Summary generation failed', error);
      throw error;
    }
  }

  /**
   * Evaluate summary quality based on multiple metrics
   * @param {string} summary - Generated summary
   * @param {string} originalTranscript - Original transcript
   * @returns {number} Quality score (0-100)
   */
  evaluateSummaryQuality(summary, originalTranscript) {
    let score = 50;  // Base score

    // Length coherence
    const summaryWords = summary.split(/\s+/).length;
    const transcriptWords = originalTranscript.split(/\s+/).length;
    const lengthRatio = summaryWords / transcriptWords;
    score += lengthRatio > 0.1 && lengthRatio < 0.3 ? 10 : -10;

    // Keyword coverage
    const keywords = this.extractKeywords(originalTranscript);
    const keywordsCovered = keywords.filter(kw => summary.toLowerCase().includes(kw.toLowerCase()));
    score += (keywordsCovered.length / keywords.length) * 20;

    // Structural quality
    score += this.checkSummaryStructure(summary) ? 10 : -10;

    // Prevent extreme scores
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Extract key keywords from transcript
   * @param {string} transcript - Video transcript
   * @returns {string[]} Important keywords
   */
  extractKeywords(transcript) {
    // Basic NLP keyword extraction
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
    ]);

    const words = transcript.toLowerCase().match(/\b\w+\b/g) || [];
    const wordFrequency = {};

    words.forEach(word => {
      if (!stopWords.has(word)) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });

    return Object.entries(wordFrequency)
      .filter(([_, count]) => count > 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Check summary structural quality
   * @param {string} summary - Generated summary
   * @returns {boolean} Whether summary meets structural criteria
   */
  checkSummaryStructure(summary) {
    const structuralChecks = [
      summary.includes('\n'),  // Multiple paragraphs
      summary.length > 100,    // Minimum meaningful length
      /[.!?]$/.test(summary),  // Proper sentence ending
      summary.split(/\s+/).some(word => word.length > 5)  // Contains substantive words
    ];

    return structuralChecks.filter(Boolean).length >= 3;
  }

  async generateCustomReport(summariesData, customPrompt) {
    try {
      this.logger.info('Generating custom report with OpenAI...');
      
      const systemMessage = `You are an advanced report generator. Follow the user's instructions exactly for format and content. Output exactly what is requested - do not add extra formatting, headers, or explanations unless specifically asked for in the prompt. Always end your response with "\\n\\nLLM used: ${this.config.model}"`;
      
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
          content: `You are an AI assistant that generates custom daily reports based on user prompts. Follow the user's instructions exactly and maintain their preferred format and style. Always end your response with "\\n\\nLLM used: ${this.config.model}"`
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
