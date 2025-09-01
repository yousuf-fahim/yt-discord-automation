/**
 * Robust Multi-Strategy Transcript Service
 * Combines multiple extraction methods with cloud deployment optimizations
 * Based on Python reference implementation and improved error handling
 */

require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');

const execAsync = util.promisify(exec);

class RobustTranscriptService {
  constructor() {
    this.ytDlpCmd = null;
    this.isInitialized = false;
    
    // Configuration - initialize first
    this.config = {
      maxRetries: parseInt(process.env.MAX_TRANSCRIPT_RETRIES || '3'),
      retryDelay: parseInt(process.env.TRANSCRIPT_RETRY_DELAY || '5000'),
      timeout: process.env.DYNO ? 180000 : 60000, // 3min for Heroku, 1min local
      tempDir: process.env.DYNO ? '/tmp/transcript-temp' : path.join(process.cwd(), 'temp', 'transcripts'),
      cacheEnabled: process.env.CACHE_TRANSCRIPTS === 'true',
      userAgents: [
        'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0'
      ],
      playerClients: ['ios', 'tv_embedded', 'android_tv', 'mediaconnect', 'web_embedded']
    };
    
    // Initialize after config is set
    this.initPromise = this.initialize();
  }

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🔄 Initializing Robust Transcript Service...');
    
    // Create temp directory
    await this.ensureTempDirectory();
    
    // Find working yt-dlp command
    this.ytDlpCmd = await this.findWorkingYtDlp();
    
    this.isInitialized = true;
    console.log(`✅ Transcript service initialized with: ${this.ytDlpCmd || 'fallback methods only'}`);
  }

  async ensureTempDirectory() {
    try {
      await fs.mkdir(this.config.tempDir, { recursive: true, mode: 0o777 });
      console.log(`📁 Temp directory ready: ${this.config.tempDir}`);
    } catch (error) {
      console.error('❌ Failed to create temp directory:', error.message);
      throw error;
    }
  }

  async findWorkingYtDlp() {
    const isHeroku = !!process.env.DYNO;
    
    // Priority order: Heroku-optimized first, then general
    const ytDlpCandidates = isHeroku ? [
      'python3 -m yt_dlp',
      '/app/.heroku/python/bin/yt-dlp',
      'yt-dlp',
      '/usr/local/bin/yt-dlp'
    ] : [
      'yt-dlp',
      'python3 -m yt_dlp',
      '/usr/local/bin/yt-dlp',
      '/opt/homebrew/bin/yt-dlp'
    ];

    for (const candidate of ytDlpCandidates) {
      try {
        console.log(`🧪 Testing yt-dlp candidate: ${candidate}`);
        
        const { stdout } = await execAsync(`${candidate} --version`, { timeout: 10000 });
        console.log(`✅ Found working yt-dlp: ${candidate} (v${stdout.trim()})`);
        
        // Verify it can handle YouTube
        const testCmd = `${candidate} --no-download --get-title "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`;
        await execAsync(testCmd, { timeout: 15000 });
        
        return candidate;
      } catch (error) {
        console.log(`❌ ${candidate} failed: ${error.message}`);
      }
    }

    // Try to install yt-dlp as last resort
    if (isHeroku) {
      try {
        console.log('📥 Attempting to install yt-dlp on Heroku...');
        await execAsync('python3 -m pip install --user yt-dlp', { timeout: 60000 });
        const { stdout } = await execAsync('python3 -m yt_dlp --version');
        console.log(`✅ Successfully installed yt-dlp: v${stdout.trim()}`);
        return 'python3 -m yt_dlp';
      } catch (installError) {
        console.warn('⚠️ Failed to install yt-dlp:', installError.message);
      }
    }

    console.warn('⚠️ No working yt-dlp found, will use fallback methods');
    return null;
  }

  /**
   * Main transcript extraction method with multiple strategies
   */
  async getTranscript(videoId, options = {}) {
    await this.initPromise;
    
    const startTime = Date.now();
    console.log(`🎬 Starting transcript extraction for: ${videoId}`);

    // Validate video ID
    if (!this.isValidVideoId(videoId)) {
      throw new Error(`Invalid YouTube video ID: ${videoId}`);
    }

    // Check cache first
    if (this.config.cacheEnabled && !options.skipCache) {
      const cached = await this.getCachedTranscript(videoId);
      if (cached) {
        console.log(`💾 Using cached transcript for ${videoId}`);
        return cached;
      }
    }

    // Strategy 1: Advanced yt-dlp with anti-bot measures
    if (this.ytDlpCmd) {
      const ytDlpResult = await this.extractWithYtDlp(videoId);
      if (ytDlpResult) {
        await this.cacheTranscript(videoId, ytDlpResult);
        console.log(`✅ yt-dlp extraction completed in ${Date.now() - startTime}ms`);
        return ytDlpResult;
      }
    }

    // Strategy 2: YouTube Transcript API (npm package)
    const npmResult = await this.extractWithNpmPackage(videoId);
    if (npmResult) {
      await this.cacheTranscript(videoId, npmResult);
      console.log(`✅ npm package extraction completed in ${Date.now() - startTime}ms`);
      return npmResult;
    }

    // Strategy 3: Direct YouTube API scraping (like Python version)
    const directResult = await this.extractWithDirectScraping(videoId);
    if (directResult) {
      await this.cacheTranscript(videoId, directResult);
      console.log(`✅ direct scraping completed in ${Date.now() - startTime}ms`);
      return directResult;
    }

    // Strategy 4: Proxy-based extraction (if configured)
    if (process.env.PROXY_URL) {
      const proxyResult = await this.extractWithProxy(videoId);
      if (proxyResult) {
        await this.cacheTranscript(videoId, proxyResult);
        console.log(`✅ proxy extraction completed in ${Date.now() - startTime}ms`);
        return proxyResult;
      }
    }

    console.log(`❌ All transcript extraction methods failed for ${videoId}`);
    throw new Error(`No transcript available for video ${videoId}`);
  }

  /**
   * Advanced yt-dlp extraction with multiple client types and anti-bot measures
   */
  async extractWithYtDlp(videoId) {
    console.log('🚀 Attempting yt-dlp extraction...');
    
    const videoTempDir = path.join(this.config.tempDir, videoId);
    await fs.mkdir(videoTempDir, { recursive: true });

    // Multiple extraction strategies with different clients
    const strategies = [
      {
        name: 'iOS Client with Sleep',
        cmd: this.buildYtDlpCommand(videoId, videoTempDir, {
          playerClient: 'ios',
          userAgent: this.config.userAgents[0],
          sleepRequests: 3,
          sleepInterval: 2
        })
      },
      {
        name: 'TV Embedded with Proxy Headers',
        cmd: this.buildYtDlpCommand(videoId, videoTempDir, {
          playerClient: 'tv_embedded',
          userAgent: this.config.userAgents[1],
          sleepRequests: 5,
          additionalArgs: '--add-header "X-Forwarded-For:8.8.8.8"'
        })
      },
      {
        name: 'Android TV with Rate Limiting',
        cmd: this.buildYtDlpCommand(videoId, videoTempDir, {
          playerClient: 'android_tv',
          sleepRequests: 10,
          sleepInterval: 5
        })
      },
      {
        name: 'Web Embedded Fallback',
        cmd: this.buildYtDlpCommand(videoId, videoTempDir, {
          playerClient: 'web_embedded',
          userAgent: this.config.userAgents[3]
        })
      }
    ];

    for (const strategy of strategies) {
      try {
        console.log(`🔄 Trying strategy: ${strategy.name}`);
        
        const { stdout, stderr } = await execAsync(strategy.cmd, {
          timeout: this.config.timeout,
          maxBuffer: 1024 * 1024 * 10,
          env: this.getExecutionEnvironment()
        });

        if (stderr) console.log('yt-dlp stderr:', stderr);
        
        // Look for subtitle files
        const transcript = await this.extractFromSrtFiles(videoTempDir, videoId);
        if (transcript) {
          await this.cleanupTempDir(videoTempDir);
          return transcript;
        }
        
      } catch (error) {
        console.log(`❌ Strategy ${strategy.name} failed:`, error.message);
        
        // Check for specific error types
        if (this.isUnrecoverableError(error.message)) {
          console.log('🛑 Unrecoverable error detected, skipping remaining yt-dlp strategies');
          break;
        }
      }
    }

    await this.cleanupTempDir(videoTempDir);
    return null;
  }

  buildYtDlpCommand(videoId, outputDir, options = {}) {
    const {
      playerClient = 'ios',
      userAgent,
      sleepRequests = 1,
      sleepInterval = 1,
      additionalArgs = ''
    } = options;

    const baseArgs = [
      `--cache-dir "${this.config.tempDir}"`,
      '--write-auto-sub',
      '--convert-subs srt',
      '--skip-download',
      '--no-playlist',
      '--ignore-config',
      `--sub-lang en`,
      `--extractor-args "youtube:player_client=${playerClient}"`,
      `--sleep-requests ${sleepRequests}`,
      `--sleep-interval ${sleepInterval}`,
      `--output "${outputDir}/%(title)s [%(id)s].%(ext)s"`
    ];

    if (userAgent) {
      baseArgs.push(`--user-agent "${userAgent}"`);
    }

    if (additionalArgs) {
      baseArgs.push(additionalArgs);
    }

    const url = `"https://www.youtube.com/watch?v=${videoId}"`;
    return `${this.ytDlpCmd} ${baseArgs.join(' ')} ${url}`;
  }

  /**
   * Extract using youtube-transcript npm package
   */
  async extractWithNpmPackage(videoId) {
    console.log('📦 Attempting npm package extraction...');
    
    try {
      const { YoutubeTranscript } = require('youtube-transcript');
      
      const transcriptData = await Promise.race([
        YoutubeTranscript.fetchTranscript(videoId, {
          lang: 'en',
          country: 'US'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('npm package timeout')), 30000)
        )
      ]);

      if (transcriptData && transcriptData.length > 0) {
        const text = transcriptData
          .map(item => item.text)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > 50) {
          console.log(`✅ npm package extraction successful (${text.length} chars)`);
          return text;
        }
      }
    } catch (error) {
      console.log('❌ npm package extraction failed:', error.message);
    }
    
    return null;
  }

  /**
   * Direct YouTube API scraping (inspired by Python implementation)
   */
  async extractWithDirectScraping(videoId) {
    console.log('🔍 Attempting direct scraping...');
    
    try {
      // Get video page HTML
      const videoPageData = await this.fetchWithRetry(`https://www.youtube.com/watch?v=${videoId}`);
      
      // Extract player response data
      const playerResponseMatch = videoPageData.match(/var ytInitialPlayerResponse = ({.+?});/);
      if (!playerResponseMatch) {
        throw new Error('Could not find player response data');
      }

      const playerResponse = JSON.parse(playerResponseMatch[1]);
      
      // Extract captions data
      const captionsData = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionsData || captionsData.length === 0) {
        throw new Error('No captions available');
      }

      // Find English captions
      const englishCaptions = captionsData.find(track => 
        track.languageCode === 'en' || track.languageCode === 'en-US'
      );

      if (!englishCaptions) {
        throw new Error('No English captions found');
      }

      // Fetch caption data
      const captionUrl = englishCaptions.baseUrl;
      const captionXml = await this.fetchWithRetry(captionUrl);
      
      // Parse XML and extract text
      const transcript = this.parseTranscriptXml(captionXml);
      
      if (transcript && transcript.length > 50) {
        console.log(`✅ Direct scraping successful (${transcript.length} chars)`);
        return transcript;
      }
      
    } catch (error) {
      console.log('❌ Direct scraping failed:', error.message);
    }
    
    return null;
  }

  /**
   * Proxy-based extraction for blocked environments
   */
  async extractWithProxy(videoId) {
    if (!process.env.PROXY_URL) return null;
    
    console.log('🌐 Attempting proxy extraction...');
    
    try {
      // Use proxy for yt-dlp if available
      const proxyCmd = `${this.ytDlpCmd} --proxy "${process.env.PROXY_URL}" --write-auto-sub --convert-subs srt --skip-download "https://www.youtube.com/watch?v=${videoId}"`;
      
      const { stdout } = await execAsync(proxyCmd, {
        timeout: this.config.timeout * 2,
        env: this.getExecutionEnvironment()
      });
      
      // Parse output for transcript
      // Implementation depends on proxy setup
      
    } catch (error) {
      console.log('❌ Proxy extraction failed:', error.message);
    }
    
    return null;
  }

  // Helper methods
  async extractFromSrtFiles(directory, videoId) {
    try {
      const files = await fs.readdir(directory);
      const srtFiles = files.filter(f => f.includes(videoId) && f.endsWith('.srt'));
      
      if (srtFiles.length === 0) return null;
      
      const srtContent = await fs.readFile(path.join(directory, srtFiles[0]), 'utf8');
      return this.cleanSrtContent(srtContent);
    } catch (error) {
      console.log('Error reading SRT files:', error.message);
      return null;
    }
  }

  cleanSrtContent(srtContent) {
    return srtContent
      .replace(/^\d+\n/gm, '')
      .replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/(\b\w+(?:\s+\w+){0,7}\b)\s+\1/g, '$1')
      .trim();
  }

  parseTranscriptXml(xmlData) {
    try {
      // Simple XML parsing for transcript
      const textMatches = xmlData.match(/<text[^>]*>(.*?)<\/text>/g);
      if (!textMatches) return null;
      
      return textMatches
        .map(match => {
          const textContent = match.replace(/<text[^>]*>/, '').replace(/<\/text>/, '');
          return textContent.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (error) {
      console.log('Error parsing transcript XML:', error.message);
      return null;
    }
  }

  async fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.httpGet(url);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }

  httpGet(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      
      const req = client.get(url, {
        headers: {
          'User-Agent': this.config.userAgents[0],
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });
      
      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.abort();
        reject(new Error('Request timeout'));
      });
    });
  }

  getExecutionEnvironment() {
    const isHeroku = !!process.env.DYNO;
    return {
      ...process.env,
      TMPDIR: this.config.tempDir,
      TEMP: this.config.tempDir,
      HOME: process.env.HOME || '/app',
      ...(isHeroku && {
        PATH: `/app/.heroku/python/bin:${process.env.PATH}`,
        PYTHONPATH: `/app/.heroku/python/lib/python${process.env.PYTHON_VERSION || '3.11'}/site-packages`,
        LD_LIBRARY_PATH: '/app/.heroku/python/lib'
      })
    };
  }

  isValidVideoId(videoId) {
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  }

  isUnrecoverableError(errorMessage) {
    const unrecoverableErrors = [
      'Video unavailable',
      'Private video',
      'This live event will begin in',
      'Video has been removed',
      'Account has been suspended'
    ];
    
    return unrecoverableErrors.some(error => errorMessage.includes(error));
  }

  async getCachedTranscript(videoId) {
    if (!this.config.cacheEnabled) return null;
    
    try {
      const { getTranscriptFromCache } = require('../utils/cache');
      return await getTranscriptFromCache(videoId);
    } catch (error) {
      console.log('Cache read error:', error.message);
      return null;
    }
  }

  async cacheTranscript(videoId, transcript) {
    if (!this.config.cacheEnabled) return;
    
    try {
      const { saveTranscript } = require('../utils/cache');
      await saveTranscript(videoId, transcript);
    } catch (error) {
      console.log('Cache write error:', error.message);
    }
  }

  async cleanupTempDir(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (error) {
      console.log('Cleanup error:', error.message);
    }
  }

  // Health check method
  async healthCheck() {
    try {
      await this.initPromise;
      
      return {
        status: 'healthy',
        ytDlpAvailable: !!this.ytDlpCmd,
        ytDlpCommand: this.ytDlpCmd || 'not available',
        tempDirWritable: await this.checkTempDirWritable(),
        strategies: ['yt-dlp', 'npm-package', 'direct-scraping', 'proxy'].filter(strategy => {
          switch (strategy) {
            case 'yt-dlp': return !!this.ytDlpCmd;
            case 'proxy': return !!process.env.PROXY_URL;
            default: return true;
          }
        })
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkTempDirWritable() {
    try {
      const testFile = path.join(this.config.tempDir, 'test-write');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
const robustTranscriptService = new RobustTranscriptService();

// Legacy compatibility
async function getTranscript(videoId, options = {}) {
  return robustTranscriptService.getTranscript(videoId, options);
}

module.exports = {
  RobustTranscriptService,
  robustTranscriptService,
  getTranscript
};
