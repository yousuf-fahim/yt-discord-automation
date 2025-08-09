require('dotenv').config();
const puppeteer = require('puppeteer');
const { getYouTubeUrl, isYouTubeShort, isYouTubeLive } = require('../utils/youtube');
const { saveTranscript, getTranscriptFromCache } = require('../utils/cache');

// Import YouTube Transcript API
const { YoutubeTranscript } = require('youtube-transcript');

// Configuration
const CACHE_TRANSCRIPTS = process.env.CACHE_TRANSCRIPTS === 'true';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const MAX_RETRIES = 2;
const RETRY_DELAY = 3000; // 3 seconds

async function launchBrowser() {
  const commonArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-features=IsolateOrigins,site-per-process'
  ];

  // On Heroku, use the installed Chrome from buildpack
  const opts = { 
    headless: true, 
    executablePath: process.env.CHROME_BIN || '/app/.chrome-for-testing/chrome-linux64/chrome',
    args: commonArgs 
  };

      return await puppeteer.launch(opts);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// YouTube API transcript extraction using youtube-transcript package
async function getTranscriptFromYouTube(videoId) {
  console.log('Trying YouTube Transcript API...');
  try {
    // Try multiple approaches with different language options
    const languageOptions = [
      undefined, // Default (auto-detect)
      { lang: 'en' }, // English
      { lang: 'en', country: 'US' }, // US English
      { lang: 'en', country: 'GB' }, // UK English
      { lang: 'auto' } // Auto-generated
    ];
    
    // Try each language option
    for (const options of languageOptions) {
      try {
        const optionsDesc = options ? 
          `with options ${JSON.stringify(options)}` : 
          'with default options';
        console.log(`Trying YouTube Transcript API ${optionsDesc}...`);
        
        const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, options);
        
      if (Array.isArray(transcriptItems) && transcriptItems.length > 0) {
        // Format the transcript into a readable text
        const sentences = [];
        let currentSentence = '';
        
        // Process transcript items into sentences
        for (const item of transcriptItems) {
          const text = item.text.trim();
          if (!text) continue;
          
          if (text.endsWith('.') || text.endsWith('!') || text.endsWith('?')) {
            // Complete sentence
            currentSentence += (currentSentence ? ' ' : '') + text;
            sentences.push(currentSentence);
            currentSentence = '';
          } else {
            // Part of a sentence
            currentSentence += (currentSentence ? ' ' : '') + text;
          }
        }
        
        // Add any remaining text
        if (currentSentence) {
          sentences.push(currentSentence);
        }
        
        const formattedTranscript = sentences.join('. ').replace(/\.\./g, '.');
        console.log(`Successfully extracted transcript with YouTube API (${formattedTranscript.length} chars)`);
        return formattedTranscript;
      } else {
          console.log(`YouTube API ${optionsDesc} returned no transcript items`);
        }
      } catch (error) {
        console.log(`YouTube API attempt ${optionsDesc} failed:`, error?.message || error);
        // Continue to next option
      }
    }
    
    // If we get here, all language options failed
    console.log('All YouTube API language options failed');
  } catch (error) {
    console.error('All YouTube Transcript API methods failed:', error?.message || error);
  }
  return null;
}

/**
 * Extract transcript directly from YouTube by accessing the transcript button
 * @param {string} videoId YouTube video ID
 * @returns {Promise<string|null>} Transcript text or null if not found
 */
async function getTranscriptDirectFromYouTube(videoId) {
  console.log('Trying direct YouTube transcript extraction...');
  let browser = null;
  
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Go to YouTube video page
    const youtubeUrl = getYouTubeUrl(videoId);
    console.log(`Navigating to YouTube video: ${youtubeUrl}`);
    
    await page.goto(youtubeUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Wait for video player to load
    await page.waitForSelector('#movie_player', { timeout: 15000 });
    
    // Try to directly access the transcript URL
    const transcriptUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en`;
    console.log('Trying direct transcript URL:', transcriptUrl);
    
    const transcriptResponse = await page.goto(transcriptUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    if (transcriptResponse.ok()) {
      const content = await transcriptResponse.text();
      if (content.includes('<transcript>')) {
        // Parse XML transcript
        const lines = content.match(/<text[^>]*>(.*?)<\/text>/g) || [];
        const transcript = lines
          .map(line => {
            const text = line.replace(/<[^>]+>/g, '').trim();
            return text ? text.replace(/&#39;/g, "'").replace(/&quot;/g, '"') : '';
          })
          .filter(text => text)
          .join('\n');
        
        if (transcript.length > 100) {
          console.log(`Got transcript from direct API (${transcript.length} chars)`);
          return transcript;
        }
      }
    }
    
    // If direct API fails, try UI extraction
    await page.goto(youtubeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });
    
    // Look for transcript in the page
    console.log('Looking for transcript in page');
        const transcriptSelectors = [
      'ytd-transcript-body-renderer',
      'ytd-transcript-segment-list-renderer',
      '#segments-container',
      '[data-purpose="transcript-cue"]'
    ];
    
    let transcriptText = '';
        for (const selector of transcriptSelectors) {
          try {
        const elements = await page.$$(selector);
        if (elements && elements.length > 0) {
          console.log(`Found ${elements.length} transcript elements with selector: ${selector}`);
          
          // Extract text from all elements
          for (const element of elements) {
            const text = await page.evaluate(el => el.innerText, element);
            if (text && text.trim()) {
              transcriptText += text.trim() + '\n';
            }
          }
          
          if (transcriptText.length > 100) {
            console.log(`Successfully extracted transcript directly from YouTube (${transcriptText.length} chars)`);
            return transcriptText;
          }
        }
      } catch (e) {
        console.log(`Error with selector ${selector}:`, e.message);
      }
    }
    
    console.log('Direct YouTube transcript extraction failed');
    return null;
  } catch (error) {
    console.error('Error in direct YouTube transcript extraction:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Browser closed after direct YouTube extraction');
    }
  }
}

async function getTranscript(videoId) {
  try {
    const youtubeUrl = getYouTubeUrl(videoId);
    
    // Check if this is a YouTube Short or Live video
    if (isYouTubeShort(youtubeUrl)) {
      console.log(`Video ${videoId} is a YouTube Short, skipping transcript extraction`);
      return null;
    }
    
    if (await isYouTubeLive(youtubeUrl)) {
      console.log(`Video ${videoId} is a YouTube Live video, skipping transcript extraction`);
      return null;
    }

    // Check if we have a cached transcript
    if (CACHE_TRANSCRIPTS) {
      const cachedTranscript = await getTranscriptFromCache(videoId);
      if (cachedTranscript) {
        console.log(`Using cached transcript for video ${videoId}`);
        return cachedTranscript;
      }
    }

    let retries = 0;
    let lastError = null;

    while (retries < MAX_RETRIES) {
      try {
        console.log(`Transcript extraction attempt ${retries + 1}/${MAX_RETRIES}`);
        
        // Try YouTube Transcript API first (fastest method)
        console.log('Trying YouTube Transcript API...');
        const ytTranscript = await getTranscriptFromYouTube(videoId);
        if (ytTranscript) {
          console.log('YouTube Transcript API method succeeded');
          if (CACHE_TRANSCRIPTS) await saveTranscript(videoId, ytTranscript);
          return ytTranscript;
        }
        
        // Then try direct YouTube extraction
        console.log('YouTube API failed, trying direct YouTube extraction...');
        const directYouTubeTranscript = await getTranscriptDirectFromYouTube(videoId);
        if (directYouTubeTranscript) {
          console.log('Direct YouTube extraction succeeded');
          if (CACHE_TRANSCRIPTS) await saveTranscript(videoId, directYouTubeTranscript);
          return directYouTubeTranscript;
        }

        // If all methods fail, retry after delay
        retries++;
        if (retries < MAX_RETRIES) {
          console.log(`All methods failed on attempt ${retries}, retrying in ${RETRY_DELAY/1000} seconds...`);
          await sleep(RETRY_DELAY);
        }
      } catch (error) {
        lastError = error;
        retries++;
        if (retries < MAX_RETRIES) {
          console.log(`Error on attempt ${retries}: ${error?.message || error}`);
          console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
          await sleep(RETRY_DELAY);
        }
      }
    }
    
    console.error('Error getting transcript after all retries:', lastError);
    return null;
  } catch (error) {
    console.error('Error getting transcript:', error);
    return null;
  }
}

module.exports = {
  getTranscript
};