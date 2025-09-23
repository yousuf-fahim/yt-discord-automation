/**
 * VPS Transcript API Server
 * Standalone Express API for YouTube transcript extraction
 * Designed to run on DigitalOcean VPS with residential-class IP
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const CACHE_DIR = process.env.CACHE_DIR || './cache';

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Ensure cache directory exists
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create cache directory:', error);
  }
}

// YouTube Transcript Extraction Service
class TranscriptService {
  constructor() {
    this.pythonPath = 'python3';
    this.timeout = 30000;
  }

  async getTranscript(videoId, options = {}) {
    const languages = options.languages || ['en'];
    
    // Check cache first
    const cached = await this.getCachedTranscript(videoId);
    if (cached) {
      console.log(`📦 Using cached transcript for ${videoId}`);
      return cached;
    }

    // Extract with Python
    console.log(`🎯 Extracting transcript for ${videoId}`);
    const transcript = await this.extractWithPython(videoId, languages);
    
    if (transcript) {
      // Cache the result
      await this.cacheTranscript(videoId, transcript);
      console.log(`✅ Transcript extracted: ${transcript.length} characters`);
    }
    
    return transcript;
  }

  async extractWithPython(videoId, languages) {
    return new Promise((resolve, reject) => {
      const pythonScript = this.generatePythonScript(videoId, languages);
      
      const process = spawn(this.pythonPath, ['-c', pythonScript], {
        timeout: this.timeout
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
            reject(new Error(`Failed to parse response: ${parseError.message}`));
          }
        } else {
          reject(new Error(`Python process failed (code ${code}): ${errorOutput || 'Unknown error'}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Python execution error: ${error.message}`));
      });
    });
  }

  generatePythonScript(videoId, languages) {
    return `
import json
import sys
import traceback
from youtube_transcript_api import YouTubeTranscriptApi

try:
    # Get transcript list
    transcript_list = YouTubeTranscriptApi.list_transcripts("${videoId}")
    
    # Find best available transcript
    transcript = None
    languages = ${JSON.stringify(languages)}
    
    for lang in languages:
        try:
            transcript = transcript_list.find_transcript([lang])
            break
        except:
            continue
    
    # If no exact match, try auto-generated English
    if not transcript:
        try:
            transcript = transcript_list.find_generated_transcript(['en'])
        except:
            pass
    
    # If still no transcript, get the first available
    if not transcript:
        available_transcripts = list(transcript_list)
        if not available_transcripts:
            raise Exception("No transcripts available for this video")
        transcript = available_transcripts[0]
    
    # Fetch the transcript data
    transcript_data = transcript.fetch()
    
    # Convert to text
    text_content = " ".join([entry['text'] for entry in transcript_data])
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

except Exception as e:
    result = {
        "success": False,
        "error": str(e),
        "error_type": type(e).__name__,
        "video_id": "${videoId}"
    }
    print(json.dumps(result))
    sys.exit(1)
`.trim();
  }

  async getCachedTranscript(videoId) {
    try {
      const cacheFile = path.join(CACHE_DIR, `${videoId}_transcript.json`);
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
    try {
      const cacheFile = path.join(CACHE_DIR, `${videoId}_transcript.json`);
      const cacheData = {
        videoId,
        transcript,
        timestamp: Date.now()
      };
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('Cache write failed:', error);
    }
  }
}

// Initialize service
const transcriptService = new TranscriptService();

// Routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'VPS Transcript API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

app.get('/transcript/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { lang } = req.query;
  
  try {
    console.log(`📺 Transcript request for video: ${videoId}`);
    
    const options = {};
    if (lang) {
      options.languages = [lang, 'en']; // Fallback to English
    }
    
    const transcript = await transcriptService.getTranscript(videoId, options);
    
    if (transcript) {
      res.json({
        success: true,
        videoId,
        transcript,
        length: transcript.length,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No transcript found for this video',
        videoId
      });
    }
  } catch (error) {
    console.error(`❌ Transcript extraction failed for ${videoId}:`, error.message);
    
    res.status(500).json({
      success: false,
      error: error.message,
      videoId
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available: [
      'GET /health',
      'GET /transcript/:videoId',
      'GET /transcript/:videoId?lang=en'
    ]
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
async function startServer() {
  await ensureCacheDir();
  
  app.listen(PORT, () => {
    console.log(`🚀 VPS Transcript API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📺 Transcript API: http://localhost:${PORT}/transcript/:videoId`);
  });
}

startServer().catch(console.error);

module.exports = app;
