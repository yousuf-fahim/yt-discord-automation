/**
 * YouTube Transcript API Service
 * Uses the free youtube-transcript-api Python library with Node.js integration
 * Fallback service for local development (blocked on cloud IPs)
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class YouTubeTranscriptApiService {
  constructor(config = {}) {
    this.config = {
      cacheEnabled: config.cacheEnabled !== false,
      cacheDir: config.cacheDir || path.join(process.cwd(), 'cache'),
      pythonPath: config.pythonPath || 'python3',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      ...config
    };

    this.initPromise = this.initialize();
  }

  async initialize() {
    try {
      // Ensure cache directory exists
      if (this.config.cacheEnabled) {
        await fs.mkdir(this.config.cacheDir, { recursive: true });
      }

      // Check if youtube-transcript-api is installed
      await this.checkPythonDependency();
      
      console.log('✅ YouTube Transcript API service initialized');
    } catch (error) {
      console.error('❌ YouTube Transcript API initialization failed:', error.message);
      throw error;
    }
  }

  async checkPythonDependency() {
    return new Promise((resolve, reject) => {
      const pythonCode = `
import sys
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    print("DEPENDENCY_OK")
    print(f"Python version: {sys.version}")
except ImportError as e:
    print(f"DEPENDENCY_MISSING: {e}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
`;

      const process = spawn(this.config.pythonPath, ['-c', pythonCode]);
      let output = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0 && output.includes('DEPENDENCY_OK')) {
          resolve();
        } else {
          reject(new Error('youtube-transcript-api not installed. Run: pip install youtube-transcript-api'));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Python execution failed: ${error.message}`));
      });
    });
  }

  async getTranscript(videoId, options = {}) {
    await this.initPromise;

    // Check cache first
    if (this.config.cacheEnabled) {
      const cached = await this.getCachedTranscript(videoId);
      if (cached) {
        console.log(`📦 Using cached transcript for ${videoId}`);
        return cached;
      }
    }

    let lastError = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        console.log(`🎯 Extracting transcript for ${videoId} (attempt ${attempt}/${this.config.retryAttempts})`);
        
        const transcript = await this.extractTranscriptWithPython(videoId, options);
        
        if (transcript) {
          // Cache the result
          if (this.config.cacheEnabled) {
            await this.cacheTranscript(videoId, transcript);
          }
          
          console.log(`✅ Transcript extracted successfully: ${transcript.length} characters`);
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

    throw lastError || new Error(`Failed to extract transcript after ${this.config.retryAttempts} attempts`);
  }

  async extractTranscriptWithPython(videoId, options = {}) {
    return new Promise((resolve, reject) => {
      const pythonCode = this.generatePythonScript(videoId, options);
      
      const process = spawn(this.config.pythonPath, ['-c', pythonCode], {
        timeout: this.config.timeout
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            if (result.success) {
              resolve(result.transcript);
            } else {
              reject(new Error(result.error || 'Unknown extraction error'));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse transcript response: ${parseError.message}`));
          }
        } else {
          // Try to parse error output as JSON first
          try {
            const errorResult = JSON.parse(output);
            if (errorResult.error_type === 'RequestBlocked') {
              reject(new Error(`YouTube blocked request: ${errorResult.details || errorResult.error}`));
            } else {
              reject(new Error(`${errorResult.error_type || 'Python Error'}: ${errorResult.error}`));
            }
          } catch (parseError) {
            // Fallback to original error handling
            reject(new Error(`Python process failed (code ${code}): ${errorOutput || output || 'Unknown error'}`));
          }
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Python execution error: ${error.message}`));
      });
    });
  }

  generatePythonScript(videoId, options = {}) {
    const languages = options.languages || ['en'];
    
    return `
import json
import sys
import traceback
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import RequestBlocked, VideoUnavailable, TranscriptsDisabled, NoTranscriptFound

try:
    # Create API instance (local only - cloud IPs are blocked)
    api = YouTubeTranscriptApi()
    
    # Get transcript list
    transcript_list = api.list("${videoId}")
    
    # Find best available transcript
    try:
        transcript = transcript_list.find_transcript(${JSON.stringify(languages)})
    except:
        # Fallback to any available transcript
        available_transcripts = list(transcript_list)
        if not available_transcripts:
            raise Exception("No transcripts available for this video")
        transcript = available_transcripts[0]
    
    # Fetch the transcript data
    transcript_data = transcript.fetch()
    
    # Convert to text - fix the syntax
    text_content = " ".join([entry['text'] for entry in transcript_data])
    
    # Clean up text
    text_content = text_content.replace("\\n", " ").strip()
    
    result = {
        "success": True,
        "transcript": text_content,
        "language": transcript.language,
        "language_code": transcript.language_code,
        "is_generated": transcript.is_generated,
        "length": len(text_content)
    }
    
    print(json.dumps(result))

except RequestBlocked as e:
    result = {
        "success": False,
        "error": "YouTube blocked request from cloud provider IP",
        "error_type": "RequestBlocked",
        "details": "YouTube blocks requests from cloud providers. This service only works locally.",
        "traceback": traceback.format_exc(),
        "video_id": "${videoId}"
    }
    print(json.dumps(result))
    sys.exit(1)
except (VideoUnavailable, TranscriptsDisabled, NoTranscriptFound) as e:
    result = {
        "success": False,
        "error": str(e),
        "error_type": type(e).__name__,
        "traceback": traceback.format_exc(),
        "video_id": "${videoId}"
    }
    print(json.dumps(result))
    sys.exit(1)
except Exception as e:
    result = {
        "success": False,
        "error": str(e),
        "error_type": type(e).__name__,
        "traceback": traceback.format_exc(),
        "video_id": "${videoId}"
    }
    print(json.dumps(result))
    sys.exit(1)
`;
  }

  async getCachedTranscript(videoId) {
    if (!this.config.cacheEnabled) return null;

    try {
      const cacheFile = path.join(this.config.cacheDir, `${videoId}_transcript.json`);
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
      const cacheFile = path.join(this.config.cacheDir, `${videoId}_transcript.json`);
      const cacheData = {
        videoId,
        transcript,
        timestamp: Date.now(),
        length: transcript.length
      };
      
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('Cache write error:', error.message);
    }
  }

  async healthCheck() {
    try {
      await this.initPromise;
      await this.checkPythonDependency();
      
      return {
        status: 'healthy',
        service: 'YouTube Transcript API',
        python_path: this.config.pythonPath,
        cache_enabled: this.config.cacheEnabled,
        note: 'Local development only - blocked on cloud IPs',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'YouTube Transcript API',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async installDependency() {
    return new Promise((resolve, reject) => {
      console.log('📦 Installing youtube-transcript-api...');
      
      const process = spawn('pip', ['install', 'youtube-transcript-api'], {
        stdio: 'inherit'
      });

      process.on('close', (code) => {
        if (code === 0) {
          console.log('✅ youtube-transcript-api installed successfully');
          resolve();
        } else {
          reject(new Error(`Failed to install youtube-transcript-api (exit code: ${code})`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Installation failed: ${error.message}`));
      });
    });
  }
}

module.exports = YouTubeTranscriptApiService;
