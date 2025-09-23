/**
 * Enhanced Transcript Service - Multi-source approach
 * Priority: YouTube Transcript IO API (cloud-friendly)
 * Fallback: VPS Transcript API or RapidAPI
 * Local Python service only in development
 */

require('dotenv').config();
const YouTubeTranscriptIOService = require('./youtube-transcript-io.service');
const VPSTranscriptClient = require('./vps-transcript-client.service'); 
const RapidApiTranscriptService = require('./rapidapi-transcript.service');

// Only import Python service in development
let YouTubeTranscriptApiService;
const isPythonAvailable = process.env.NODE_ENV === 'development' || process.env.FORCE_PYTHON_SERVICE === 'true';

if (isPythonAvailable) {
  try {
    YouTubeTranscriptApiService = require('./youtube-transcript-api.service');
  } catch (error) {
    console.log('⚠️  Python-based service not available, skipping...');
  }
}

// Create the service instance
class TranscriptService {
  constructor(serviceManager, dependencies) {
    this.serviceManager = serviceManager;
    this.cache = dependencies.cache;
    this.logger = serviceManager.logger;
    
    // Initialize YouTube Transcript IO as primary service (cloud-friendly)
    if (process.env.YOUTUBE_TRANSCRIPT_IO_TOKEN) {
      console.log('🎯 Initializing YouTube Transcript IO (Primary)...');
      this.transcriptIOService = new YouTubeTranscriptIOService();
    }
    
    // Initialize VPS client if URL is provided
    if (process.env.VPS_TRANSCRIPT_API_URL) {
      console.log('🔗 Initializing VPS Transcript Client...');
      this.vpsClient = new VPSTranscriptClient({
        baseUrl: process.env.VPS_TRANSCRIPT_API_URL,
        retryAttempts: 3,
        timeout: 30000
      });
    }
    
    // Initialize RapidAPI service if key is provided
    if (process.env.RAPIDAPI_KEY) {
      console.log('⚡ Initializing RapidAPI Transcript Service...');
      try {
        this.rapidApiService = new RapidApiTranscriptService();
      } catch (error) {
        console.log('⚠️  RapidAPI service initialization failed:', error.message);
      }
    }
    
    // Initialize local Python service only in development or when forced
    if (isPythonAvailable && YouTubeTranscriptApiService) {
      console.log('🐍 Initializing Local Python Service (Dev/Fallback)...');
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
    } else {
      console.log('⚠️  Python service skipped (cloud deployment or not available)');
    }
    
    // Log which services are available
    this.logAvailableServices();
  }

  logAvailableServices() {
    const services = [];
    if (this.transcriptIOService) services.push('YouTube Transcript IO');
    if (this.vpsClient) services.push('VPS API');
    if (this.rapidApiService) services.push('RapidAPI');
    if (this.youtubeApi) services.push('Python API');
    
    console.log(`📋 Available transcript services: ${services.join(', ')}`);
    if (services.length === 0) {
      console.warn('⚠️  NO TRANSCRIPT SERVICES AVAILABLE! Bot will not be able to extract transcripts.');
    }
  }

  async initialize() {
    // Only initialize Python service if available
    if (this.youtubeApi) {
      await this.youtubeApi.initPromise;
      this.logger.info('Transcript service initialized with YouTube Transcript API (Python)');
    } else {
      this.logger.info('Transcript service initialized (cloud-only services)');
    }
  }

  async getTranscript(videoId, options = {}) {
    try {
      this.logger.info(`Getting transcript for video: ${videoId}`);
      
      // Try YouTube Transcript IO first (cloud-friendly, most reliable)
      if (this.transcriptIOService) {
        try {
          console.log('🎯 Trying YouTube Transcript IO API...');
          const ioResult = await this.transcriptIOService.getTranscript(videoId, options);
          
          if (ioResult) {
            this.logger.info(`YouTube Transcript IO extracted successfully: ${ioResult.length} characters`);
            return ioResult;
          }
        } catch (ioError) {
          console.log(`❌ YouTube Transcript IO failed: ${ioError.message}`);
          console.log('⏳ Falling back to next service...');
        }
      }
      
      // Try VPS client second if available
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
          console.log('⏳ Falling back to next service...');
        }
      }
      
      // Try RapidAPI third
      if (this.rapidApiService) {
        try {
          console.log('⚡ Trying RapidAPI Transcript Service...');
          const rapidResult = await this.rapidApiService.getTranscript(videoId, options);
          
          if (rapidResult) {
            this.logger.info(`RapidAPI transcript extracted successfully: ${rapidResult.length} characters`);
            return rapidResult;
          }
        } catch (rapidError) {
          console.log(`❌ RapidAPI failed: ${rapidError.message}`);
          console.log('⏳ Falling back to next service...');
        }
      }
      
      // Try local Python service last (development only)
      if (this.youtubeApi) {
        try {
          console.log('🐍 Trying Local Python Service...');
          const result = await this.youtubeApi.getTranscript(videoId, {
            languages: options.languages || ['en', 'auto']
          });
          
          if (result) {
            this.logger.info(`Local Python transcript extracted successfully: ${result.length} characters`);
            return result;
          }
        } catch (pythonError) {
          console.log(`❌ Local Python failed: ${pythonError.message}`);
        }
      }
      
      // If all services failed
      const availableServices = [
        this.transcriptIOService && 'YouTube Transcript IO',
        this.vpsClient && 'VPS API', 
        this.rapidApiService && 'RapidAPI',
        this.youtubeApi && 'Python API'
      ].filter(Boolean);
      
      this.logger.warn(`All transcript sources exhausted. Tried: ${availableServices.join(', ')}`);
      return null;
      
    } catch (error) {
      this.logger.error('Transcript extraction failed', error);
      this.logger.warn('All transcript sources exhausted');
      
      return null;
    }
  }

  async healthCheck() {
    const checks = {};
    
    // Check YouTube Transcript IO if available
    if (this.transcriptIOService) {
      checks.transcriptIO = await this.transcriptIOService.healthCheck();
    }
    
    // Check VPS client if available
    if (this.vpsClient) {
      checks.vps = await this.vpsClient.healthCheck();
    }
    
    // Check RapidAPI if available
    if (this.rapidApiService) {
      checks.rapidAPI = await this.rapidApiService.healthCheck();
    }
    
    // Check local service if available
    if (this.youtubeApi) {
      checks.local = await this.youtubeApi.healthCheck();
    }
    
    const hasHealthy = Object.values(checks).some(check => 
      check.status === 'healthy' || check.status === 'ok'
    );
    
    const primaryService = this.transcriptIOService ? 'YouTube Transcript IO' :
                          this.vpsClient ? 'VPS API' :
                          this.rapidApiService ? 'RapidAPI' :
                          this.youtubeApi ? 'Local Python' : 'None';
    
    return {
      status: hasHealthy ? 'healthy' : 'unhealthy',
      service: 'Multi-source Transcript Service',
      sources: checks,
      primary: primaryService,
      available: Object.keys(checks).length,
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
