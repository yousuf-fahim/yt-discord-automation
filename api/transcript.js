require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const { getYouTubeUrl, isYouTubeShort, isYouTubeLive } = require('../utils/youtube');
const { saveTranscript, getTranscriptFromCache } = require('../utils/cache');

// Import YouTube Transcript API
const { YoutubeTranscript } = require('youtube-transcript');

// Configuration
const CACHE_TRANSCRIPTS = process.env.CACHE_TRANSCRIPTS === 'true';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

function resolveChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && process.env.PUPPETEER_EXECUTABLE_PATH.trim()) {
    return process.env.PUPPETEER_EXECUTABLE_PATH.trim();
  }
  // Common macOS path
  const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  try {
    const fsSync = require('fs');
    if (fsSync.existsSync(macChrome)) return macChrome;
  } catch {}
  return undefined; // Let Puppeteer download/bundle decide
}

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
  const attempts = [
    { 
      headless: true, 
      executablePath: process.env.CHROME_BIN || '/app/.chrome-for-testing/chrome-linux64/chrome',
      args: commonArgs 
    }
  ];

  let lastError;
  for (const opts of attempts) {
    try {
      return await puppeteer.launch(opts);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
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
    
    // Try one more approach - direct fetch with different options
    try {
      console.log('Trying YouTube API with direct fetch approach...');
      
      // Try to get any available transcript
      const result = await fetch(`https://youtubetranscript.com/api/?v=${videoId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (result.ok) {
        const data = await result.json();
        if (data && data.transcript) {
          console.log(`Successfully got transcript from direct API (${data.transcript.length} chars)`);
          return data.transcript;
        }
      }
    } catch (directError) {
      console.log('Direct API approach failed:', directError?.message || directError);
    }
  } catch (error) {
    console.error('All YouTube Transcript API methods failed:', error?.message || error);
  }
  return null;
}

async function getTranscriptFromTactiq(videoId) {
  try {
    const youtubeUrl = getYouTubeUrl(videoId);
    console.log(`Getting transcript for video URL: ${youtubeUrl}`);
    
    // Use direct Tactiq web URL with video ID (more reliable)
    try {
      console.log('Accessing Tactiq website directly...');
      const encodedUrl = encodeURIComponent(youtubeUrl);
      const apiUrl = `https://tactiq.io/tools/youtube-transcript?yt=${encodedUrl}`;
      
      // Use node-fetch with timeout and custom headers
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-User': '?1',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        redirect: 'follow',
        timeout: 30000 // 30 seconds timeout
      });

      if (response.ok) {
        // We're accessing the HTML page, not JSON API
        const htmlContent = await response.text();
        console.log(`Received HTML response (${htmlContent.length} bytes)`);
        
        // Extract transcript from HTML content
        const transcriptMatch = htmlContent.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) ||
                               htmlContent.match(/<div class="transcript-container"[^>]*>([\s\S]*?)<\/div>/i) ||
                               htmlContent.match(/<div[^>]*data-testid="transcript"[^>]*>([\s\S]*?)<\/div>/i);
        
        if (transcriptMatch && transcriptMatch[1]) {
          const transcriptText = transcriptMatch[1]
            .replace(/<[^>]+>/g, '') // Remove any HTML tags
            .trim();
          
          if (transcriptText.length > 100) { // Ensure it's substantial
            console.log(`Successfully extracted transcript from Tactiq HTML (${transcriptText.length} chars)`);
            return transcriptText;
          } else {
            console.log('Extracted text too short, likely not a transcript');
          }
        } else {
          console.log('No transcript content found in HTML response');
        }
      } else {
        console.error(`Tactiq website request failed with status: ${response.status}`);
      }
    } catch (err) {
      console.error('Tactiq website approach failed:', err?.message || err);
    }
    
    // Fallback to direct API call
    try {
      console.log('Trying Tactiq direct API as fallback...');
      const apiUrl = `https://tactiq.io/api/youtube/transcript?videoId=${videoId}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://tactiq.io/tools/youtube-transcript',
          'Origin': 'https://tactiq.io'
        },
        timeout: 30000
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Tactiq API response received');
        
        if (Array.isArray(result) && result.length > 0) {
          let transcriptText = "";
          for (const segment of result) {
            if (segment.text) {
              transcriptText += segment.text + " ";
            }
          }
          
          if (transcriptText.trim().length > 100) {
            console.log(`Successfully got transcript from Tactiq API (${transcriptText.length} chars)`);
            return transcriptText.trim();
          } else {
            console.log('API returned text too short, likely not valid');
          }
        } else {
          console.log('API response not in expected format');
        }
      } else {
        console.error(`Tactiq API error: ${response.status}`);
      }
    } catch (apiErr) {
      console.error('Tactiq API fallback failed:', apiErr?.message || apiErr);
    }
  } catch (error) {
    console.error('All Tactiq approaches failed:', error);
  }
  return null;
}

async function getTranscriptFromBrowser(videoId) {
  console.log('Launching browser for transcript extraction...');
  let browser = null;
  
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // Set viewport to desktop size and modern user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Add headers to make the request more browser-like
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
    });
    
            // Try several approaches
        console.log('Trying different Tactiq URLs...');
        
        // List of URLs to try - updated with direct YouTube transcripts API
        const youtubeUrl = getYouTubeUrl(videoId);
        const encodedUrl = encodeURIComponent(youtubeUrl);
        const urlsToTry = [
          // Try direct YouTube URL first (sometimes works better)
          youtubeUrl,
          // Then try transcript services
          `https://tactiq.io/tools/youtube-transcript?yt=${encodedUrl}`,
          `https://tactiq.io/tools/run/youtube_transcript?yt=${encodedUrl}`,
          `https://tactiq.io/tools/youtube-transcript/${videoId}`,
          `https://youtubetranscript.com/?v=${videoId}`,
          `https://youtubetranscript.com/${videoId}`,
          // Additional services
          `https://www.veed.io/tools/youtube-transcript/transcript?url=${encodedUrl}`,
          `https://www.transcribeme.com/youtube-transcription?v=${videoId}`
        ];
    
    for (const tactiqUrl of urlsToTry) {
      try {
        console.log(`Trying URL: ${tactiqUrl}`);
        
        // Navigate with longer timeout and wait for network idle
        await page.goto(tactiqUrl, { 
          waitUntil: ['networkidle0', 'domcontentloaded'], 
          timeout: 60000 // 60 second timeout
        });
        
        // Take a screenshot for debugging if needed
        // await page.screenshot({ path: `tactiq_${videoId}.png` });
        
        // Wait for any potential redirects or dynamic content loading
        console.log('Waiting for page to settle...');
        try {
          // First try waitForTimeout if available (newer versions of Puppeteer)
          if (typeof page.waitForTimeout === 'function') {
            await page.waitForTimeout(8000);
          } else {
            // Otherwise use setTimeout with Promise
            await new Promise(resolve => setTimeout(resolve, 8000));
          }
        } catch (e) {
          // If either approach fails, just wait using setTimeout
          console.log('Using fallback timeout method');
          await new Promise(resolve => setTimeout(resolve, 8000));
        }
        
        // Ensure page is fully loaded
        await page.evaluate(() => {
          return new Promise((resolve) => {
            if (document.readyState === 'complete') {
              resolve();
            } else {
              window.addEventListener('load', resolve);
            }
          });
        });
        
        // Wait for the transcript to load
        console.log('Looking for transcript content...');
        
        // Enhanced selector list based on various transcript websites
        const transcriptSelectors = [
          // YouTube direct selectors
          'ytd-transcript-body-renderer',
          'ytd-transcript-renderer',
          'ytd-transcript-segment-renderer',
          '#segments-container',
          // Service-specific selectors
          '.transcript-container',
          'pre',
          '[data-testid="transcript"]',
          '.prose',
          'div[role="textbox"]',
          '.text-content',
          'div.whitespace-pre-wrap',
          'div.flex.flex-col.gap-y-4',
          'div.py-4', 
          'div.w-full.h-full.overflow-auto',
          // YouTubeTranscript.com selectors
          '.transcriptcontainer',
          '.transcription',
          '.caption-line',
          // VEED.io selectors
          '.transcript-text-container',
          '.transcript-content',
          // More generic selectors
          'div.transcript',
          'div#transcript',
          'div.transcript-text',
          '.transcript-text',
          '#transcript-text',
          // Fallbacks for YouTube
          '.ytp-caption-segment',
          // Very generic fallbacks
          'div:not(:empty)',
          'pre:not(:empty)',
          'p:not(:empty)'
        ];
        
        // Check for transcript content
        let transcriptText = null;
        for (const selector of transcriptSelectors) {
          try {
            // Wait briefly for the selector
            await page.waitForSelector(selector, { timeout: 5000 });
            
            // Check for text content
            transcriptText = await page.evaluate((sel) => {
              // Try to find all matching elements
              const elements = Array.from(document.querySelectorAll(sel));
              
              // Filter out empty elements and those with very short text
              const validElements = elements.filter(el => {
                const text = el.innerText?.trim();
                return text && text.length > 100; // Longer threshold for transcripts
              });
              
              // Get the element with the most text content (likely the transcript)
              if (validElements.length > 0) {
                const result = validElements.reduce((longest, current) => 
                  current.innerText.length > longest.innerText.length ? current : longest
                );
                return result.innerText;
              }
              return null;
            }, selector);
            
            if (transcriptText && transcriptText.length > 200) {
              console.log(`Found transcript using selector: ${selector}`);
              console.log(`Transcript length: ${transcriptText.length} chars`);
              return transcriptText;
            }
          } catch (selectorError) {
            // Continue to next selector
          }
        }
        
        // If we get here, we didn't find a transcript with the selectors
        console.log('No transcript found with specific selectors, trying page content...');
        
        // Last resort: try to get all text from the page
        const pageText = await page.evaluate(() => document.body.innerText);
        if (pageText && pageText.length > 500) { // Only if substantial
          console.log(`Using full page text (${pageText.length} chars)`);
          return pageText;
        }
        
      } catch (pageError) {
        console.error(`Error with URL ${tactiqUrl}:`, pageError);
        // Continue to next URL
      }
    }
    
    console.log('All Tactiq URL approaches failed');
    return null;
  } catch (error) {
    console.error('Browser transcript extraction failed:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Puppeteer browser closed');
    }
  }
}

/**
 * Get transcript using yt-dlp command line tool
 * @param {string} videoId YouTube video ID
 * @returns {Promise<string|null>} Transcript text or null if not found
 */
async function getTranscriptFromYtDlp(videoId) {
  const { exec } = require('child_process');
  const util = require('util');
  const execAsync = util.promisify(exec);
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    console.log('Trying yt-dlp for transcript extraction...');
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    // Generate a unique filename
    const tempFile = path.join(tempDir, `temp_${videoId}`);
    
    // Try to download just the subtitle/transcript with additional options to avoid IP blocking
    const ytDlpCommand = `yt-dlp --skip-download --write-auto-sub --sub-lang en --sub-format vtt --output "${tempFile}" --extractor-retries 3 --force-ipv4 --no-check-certificate "https://www.youtube.com/watch?v=${videoId}"`;
    
    console.log(`Executing: ${ytDlpCommand}`);
    const { stdout } = await execAsync(ytDlpCommand);
    console.log('yt-dlp output:', stdout);
    
    // Check if subtitle file was created
    const files = await fs.readdir(tempDir);
    const subtitleFile = files.find(file => 
      file.startsWith(`temp_${videoId}`) && file.endsWith('.vtt')
    );
    
    if (subtitleFile) {
      const subtitlePath = path.join(tempDir, subtitleFile);
      console.log(`Found subtitle file: ${subtitlePath}`);
      
      // Read and parse the VTT file
      const vttContent = await fs.readFile(subtitlePath, 'utf8');
      
      // Improved parsing of VTT format (remove timestamps and metadata)
      const lines = vttContent.split('\n');
      const textLines = [];
      
      let currentSentence = '';
      let inSubtitle = false;
      
      for (const line of lines) {
        // Skip empty lines, timestamps, and metadata
        if (line.trim() === '' || 
            line.includes('-->') || 
            line.match(/^\d+$/) || 
            line.startsWith('WEBVTT') ||
            line.startsWith('Kind:') ||
            line.startsWith('Language:')) {
          
          // When we hit a timestamp, mark that we're in a subtitle section
          if (line.includes('-->')) {
            inSubtitle = true;
          }
          continue;
        }
        
        // Only process lines that are part of the subtitle content
        if (inSubtitle) {
          const cleanLine = line.trim()
            // Remove speaker identifications like [Speaker 1]:
            .replace(/^\[.*?\]:\s*/g, '')
            // Remove timing info that might be in the text
            .replace(/\d+:\d+:\d+\.\d+/g, '')
            // Remove HTML-like tags that might be in the text
            .replace(/<[^>]+>/g, '')
            // Remove <> artifacts that appear in some transcripts
            .replace(/<>/g, '')
            // Remove % signs at the end of lines
            .replace(/%$/, '')
            // Remove &gt; and other HTML entities
            .replace(/&[a-z]+;/g, '');
          
          // Only add non-empty lines
          if (cleanLine) {
            // Check if this line ends with punctuation
            if (/[.!?]$/.test(cleanLine)) {
              // If it does, add it to current sentence and push to textLines
              currentSentence += (currentSentence ? ' ' : '') + cleanLine;
              textLines.push(currentSentence);
              currentSentence = '';
            } else {
              // Otherwise, add to current sentence
              currentSentence += (currentSentence ? ' ' : '') + cleanLine;
            }
          }
        }
      }
      
      // Add any remaining text
      if (currentSentence) {
        textLines.push(currentSentence);
      }
      
      // Clean up
      try {
        await fs.unlink(subtitlePath);
      } catch (e) {
        console.log('Warning: Could not delete subtitle file:', e.message);
      }
      
      // Join with periods to make complete sentences
      let transcript = textLines.join('. ').replace(/\.\./g, '.');
      
      // Use a more direct approach to clean the transcript
      // First, split into sentences for easier processing
      const sentences = transcript.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
      const uniqueSentences = [];
      const seenSentences = new Set();
      
      // Remove duplicate sentences
      for (const sentence of sentences) {
        // Normalize the sentence for comparison (lowercase, remove extra spaces)
        const normalized = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Skip if we've seen this sentence before
        if (seenSentences.has(normalized)) {
          continue;
        }
        
        // Add to our tracking set and output
        seenSentences.add(normalized);
        uniqueSentences.push(sentence);
      }
      
      // Keep sentences separate with line breaks between them
      transcript = uniqueSentences.map(sentence => sentence.trim() + '.').join('\n\n');
      
      // Remove stuttering and repeated words
      transcript = transcript.replace(/\b(\w+)(\s+\1)+\b/g, '$1');
      transcript = transcript.replace(/\b(\w+)-\s*\1\b/g, '$1');
      
      // Clean up excessive punctuation
      transcript = transcript.replace(/([.!?])\s*\1+/g, '$1');
      transcript = transcript.replace(/\.\s*\./g, '.');
      
      // Remove % signs at the end
      transcript = transcript.replace(/%\s*$/, '');
      console.log(`✅ Got transcript from yt-dlp (${transcript.length} characters)`);
      return transcript;
    } else {
      console.log('No subtitle file was created by yt-dlp');
      return null;
    }
  } catch (error) {
    console.error('Error using yt-dlp:', error);
    return null;
  }
}

/**
 * Get transcript for a YouTube video using multiple methods
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string|null>} - Transcript text or null if not available
 */
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
      waitUntil: ['domcontentloaded', 'networkidle2'],
      timeout: 60000 
    });
    
    // Wait for page to load
    await page.waitForSelector('video', { timeout: 30000 });
    
    // Accept cookies if present
    try {
      const cookieButton = await page.$('button[aria-label="Accept all"]');
      if (cookieButton) {
        await cookieButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log('No cookie dialog found or error clicking it');
    }
    
    // Click on "..." button to show more options
    console.log('Looking for "..." menu button');
    try {
      // Try different selectors for the "..." button
      const moreButtonSelectors = [
        'button[aria-label="More actions"]',
        'ytd-menu-renderer button',
        'button.ytp-button[aria-label="More actions"]',
        'button.ytp-settings-button'
      ];
      
      let moreButton = null;
      for (const selector of moreButtonSelectors) {
        moreButton = await page.$(selector);
        if (moreButton) {
          console.log(`Found "..." button with selector: ${selector}`);
          break;
        }
      }
      
      if (moreButton) {
        await moreButton.click();
        await page.waitForTimeout(1000);
      } else {
        console.log('Could not find "..." button');
      }
    } catch (e) {
      console.log('Error clicking "..." button:', e.message);
    }
    
    // Look for "Show transcript" option
    console.log('Looking for "Show transcript" option');
    try {
      const transcriptSelectors = [
        'ytd-menu-service-item-renderer:has-text("Show transcript")',
        'ytd-menu-service-item-renderer:has-text("Open transcript")',
        'button:has-text("Show transcript")',
        'button:has-text("Open transcript")'
      ];
      
      let transcriptOption = null;
      for (const selector of transcriptSelectors) {
        transcriptOption = await page.$(selector);
        if (transcriptOption) {
          console.log(`Found transcript option with selector: ${selector}`);
          await transcriptOption.click();
          await page.waitForTimeout(2000);
          break;
        }
      }
    } catch (e) {
      console.log('Error clicking transcript option:', e.message);
    }
    
    // Extract transcript text
    console.log('Looking for transcript text');
    const transcriptSelectors = [
      'ytd-transcript-body-renderer',
      'ytd-transcript-segment-list-renderer',
      'ytd-transcript-segment-renderer',
      '.ytd-transcript-segment-renderer',
      '#segments-container'
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
        
        // First try direct YouTube extraction (new method)
        const directYouTubeTranscript = await getTranscriptDirectFromYouTube(videoId);
        if (directYouTubeTranscript) {
          console.log('Direct YouTube extraction succeeded');
          if (CACHE_TRANSCRIPTS) await saveTranscript(videoId, directYouTubeTranscript);
          return directYouTubeTranscript;
        }
        
        // Then try yt-dlp
        console.log('Direct YouTube extraction failed, trying yt-dlp...');
        const ytDlpTranscript = await getTranscriptFromYtDlp(videoId);
        if (ytDlpTranscript) {
          console.log('yt-dlp method succeeded');
          if (CACHE_TRANSCRIPTS) await saveTranscript(videoId, ytDlpTranscript);
          return ytDlpTranscript;
        }
        
        // Then try YouTube Transcript API
        console.log('yt-dlp failed, trying YouTube Transcript API...');
        const ytTranscript = await getTranscriptFromYouTube(videoId);
        if (ytTranscript) {
          console.log('YouTube Transcript API method succeeded');
          if (CACHE_TRANSCRIPTS) await saveTranscript(videoId, ytTranscript);
          return ytTranscript;
        }
        
        // Then try Tactiq's direct approach
        console.log('YouTube API failed, trying Tactiq method...');
        const tactiqTranscript = await getTranscriptFromTactiq(videoId);
        if (tactiqTranscript) {
          console.log('Tactiq method succeeded');
          if (CACHE_TRANSCRIPTS) await saveTranscript(videoId, tactiqTranscript);
          return tactiqTranscript;
        }

        // Finally try browser-based scraping as fallback
        console.log('Tactiq method failed, trying browser-based scraping...');
        const browserTranscript = await getTranscriptFromBrowser(videoId);
        if (browserTranscript) {
          console.log('Browser-based scraping succeeded');
          if (CACHE_TRANSCRIPTS) await saveTranscript(videoId, browserTranscript);
          return browserTranscript;
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