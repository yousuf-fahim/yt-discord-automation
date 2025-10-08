/**
 * RapidAPI YouTube Transcript Service
 * Integrates with RapidAPI YouTube transcript services
 */

const fs = require('fs').promises;
const path = require('path');

class RapidApiTranscriptService {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.RAPIDAPI_KEY,
      baseUrl: config.baseUrl || 'https://youtube-transcript2.p.rapidapi.com',
      timeout: config.timeout || 30000,
      cacheEnabled: config.cacheEnabled !== false,
      cacheDir: config.cacheDir || path.join(process.cwd(), 'cache'),
      retryAttempts: config.retryAttempts || 3,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('RapidAPI key is required. Set RAPIDAPI_KEY environment variable.');
    }
  }

  async getTranscript(videoId, options = {}) {
    if (!videoId) {
      throw new Error('Video ID is required');
    }

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = await this.getCachedTranscript(videoId);
      if (cached) {
        console.log(`📦 Using cached transcript for ${videoId}`);
        return cached;
      }
    }

    console.log(`🎯 Fetching transcript from RapidAPI for ${videoId}`);

    let lastError = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🎯 RapidAPI attempt ${attempt}/${this.config.retryAttempts}`);
        
        const transcript = await this.fetchFromRapidAPI(videoId, options);
        
        if (transcript) {
          // Cache the result
          if (this.config.cacheEnabled) {
            await this.cacheTranscript(videoId, transcript);
          }
          
          console.log(`✅ Transcript fetched successfully: ${transcript.length} characters`);
          return transcript;
        }
        
      } catch (error) {
        lastError = error;
        console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.config.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to fetch transcript after ${this.config.retryAttempts} attempts`);
  }

  async fetchFromRapidAPI(videoId, options = {}) {
    const url = `${this.config.baseUrl}/transcript`;
    
    const requestOptions = {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': this.config.apiKey,
        'X-RapidAPI-Host': 'youtube-transcript2.p.rapidapi.com',
        'Accept': 'application/json'
      }
    };

    // Add video ID as query parameter
    const searchParams = new URLSearchParams({
      video_id: videoId,
      lang: options.language || 'en'
    });

    const fullUrl = `${url}?${searchParams.toString()}`;

    const response = await fetch(fullUrl, requestOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`RapidAPI request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`RapidAPI error: ${data.error}`);
    }

    // Process the transcript data
    if (data.transcript && Array.isArray(data.transcript)) {
      return data.transcript.map(item => item.text).join(' ').trim();
    } else if (data.text) {
      return data.text.trim();
    } else if (typeof data === 'string') {
      return data.trim();
    } else {
      throw new Error('Unexpected response format from RapidAPI');
    }
  }

  async getCachedTranscript(videoId) {
    if (!this.config.cacheEnabled) return null;

    try {
      const cacheFile = path.join(this.config.cacheDir, `${videoId}_rapidapi_transcript.json`);
      const data = await fs.readFile(cacheFile, 'utf8');
      const cached = JSON.parse(data);
      
      // Check if cache is still valid (24 hours)
      const cacheAge = Date.now() - cached.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge < maxAge) {
        return cached.transcript;
      } else {
        // Remove expired cache
        await fs.unlink(cacheFile).catch(() => {});
        return null;
      }
    } catch (error) {
      return null;
    }
  }

  async cacheTranscript(videoId, transcript) {
    if (!this.config.cacheEnabled) return;

    try {
      const cacheDir = this.config.cacheDir;
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cacheFile = path.join(cacheDir, `transcription_${videoId}_rapidapi.json`);
      const cacheData = {
        videoId,
        transcript,
        timestamp: Date.now(),
        service: 'rapidapi'
      };
      
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.warn(`Failed to cache transcript: ${error.message}`);
    }
  }

  async healthCheck() {
    try {
      // Test with a simple request (you might need to adjust this based on the actual API)
      const testUrl = `${this.config.baseUrl}/health`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'X-RapidAPI-Key': this.config.apiKey,
          'X-RapidAPI-Host': 'youtube-transcript2.p.rapidapi.com'
        },
        timeout: 5000
      }).catch(() => null);

      return {
        status: this.config.apiKey ? 'healthy' : 'missing_api_key',
        service: 'RapidAPI YouTube Transcript',
        api_key_configured: !!this.config.apiKey,
        cache_enabled: this.config.cacheEnabled,
        base_url: this.config.baseUrl,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        service: 'RapidAPI YouTube Transcript',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = RapidApiTranscriptService;
