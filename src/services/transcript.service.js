/**
 * Enhanced Transcript Service - Now using FREE YouTube Transcript API
 * Replaces complex solutions with reliable, free Python library
 */

require('dotenv').config();
const YouTubeTranscriptApiService = require('./youtube-transcript-api.service');

// Create the service instance
class TranscriptService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.cache = dependencies.cache;
    this.logger = serviceManager.logger;
    
    // Initialize the free YouTube Transcript API service
    this.youtubeApi = new YouTubeTranscriptApiService({
      cacheEnabled: true,
      retryAttempts: 3,
      timeout: 30000,
      proxyConfig: process.env.PROXY_URL ? {
        http: process.env.PROXY_URL,
        https: process.env.PROXY_URL
      } : null
    });
  }

  async initialize() {
    await this.youtubeApi.initPromise;
    this.logger.info('Transcript service initialized with YouTube Transcript API');
  }

  async getTranscript(videoId, options = {}) {
    try {
      this.logger.info(`Getting transcript for video: ${videoId}`);
      
      const result = await this.youtubeApi.getTranscript(videoId, {
        languages: options.languages || ['en', 'auto']
      });
      
      if (result) {
        this.logger.info(`Transcript extracted successfully: ${result.length} characters`);
        return result;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Transcript extraction failed', error);
      
      // Try fallback to existing methods if available
      try {
        const legacyTranscript = require('../../api/transcript');
        if (legacyTranscript && legacyTranscript.getTranscript) {
          this.logger.info('Attempting legacy fallback...');
          return await legacyTranscript.getTranscript(videoId);
        }
      } catch (legacyError) {
        this.logger.warn('Legacy fallback not available');
      }
      
      return null;
    }
  }

  async healthCheck() {
    const health = await this.youtubeApi.healthCheck();
    return {
      status: health.status === 'healthy' ? 'healthy' : 'unhealthy',
      service: 'Enhanced Transcript Service',
      provider: 'YouTube Transcript API (Free)',
      details: health
    };
  }
}

// Legacy compatibility function for existing code
async function getTranscript(videoId, options = {}) {
  console.log(`🎯 FREE YouTube Transcript API extraction for: ${videoId}`);
  
  try {
    // Create a temporary instance for legacy calls
    const service = new YouTubeTranscriptApiService({
      cacheEnabled: true,
      retryAttempts: 2
    });
    
    const result = await service.getTranscript(videoId, options);
    
    if (result) {
      console.log(`✅ FREE API extraction successful: ${result.length} characters`);
      return result;
    }
    
    console.log('⚠️ FREE API extraction failed, trying legacy fallback...');
    
    // Fallback to original implementation if available
    try {
      const legacyTranscript = require('../../api/transcript');
      if (legacyTranscript && legacyTranscript.getTranscript) {
        return await legacyTranscript.getTranscript(videoId);
      }
    } catch (legacyError) {
      console.log('Legacy fallback not available:', legacyError.message);
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ FREE API transcript extraction failed for ${videoId}:`, error.message);
    
    // Log specific error suggestions
    if (error.message.includes('youtube-transcript-api not installed')) {
      console.log('💡 Fix: Run "pip install youtube-transcript-api"');
    } else if (error.message.includes('Python execution failed')) {
      console.log('💡 Fix: Check Python installation and PATH');
    } else if (error.message.includes('No transcripts available')) {
      console.log('💡 Video may not have captions enabled');
    }
    
    return null;
  }
}

module.exports = TranscriptService;

// Export legacy functions for compatibility
module.exports.getTranscript = getTranscript;
