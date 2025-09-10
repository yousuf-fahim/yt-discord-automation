/**
 * YouTube Transcript IO Service
 * Primary transcript provider using youtube-transcript.io API
 */

require('dotenv').config();
const fetch = require('node-fetch');

class YouTubeTranscriptIOService {
  constructor(config = {}) {
    this.config = {
      baseUrl: 'https://www.youtube-transcript.io/api',
      apiToken: process.env.YOUTUBE_TRANSCRIPT_IO_TOKEN,
      retryAttempts: 3,
      timeout: 30000,
      cacheEnabled: true,
      ...config
    };

    if (!this.config.apiToken) {
      console.warn('⚠️ YOUTUBE_TRANSCRIPT_IO_TOKEN not configured');
    }

    this.cache = new Map();
    this.rateLimitReset = null;
  }

  async getTranscript(videoId, options = {}) {
    if (!this.config.apiToken) {
      throw new Error('YouTube Transcript IO API token not configured');
    }

    if (!videoId) {
      throw new Error('Video ID is required');
    }

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = this.getCachedTranscript(videoId);
      if (cached) {
        console.log(`📦 Using cached transcript for ${videoId}`);
        return cached;
      }
    }

    console.log(`🎯 Fetching transcript from YouTube Transcript IO for ${videoId}`);

    let lastError = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Check rate limit
        if (this.rateLimitReset && Date.now() < this.rateLimitReset) {
          const waitTime = this.rateLimitReset - Date.now();
          console.log(`⏳ Rate limited, waiting ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        console.log(`🎯 YouTube Transcript IO attempt ${attempt}/${this.config.retryAttempts}`);
        
        const transcript = await this.fetchFromAPI(videoId, options);
        
        if (transcript) {
          // Cache the result
          if (this.config.cacheEnabled) {
            this.cacheTranscript(videoId, transcript);
          }
          
          console.log(`✅ Transcript fetched successfully: ${transcript.length} characters`);
          return transcript;
        }
        
      } catch (error) {
        lastError = error;
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        
        // Handle rate limiting
        if (error.status === 429) {
          const retryAfter = error.retryAfter || 10000;
          this.rateLimitReset = Date.now() + retryAfter;
          
          if (attempt < this.config.retryAttempts) {
            console.log(`⏳ Rate limited, retrying in ${retryAfter}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
          }
        } else if (attempt < this.config.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to fetch transcript after ${this.config.retryAttempts} attempts`);
  }

  async fetchFromAPI(videoId, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/transcripts`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + this.config.apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [videoId]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`API request failed: ${response.status} ${response.statusText}`);
        error.status = response.status;
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          error.retryAfter = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
        }
        
        throw error;
      }

      const data = await response.json();
      
      // Extract transcript from response
      if (data && data.length > 0) {
        const videoData = data[0];
        console.log('API response structure:', JSON.stringify(videoData, null, 2).substring(0, 500) + '...');
        
        // Extract transcript from tracks
        if (videoData.tracks && videoData.tracks.length > 0) {
          const track = videoData.tracks[0]; // Use first track (usually English)
          
          if (track.transcript && track.transcript.length > 0) {
            // Extract text from all transcript segments and join them
            const transcriptText = track.transcript.map(segment => segment.text).join(' ');
            return this.formatTranscript(transcriptText);
          }
        }
        
        console.log('❌ No transcript tracks found in response');
        return null;
      }
      
      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      
      throw error;
    }
  }

  formatTranscript(transcriptData) {
    if (typeof transcriptData === 'string') {
      return transcriptData;
    }
    
    if (Array.isArray(transcriptData)) {
      return transcriptData
        .map(item => item.text || item.content || '')
        .join(' ')
        .trim();
    }
    
    return String(transcriptData);
  }

  /**
   * Get video title from YouTube Transcript IO API
   * @param {string} videoId - The YouTube video ID
   * @returns {Promise<string|null>} - The video title or null if not found
   */
  async getVideoTitle(videoId) {
    if (!this.config.apiToken) {
      console.log('⚠️ YouTube Transcript IO API token not configured');
      return null;
    }

    if (!videoId) {
      console.log('⚠️ Video ID is required');
      return null;
    }

    try {
      console.log(`🎬 Fetching title from YouTube Transcript IO for ${videoId}...`);
      
      const response = await fetch(`${this.config.baseUrl}/transcripts`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + this.config.apiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ids: [videoId]
        })
      });

      if (!response.ok) {
        console.log(`❌ Title API request failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const videoData = data[0];
        
        // Try different possible title fields
        const title = videoData.title || 
                     videoData.video_title || 
                     videoData.name ||
                     (videoData.metadata && videoData.metadata.title);
        
        if (title && title.length > 0) {
          console.log(`✅ YouTube Transcript IO title: "${title}"`);
          return title;
        }
        
        console.log('❌ No title found in API response');
        console.log('Available fields:', Object.keys(videoData));
      }
      
      return null;
      
    } catch (error) {
      console.error('❌ Error fetching title from YouTube Transcript IO:', error.message);
      return null;
    }
  }

  getCachedTranscript(videoId) {
    return this.cache.get(videoId);
  }

  cacheTranscript(videoId, transcript) {
    this.cache.set(videoId, transcript);
  }

  async healthCheck() {
    try {
      if (!this.config.apiToken) {
        return {
          status: 'error',
          message: 'API token not configured',
          configured: false
        };
      }

      // Test with a simple request (without actually calling the API)
      return {
        status: 'ok',
        configured: true,
        baseUrl: this.config.baseUrl,
        rateLimited: this.rateLimitReset ? Date.now() < this.rateLimitReset : false
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        configured: !!this.config.apiToken
      };
    }
  }
}

module.exports = YouTubeTranscriptIOService;


