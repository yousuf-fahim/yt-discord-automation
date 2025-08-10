require('dotenv').config();
const puppeteer = require('puppeteer');
const { getYouTubeUrl, isYouTubeShort, isYouTubeLive } = require('../utils/youtube');
const { saveTranscript, getTranscriptFromCache } = require('../utils/cache');
const { YoutubeTranscript } = require('youtube-transcript');

// Configuration
const CACHE_TRANSCRIPTS = process.env.CACHE_TRANSCRIPTS === 'true';
const MAX_RETRIES = parseInt(process.env.MAX_TRANSCRIPT_RETRIES || '3');
const RETRY_DELAY = parseInt(process.env.TRANSCRIPT_RETRY_DELAY || '5000');

/**
 * Launch browser with appropriate configuration
 */
async function launchBrowser() {
  const commonArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--disable-web-security'
  ];

  const opts = {
    headless: 'new',
    args: commonArgs,
    defaultViewport: { width: 1920, height: 1080 }
  };

  if (process.env.NODE_ENV === 'production' && process.env.CHROME_BIN) {
    opts.executablePath = process.env.CHROME_BIN;
  }

  return await puppeteer.launch(opts);
}

/**
 * Extract transcript using YouTube API
 */
async function getTranscriptFromYouTube(videoId) {
  const languageOptions = [
    undefined,
    { lang: 'en' },
    { lang: 'en', country: 'US' },
    { lang: 'auto' }
  ];
  
  for (const options of languageOptions) {
    try {
      const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, options);
      
      if (!Array.isArray(transcriptItems) || transcriptItems.length === 0) {
        continue;
      }

      const sentences = [];
      let currentSentence = '';
      
      for (const item of transcriptItems) {
        const text = item.text.trim();
        if (!text) continue;
        
        if (text.endsWith('.') || text.endsWith('!') || text.endsWith('?')) {
          currentSentence += (currentSentence ? ' ' : '') + text;
          sentences.push(currentSentence);
          currentSentence = '';
        } else {
          currentSentence += (currentSentence ? ' ' : '') + text;
        }
      }
      
      if (currentSentence) {
        sentences.push(currentSentence);
      }
      
      const transcript = sentences.join('. ').replace(/\.\./g, '.');
      if (transcript.length > 100) {
        console.log(`Successfully extracted transcript via API (${transcript.length} chars)`);
        return transcript;
      }
    } catch (error) {
      console.log(`API attempt failed:`, error?.message || error);
    }
  }
  
  return null;
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
      
      browser = await launchBrowser();
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

    // Try YouTube API first
    console.log('Attempting YouTube API extraction...');
    const apiTranscript = await getTranscriptFromYouTube(videoId);
    if (apiTranscript) {
      if (CACHE_TRANSCRIPTS) {
        await saveTranscript(videoId, apiTranscript);
      }
      return apiTranscript;
    }

    // Fallback to direct scraping
    console.log('API failed, attempting direct extraction...');
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
