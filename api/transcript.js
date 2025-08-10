require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { getYouTubeUrl, isYouTubeShort, isYouTubeLive } = require('../utils/youtube');
const { getYouTubeTitle } = require('../utils/youtube-title');
const { saveTranscript, getTranscriptFromCache } = require('../utils/cache');

const execAsync = util.promisify(exec);

// Check yt-dlp installation
console.log('Checking yt-dlp installation...');
execAsync('which yt-dlp')
  .then(({stdout}) => console.log('yt-dlp path:', stdout.trim()))
  .catch(err => console.error('Error finding yt-dlp:', err));

execAsync('yt-dlp --version')
  .then(({stdout}) => console.log('yt-dlp version:', stdout.trim()))
  .catch(err => console.error('Error getting yt-dlp version:', err));

// Create temp directory for yt-dlp cache
const TEMP_DIR = path.join(process.cwd(), 'temp');
console.log('Using temp directory:', TEMP_DIR);
fs.mkdir(TEMP_DIR, { recursive: true })
  .then(() => console.log('Successfully created temp directory'))
  .catch((err) => console.error('Error creating temp directory:', err));

// Configuration
const CACHE_TRANSCRIPTS = process.env.CACHE_TRANSCRIPTS === 'true';
const MAX_RETRIES = parseInt(process.env.MAX_TRANSCRIPT_RETRIES || '3');
const RETRY_DELAY = parseInt(process.env.TRANSCRIPT_RETRY_DELAY || '5000');

/**
 * Main transcript extraction function
 */
async function getTranscript(videoId) {
  try {
    const url = getYouTubeUrl(videoId);
    
    // Helper function to verify video exists
    async function verifyVideoExists(videoId) {
      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Verifying video ${videoId} (attempt ${attempt}/${maxRetries})`);
          
          const cmd = [
            'yt-dlp',
            '--no-download',
            '--get-title',
            '--verbose',
            '--ignore-config',
            '--no-playlist',
            '--no-cache-dir',
            '--extractor-args',
            'youtube:player_client=android',
            '--user-agent',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            `https://www.youtube.com/watch?v=${videoId}`
          ].join(' ');
          
          const { stdout, stderr } = await execAsync(cmd + ' 2>&1');
          
          if (stderr && stderr.includes('Video unavailable')) {
            console.log('Video is explicitly marked as unavailable');
            return false;
          }
          
          if (stdout) {
            console.log('Video title found:', stdout.trim());
            return true;
          }
          
          throw new Error('No output from yt-dlp');
        } catch (error) {
          const errorMsg = error.message || error;
          console.log(`Attempt ${attempt} failed:`, errorMsg);
          
          if (errorMsg.includes('Video unavailable')) {
            console.log('Video is explicitly marked as unavailable');
            return false;
          } else if (errorMsg.includes('Private video')) {
            console.log('Video is private');
            return false;
          } else if (errorMsg.includes('This live event will begin in')) {
            console.log('Video is an upcoming livestream');
            return false;
          }
          
          if (attempt < maxRetries) {
            console.log(`Waiting ${retryDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }
        }
      }
      
      console.log(`All ${maxRetries} verification attempts failed`);
      return false;
    }

    // Check video type
    if (isYouTubeShort(url)) {
      console.log(`Skipping YouTube Short: ${videoId}`);
      return null;
    }
    
    if (await isYouTubeLive(url)) {
      console.log(`Skipping Live video: ${videoId}`);
      return null;
    }

    // Check cache first
    if (CACHE_TRANSCRIPTS) {
      const cached = await getTranscriptFromCache(videoId);
      if (cached) {
        console.log(`Using cached transcript for ${videoId}`);
        return cached;
      }
    }

    // Log environment info
    console.log('Process working directory:', process.cwd());
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Memory usage:', process.memoryUsage());
    console.log('Node version:', process.version);
    
    // Verify video exists first
    if (!await verifyVideoExists(videoId)) {
      console.log('Video is unavailable');
      return null;
    }

    // Set up temp directory for extraction
    const videoTempDir = path.join(TEMP_DIR, videoId);
    await fs.mkdir(videoTempDir, { recursive: true });
    
    // First, try to get available subtitles in the temp directory
    const { stdout: subsInfo } = await execAsync(`yt-dlp --cache-dir "${TEMP_DIR}" --list-subs "https://www.youtube.com/watch?v=${videoId}"`);
    console.log('Available subtitles:', subsInfo);
    console.log('Current working directory:', process.cwd());
    console.log('Video temp directory:', videoTempDir);

    // Try different methods to get transcript
    const methods = [
      // Method 1: Try manual subtitles in English
      `yt-dlp --cache-dir "${TEMP_DIR}" --sub-lang en --write-sub --convert-subs srt --skip-download "https://www.youtube.com/watch?v=${videoId}"`,
      // Method 2: Try auto-generated subtitles in English
      `yt-dlp --cache-dir "${TEMP_DIR}" --sub-lang en --write-auto-sub --convert-subs srt --skip-download "https://www.youtube.com/watch?v=${videoId}"`,
      // Method 3: Try original language subtitles
      `yt-dlp --cache-dir "${TEMP_DIR}" --write-sub --convert-subs srt --skip-download "https://www.youtube.com/watch?v=${videoId}"`
    ];

    for (const cmd of methods) {
      try {
        // Execute yt-dlp command in the temp directory
        const { stdout, stderr } = await execAsync(cmd, { cwd: videoTempDir });
        console.log(`yt-dlp output for method:`, stdout);
        if (stderr) console.error(`yt-dlp stderr:`, stderr);
        
        // Look for generated subtitle files
        const files = await fs.readdir(videoTempDir);
        const srtFiles = files.filter(f => f.includes(videoId) && f.endsWith('.srt'));
        
        if (srtFiles.length > 0) {
          // Read the first found subtitle file using absolute path
          const srtContent = await fs.readFile(path.join(videoTempDir, srtFiles[0]), 'utf8');
          
          // Get video title
          const videoTitle = await getYouTubeTitle(videoId) || 'Unknown Title';
          
          // Clean up the transcript
          const cleaned = `Title: ${videoTitle}\n\n` + srtContent
            .replace(/^\d+\n/gm, '')  // Remove subtitle numbers
            .replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '')  // Remove SRT timestamps
            .replace(/^(?:\d{1,2}:)?\d{1,2}:\d{2}\n/gm, '')  // Remove any remaining timestamps
            .replace(/<[^>]*>/g, '')   // Remove all HTML-like tags
            .replace(/\[.*?\]/g, '')   // Remove content in square brackets like [Music]
            .replace(/\d{2}:\d{2}:\d{2}\.\d{3}/g, '')  // Remove precise timestamps
            .replace(/\n+/g, ' ')      // Replace newlines with spaces
            .replace(/\s+/g, ' ')      // Normalize spaces
            .replace(/\d{1,2}:\d{2}\s+/g, '')  // Remove any remaining timestamp-like patterns
            .replace(/(\b\w+(?:\s+\w+){0,7}\b)\s+\1/g, '$1')  // Remove repeated phrases
            .replace(/(.{10,50})\s+\1/g, '$1')  // Remove longer repeated segments
            .trim();
            
          // Clean up the generated files
          for (const file of srtFiles) {
            await fs.unlink(path.join(videoTempDir, file)).catch(() => {});
          }
          
          // Clean up temp directory
          await fs.rm(videoTempDir, { recursive: true, force: true }).catch(() => {});

          if (cleaned.length > 100) {
            console.log(`Successfully extracted transcript (${cleaned.length} chars)`);
            
            // Cache the transcript
            if (CACHE_TRANSCRIPTS) {
              await saveTranscript(videoId, cleaned);
            }
            
            return cleaned;
          }
        }
      } catch (methodError) {
        console.log(`Method failed:`, methodError?.message || methodError);
        continue;
      }
    }
    
    console.log('No transcripts found');
    return null;
  } catch (error) {
    console.error('Fatal error in transcript extraction:', error);
    return null;
  }
}

module.exports = { getTranscript };
