/**
 * VPS Transcript Client
 * Client service to connect Discord bot (Heroku) to VPS Transcript API (DigitalOcean)
 */

const https = require('https');
const http = require('http');

class VPSTranscriptClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.VPS_TRANSCRIPT_API_URL;
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    
    if (!this.baseUrl) {
      throw new Error('VPS_TRANSCRIPT_API_URL environment variable is required');
    }
    
    // Remove trailing slash
    this.baseUrl = this.baseUrl.replace(/\/$/, '');
    console.log(`🔗 VPS Transcript Client initialized: ${this.baseUrl}`);
  }

  async getTranscript(videoId, options = {}) {
    const languages = options.languages || ['en'];
    const url = `${this.baseUrl}/transcript/${videoId}?lang=${languages[0]}`;
    
    let lastError = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        console.log(`🎯 Requesting transcript from VPS (attempt ${attempt}/${this.retryAttempts}): ${videoId}`);
        
        const response = await this.makeRequest(url);
        
        if (response.success) {
          console.log(`✅ VPS transcript received: ${response.length} characters`);
          return response.transcript;
        } else {
          throw new Error(response.error || 'VPS API returned error');
        }
        
      } catch (error) {
        lastError = error;
        console.log(`❌ VPS attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < this.retryAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to get transcript from VPS after ${this.retryAttempts} attempts`);
  }

  async healthCheck() {
    try {
      const response = await this.makeRequest(`${this.baseUrl}/health`);
      return {
        status: 'healthy',
        service: 'VPS Transcript Client',
        vps_status: response.status || 'unknown',
        vps_uptime: response.uptime || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'VPS Transcript Client',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': 'yt-discord-automation/1.0.0',
          'Accept': 'application/json'
        }
      };

      const req = client.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(`VPS API error (${res.statusCode}): ${result.error || 'Unknown error'}`));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse VPS response: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`VPS request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('VPS request timeout'));
      });

      req.end();
    });
  }
}

module.exports = VPSTranscriptClient;
