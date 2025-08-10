require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { getYouTubeUrl, isYouTubeShort, isYouTubeLive } = require('../utils/youtube');
const { saveTranscript, getTranscriptFromCache } = require('../utils/cache');

const execAsync = util.promisify(exec);

// Create temp directory for yt-dlp cache
const TEMP_DIR = path.join(process.cwd(), 'temp');
fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});

// Helper function to verify video exists
async function verifyVideoExists(videoId) {
  try {
    const { stdout } = await execAsync(`yt-dlp --no-download --get-title "https://www.youtube.com/watch?v=${videoId}"`);
    return !!stdout;
  } catch (error) {
    return false;
  }
}

// Configuration
const CACHE_TRANSCRIPTS = process.env.CACHE_TRANSCRIPTS === 'true';
const MAX_RETRIES = parseInt(process.env.MAX_TRANSCRIPT_RETRIES || '3');
const RETRY_DELAY = parseInt(process.env.TRANSCRIPT_RETRY_DELAY || '5000');

/**
 * Extract transcript using yt-dlp
 */
async function getTranscriptWithYtDlp(videoId) {
  try {
    // Verify video exists first
    if (!await verifyVideoExists(videoId)) {
      console.log('Video is unavailable');
      return null;
    }

    // Set up temp directory for this extraction
    const videoTempDir = path.join(TEMP_DIR, videoId);
    await fs.mkdir(videoTempDir, { recursive: true });
    process.chdir(videoTempDir);

    // First, try to get available subtitles
    const { stdout: subsInfo } = await execAsync(`yt-dlp --cache-dir "${TEMP_DIR}" --list-subs "https://www.youtube.com/watch?v=${videoId}"`);
    console.log('Available subtitles:', subsInfo);

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
        // Execute yt-dlp command
        await execAsync(cmd);
        
        // Look for generated subtitle files
        const files = await fs.readdir('.');
        const srtFiles = files.filter(f => f.includes(videoId) && f.endsWith('.srt'));
        
        if (srtFiles.length > 0) {
          // Read the first found subtitle file
          const srtContent = await fs.readFile(srtFiles[0], 'utf8');
          
          // Clean up the transcript
          const cleaned = srtContent
            .replace(/\d+\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '') // Remove SRT timestamps
            .replace(/<.*?>/g, '')   // Remove HTML-like tags
            .replace(/\n+/g, ' ')    // Replace newlines with spaces
            .replace(/\s+/g, ' ')    // Normalize spaces
            .trim();
            
          // Clean up the generated files
          for (const file of srtFiles) {
            await fs.unlink(file).catch(() => {});
          }
          
          // Clean up temp directory
          await fs.rm(videoTempDir, { recursive: true, force: true }).catch(() => {});

          if (cleaned.length > 100) {
            console.log(`Successfully extracted transcript via yt-dlp (${cleaned.length} chars)`);
            return cleaned;
          }
        }
      } catch (methodError) {
        console.log(`Method failed:`, methodError?.message || methodError);
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('yt-dlp extraction failed:', error?.message || error);
    return null;
  }
}

/**
 * Extract transcript by scraping YouTube page
 */
async function getTranscriptDirectFromYouTube(videoId) {
  let browser = null;
  let retryCount = 0;
  
  while (retryCount < MAX_RETRIES) {
    try {
      if (retryCount > 0) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * Math.pow(2, retryCount - 1))); // Exponential backoff
      }
      
      browser = await puppeteer.launch({
        headless: 'new',
        executablePath: process.env.CHROME_BIN || '/app/.chrome-for-testing/chrome-linux64/chrome',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });
      
      const page = await browser.newPage();
      const url = getYouTubeUrl(videoId);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const selectors = [
        'ytd-transcript-body-renderer',
        'ytd-transcript-segment-list-renderer',
        '#segments-container'
      ];

      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          const text = await page.$eval(selector, el => el.innerText);
          if (text && text.length > 100) {
            console.log(`Successfully extracted transcript via scraping (${text.length} chars)`);
            return text;
          }
        } catch (error) {
          continue;
        }
      }
      
      retryCount++;
    } catch (error) {
      console.error(`Scraping attempt ${retryCount + 1} failed:`, error?.message || error);
      retryCount++;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
  
  return null;
}

/**
 * Main transcript extraction function
 */
async function getTranscript(videoId) {
  try {
    const url = getYouTubeUrl(videoId);
    
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

    // Try yt-dlp first
    console.log('Attempting yt-dlp extraction...');
    const ytDlpTranscript = await getTranscriptWithYtDlp(videoId);
    if (ytDlpTranscript) {
      if (CACHE_TRANSCRIPTS) {
        await saveTranscript(videoId, ytDlpTranscript);
      }
      return ytDlpTranscript;
    }

    // Fallback to direct scraping if yt-dlp fails
    console.log('yt-dlp failed, attempting direct extraction...');
    const scrapedTranscript = await getTranscriptDirectFromYouTube(videoId);
    if (scrapedTranscript) {
      if (CACHE_TRANSCRIPTS) {
        await saveTranscript(videoId, scrapedTranscript);
      }
      return scrapedTranscript;
    }

    console.log('All extraction methods failed');
    return null;
  } catch (error) {
    console.error('Fatal error in transcript extraction:', error);
    return null;
  }
}

module.exports = {
  getTranscript
};
