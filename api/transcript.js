require('dotenv').config();
const { spawn } = require('child_process');

/**
 * Simple YouTube Transcript Service using youtube-transcript-api
 * Minimal version for testing - no cache dependencies
 */

class SimpleTranscriptService {
  constructor() {
    this.pythonPath = 'python3';
  }

  async getTranscriptText(videoId) {
    console.log(`🎯 Getting transcript for video: ${videoId}`);
    
    try {
      const pythonScript = `
import json
from youtube_transcript_api import YouTubeTranscriptApi

try:
    transcript = YouTubeTranscriptApi.get_transcript('${videoId}')
    full_text = ' '.join([entry['text'] for entry in transcript])
    result = {
        'success': True,
        'transcript': full_text,
        'segments': len(transcript)
    }
    print(json.dumps(result))
except Exception as e:
    result = {
        'success': False,
        'error': str(e)
    }
    print(json.dumps(result))
`;

      const result = await this.runPythonScript(pythonScript);
      
      if (result.success) {
        console.log(`✅ Transcript extracted successfully: ${result.segments} segments, ${result.transcript.length} characters`);
        return result.transcript;
      } else {
        console.log(`❌ Transcript extraction failed: ${result.error}`);
        return null;
      }
      
    } catch (error) {
      console.error('Error in getTranscript:', error);
      return null;
    }
  }

  runPythonScript(script) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(this.pythonPath, ['-c', script]);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (parseError) {
            reject(new Error(`Failed to parse Python output: ${parseError.message}\nOutput: ${stdout}`));
          }
        } else {
          reject(new Error(`Python script failed with code ${code}\nStderr: ${stderr}\nStdout: ${stdout}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python process: ${error.message}`));
      });
    });
  }
}

const transcriptService = new SimpleTranscriptService();

async function getTranscript(videoId) {
  console.log(`Getting transcript for video ID: ${videoId}`);
  return await transcriptService.getTranscriptText(videoId);
}

module.exports = {
  getTranscript
};
