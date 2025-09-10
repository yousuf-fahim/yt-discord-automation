/**
 * Enhanced Transcript Service - Multi-source approach
 * Primary: YouTube Transcript IO API (cloud-friendly)
 * Fallback: Local YouTube Transcript API (local development only)
 */

require('dotenv').config();
const YouTubeTranscriptIOService = require('./youtube-transcript-io.service');
const YouTubeTranscriptApiService = require('./youtube-transcript-api.service');

// Create the service instance
class TranscriptService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.cache = dependencies.cache;
    this.logger = serviceManager.logger;
    
    // Initialize YouTube Transcript IO as primary service
    this.transcriptIO = new YouTubeTranscriptIOService({
      cacheEnabled: true,
      retryAttempts: 3,
      timeout: 30000
    });
    
    // Initialize local service as fallback (works only locally)
    this.youtubeApi = new YouTubeTranscriptApiService({
      cacheEnabled: true,
      retryAttempts: 2,
      timeout: 20000
    });
  }

  async initialize() {
    await this.youtubeApi.initPromise;
    this.logger.info('Transcript service initialized with YouTube Transcript IO and fallback API');
  }

  async getTranscript(videoId, options = {}) {
    try {
      this.logger.info(`Getting transcript for video: ${videoId}`);
      
      // Try YouTube Transcript IO first (primary, works in cloud)
      try {
        console.log('🌐 Trying YouTube Transcript IO API...');
        const transcriptIOResult = await this.transcriptIO.getTranscript(videoId, options);
        
        if (transcriptIOResult) {
          this.logger.info(`YouTube Transcript IO extracted successfully: ${transcriptIOResult.length} characters`);
          return transcriptIOResult;
        }
      } catch (transcriptIOError) {
        console.log(`❌ YouTube Transcript IO failed: ${transcriptIOError.message}`);
        console.log('⏳ Falling back to local service...');
      }
      
      // Fallback to local service (works only locally)
      const result = await this.youtubeApi.getTranscript(videoId, {
        languages: options.languages || ['en', 'auto']
      });
      
      if (result) {
        this.logger.info(`Local transcript extracted successfully: ${result.length} characters`);
        return result;
      }
      
      return null;
    } catch (error) {
      this.logger.error('Transcript extraction failed', error);
      this.logger.warn('All transcript sources exhausted');
      
      return null;
    }
  }

  async healthCheck() {
    const checks = {};
    
    // Check YouTube Transcript IO service
    checks.transcriptIO = await this.transcriptIO.healthCheck();
    
    // Check local service
    checks.local = await this.youtubeApi.healthCheck();
    
    const hasHealthy = Object.values(checks).some(check => check.status === 'ok' || check.status === 'healthy');
    
    return {
      status: hasHealthy ? 'ok' : 'error',
      details: hasHealthy ? 'Multi-source transcript service operational' : 'All transcript sources unavailable',
      sources: checks,
      primary: 'YouTube Transcript IO'
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
