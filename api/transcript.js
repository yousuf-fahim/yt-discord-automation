require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');
const { getYouTubeUrl, isYouTubeShort, isYouTubeLive } = require('../utils/youtube');
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

// Helper function to verify video exists
async function verifyVideoExists(videoId) {
  try {
    const { stdout, stderr } = await execAsync(`yt-dlp --no-download --get-title "https://www.youtube.com/watch?v=${videoId}" 2>&1`);
    if (stderr && stderr.includes('Video unavailable')) {
      console.log('Video is explicitly marked as unavailable');
      return false;
    }
    return !!stdout;
  } catch (error) {
    if (error.message?.includes('Video unavailable')) {
      console.log('Video is explicitly marked as unavailable');
    } else if (error.message?.includes('Private video')) {
      console.log('Video is private');
    } else if (error.message?.includes('This live event will begin in')) {
      console.log('Video is an upcoming livestream');
    } else {
      console.log('Video verification failed:', error.message || error);
    }
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
    console.log(`Starting yt-dlp transcript extraction for video ${videoId}`);
    console.log('Memory usage:', process.memoryUsage());
    
    // Verify video exists first
    if (!await verifyVideoExists(videoId)) {
      console.log('Video is unavailable');
      return null;
    }
    
    // Log system information
    console.log('Platform:', process.platform);
    console.log('Architecture:', process.arch);
    console.log('Node version:', process.version);

    // Set up temp directory for this extraction
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
          
          // Clean up the transcript
          const cleaned = `Video Title: ${videoId}\n\n` + srtContent
            // Remove SRT timestamps and numbers
            .replace(/^\d+\n/gm, '') // Remove subtitle numbers
            .replace(/\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}\n/g, '') // Remove SRT timestamps
            .replace(/^(?:\d{1,2}:)?\d{1,2}:\d{2}\n/gm, '') // Remove any remaining timestamps
            .replace(/<.*?>/g, '')   // Remove HTML-like tags
            .replace(/\n+/g, ' ')    // Replace newlines with spaces
            .replace(/\s+/g, ' ')    // Normalize spaces
            .replace(/\d{1,2}:\d{2}\s+/g, '') // Remove any remaining timestamp-like patterns
            .replace(/(\w+(?:\s+\w+){0,7})\s+\1/g, '$1') // Remove repeated phrases
            .trim();
            
          // Clean up the generated files
          for (const file of srtFiles) {
            await fs.unlink(path.join(videoTempDir, file)).catch(() => {});
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
          '--window-size=1280,720',
          '--disable-software-rasterizer',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--disable-background-networking',
          '--memory-pressure-off',
          '--js-flags=--max-old-space-size=256',
          '--single-process',
          '--disable-client-side-phishing-detection',
          '--disable-features=site-per-process,TranslateUI,IsolateOrigins,AutomationControlled',
          '--disable-remote-fonts',
          '--disable-web-security',
          '--no-first-run',
          '--no-default-browser-check',
          '--deterministic-fetch',
          '--disk-cache-size=0'
        ]
      });
      
      const page = await browser.newPage();
      
      // Set up error handling
      page.on('error', err => {
        console.error('Page error:', err);
      });
      
      page.on('pageerror', err => {
        console.error('Page error:', err);
      });
      
      // Enable request interception to block unnecessary resources
      await page.setRequestInterception(true);
      
      // Clean up event listeners on page close
      const requestHandler = (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media', 'other'].includes(resourceType)) {
          req.abort().catch(err => console.error('Error aborting request:', err));
        } else {
          req.continue().catch(err => console.error('Error continuing request:', err));
        }
      };
      
      page.on('request', requestHandler);
      
      // Set up cleanup
      page.once('close', () => {
        page.removeListener('request', requestHandler);
      });
      
      // Set user agent to look more like a real browser
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
      
      // Remove webdriver flag and add stealth features
      await page.evaluateOnNewDocument(() => {
        delete Object.getPrototypeOf(navigator).webdriver;
        window.chrome = {
          runtime: {},
          loadTimes: () => {},
          csi: () => {},
          app: {},
          webstore: {},
        };
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
      });
      
      // Set extra headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/',
      });
      
      const url = getYouTubeUrl(videoId);
      await page.goto(url, { 
        waitUntil: 'networkidle0', 
        timeout: 60000 // Increase timeout
      });
      
      const selectors = [
        'ytd-transcript-body-renderer',
        'ytd-transcript-segment-list-renderer',
        '#segments-container'
      ];

      // Wait for JavaScript to load
      await page.waitForFunction(() => typeof window.ytInitialPlayerResponse !== 'undefined', { timeout: 10000 });
      
      // Click the transcript button if it exists
      try {
        // Look for and click the "Show transcript" button
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const transcriptButton = buttons.find(button => button.innerText.includes('Show transcript'));
          if (transcriptButton) {
            transcriptButton.click();
          }
        });
        
        // Give time for transcript to load
        await new Promise(r => setTimeout(r, 2000));
      } catch (error) {
        console.log('Could not find/click transcript button:', error?.message);
      }
      
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 10000 });
          // Try to extract text in various ways
          const text = await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (!element) return null;

            // Function to clean up text and remove timestamps
            const cleanText = (text) => {
              return `Video Title: ${videoId}\n\n` + text
                .replace(/^\d+:\d{2}$/gm, '') // Remove MM:SS timestamps
                .replace(/^\d{1,2}:\d{2}:\d{2}$/gm, '') // Remove HH:MM:SS timestamps
                .replace(/^(?:\d{1,2}:)?\d{1,2}:\d{2}\s*/gm, '') // Remove leading timestamps
                .replace(/\s+/g, ' ')
                .replace(/(\w+(?:\s+\w+){0,7})\s+\1/g, '$1') // Remove repeated phrases
                .trim();
            };

            // Try different ways to get text
            const directText = cleanText(element.innerText);
            
            // Get text from transcript segments, excluding timestamp elements
            const segments = Array.from(element.querySelectorAll('ytd-transcript-segment-renderer'));
            const segmentText = segments
              .map(seg => {
                const textContent = Array.from(seg.childNodes)
                  .filter(node => !node.matches?.('ytd-transcript-segment-timestamp-renderer'))
                  .map(node => node.textContent)
                  .join(' ');
                return cleanText(textContent);
              })
              .join(' ');

            return directText || segmentText;
          }, selector);
          
          if (text && text.length > 100) {
            console.log(`Successfully extracted transcript via scraping (${text.length} chars)`);
            return text;
          }
        } catch (error) {
          console.log(`Selector ${selector} failed:`, error?.message);
          continue;
        }
      }
      
      retryCount++;
    } catch (error) {
      console.error(`Scraping attempt ${retryCount + 1} failed:`, error?.message || error);
      retryCount++;
    } finally {
      try {
        if (browser) {
          // Force close all pages
          const pages = await browser.pages();
          await Promise.all(pages.map(page => page.close()));
          await browser.close();
        }
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
  
  // Log final attempt status
  console.log(`All ${MAX_RETRIES} attempts failed for video ${videoId}`);
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

    // Log environment info
    console.log('Process working directory:', process.cwd());
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Memory usage:', process.memoryUsage());
    console.log('Node version:', process.version);
    
    // Verify yt-dlp installation and version
    try {
      const { stdout: version } = await execAsync('yt-dlp --version');
      console.log('yt-dlp version:', version.trim());
    } catch (e) {
      console.error('Error getting yt-dlp version:', e);
      // Don't fail completely, try to continue
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
