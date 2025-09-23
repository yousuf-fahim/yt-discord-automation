/**
 * Enhanced Transcript Service - Multi-source approach
 * Primary: VPS Transcript API (DigitalOcean)
 * Fallback: Local YouTube Transcript API with proxy
 */

require('dotenv').config();
const YouTubeTranscriptApiService = require('./youtube-transcript-api.service');
const VPSTranscriptClient = require('./vps-transcript-client.service');

// Create the service instance
class TranscriptService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.cache = dependencies.cache;
    this.logger = serviceManager.logger;
    
    // Initialize VPS client if URL is provided
    if (process.env.VPS_TRANSCRIPT_API_URL) {
      console.log('🔗 Initializing VPS Transcript Client...');
      this.vpsClient = new VPSTranscriptClient({
        baseUrl: process.env.VPS_TRANSCRIPT_API_URL,
        retryAttempts: 3,
        timeout: 30000
      });
    } else {
      console.log('⚠️  No VPS_TRANSCRIPT_API_URL configured, using local service only');
    }
    
    // Initialize local service as fallback
    this.youtubeApi = new YouTubeTranscriptApiService({
      cacheEnabled: true,
      retryAttempts: 3,
      timeout: 30000,
      proxyConfig: process.env.PROXY_HOST ? {
        host: process.env.PROXY_HOST,
        port: process.env.PROXY_PORT || '31280',
        username: process.env.PROXY_USERNAME,
        password: process.env.PROXY_PASSWORD
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
      
      // Try VPS client first if available
      if (this.vpsClient) {
        try {
          console.log('🔗 Trying VPS Transcript API...');
          const vpsResult = await this.vpsClient.getTranscript(videoId, {
            languages: options.languages || ['en', 'auto']
          });
          
          if (vpsResult) {
            this.logger.info(`VPS transcript extracted successfully: ${vpsResult.length} characters`);
            return vpsResult;
          }
        } catch (vpsError) {
          console.log(`❌ VPS failed: ${vpsError.message}`);
          console.log('⏳ Falling back to local service...');
        }
      }
      
      // Fallback to local service
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
    
    // Check VPS client if available
    if (this.vpsClient) {
      checks.vps = await this.vpsClient.healthCheck();
    }
    
    // Check local service
    checks.local = await this.youtubeApi.healthCheck();
    
    const hasHealthy = Object.values(checks).some(check => check.status === 'healthy');
    
    return {
      status: hasHealthy ? 'healthy' : 'unhealthy',
      service: 'Multi-source Transcript Service',
      sources: checks,
      primary: this.vpsClient ? 'VPS API' : 'Local Service',
      timestamp: new Date().toISOString()
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
