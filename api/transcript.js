require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer'); // Not needed for transcript extraction
const { getYouTubeUrl, isYouTubeShort, isYouTubeLive } = require('../utils/youtube');
const { getYouTubeTitle } = require('../utils/youtube-title');
const { saveTranscript, getTranscriptFromCache } = require('../utils/cache');

const execAsync = util.promisify(exec);

// Check yt-dlp installation with multiple fallback methods
console.log('Checking yt-dlp installation...');

async function findYtDlp() {
  // Print environment info
  console.log('Environment:', {
    PATH: process.env.PATH,
    PYTHONPATH: process.env.PYTHONPATH,
    PWD: process.cwd(),
    HOME: process.env.HOME
  });

  // Prioritize Heroku-specific paths for cloud deployment
  const possiblePaths = process.env.NODE_ENV === 'production' || process.env.DYNO ? [
    'python3 -m yt_dlp',  // Most reliable in Heroku
    '/app/.heroku/python/bin/yt-dlp',
    'yt-dlp',
    '~/.local/bin/yt-dlp'
  ] : [
    'yt-dlp',  // Local development
    'python3 -m yt_dlp',
    '/app/.heroku/python/bin/yt-dlp',
    '~/.local/bin/yt-dlp'
  ];
  
  for (const ytdlpPath of possiblePaths) {
    try {
      console.log(`Testing yt-dlp path: ${ytdlpPath}`);
      const { stdout, stderr } = await execAsync(`${ytdlpPath} --version`);
      
      if (stderr) {
        console.log(`Warning for ${ytdlpPath}:`, stderr);
      }
      
      console.log(`✅ yt-dlp found at: ${ytdlpPath}, version: ${stdout.trim()}`);
      
      // Verify it can actually fetch auto-generated subtitles (our main use case)
      try {
        const testCmd = `${ytdlpPath} --write-auto-sub --convert-subs srt --skip-download --no-playlist https://www.youtube.com/watch?v=dQw4w9WgXcQ`;
        const { stdout: testOut } = await execAsync(testCmd, { timeout: 15000 });
        console.log(`✅ yt-dlp auto-subtitle test successful with ${ytdlpPath}`);
        return ytdlpPath;
      } catch (testErr) {
        console.log(`⚠️ yt-dlp auto-subtitle test failed for ${ytdlpPath}:`, testErr.message);
        // Fallback: try basic functionality
        try {
          const fallbackCmd = `${ytdlpPath} --no-download --get-title --no-playlist https://www.youtube.com/watch?v=dQw4w9WgXcQ`;
          const { stdout: fallbackOut } = await execAsync(fallbackCmd, { timeout: 10000 });
          console.log(`✅ yt-dlp basic test successful with ${ytdlpPath}`);
          return ytdlpPath;
        } catch (fallbackErr) {
          console.log(`⚠️ yt-dlp basic test failed for ${ytdlpPath}:`, fallbackErr.message);
        }
      }
    } catch (err) {
      console.log(`❌ Failed to find yt-dlp at: ${ytdlpPath}`);
      console.log('Error:', err.message);
      
      // Try to get more info about Python/pip if it's the module version
      if (ytdlpPath.includes('python')) {
        try {
          const { stdout: pipList } = await execAsync('python3 -m pip list');
          console.log('Installed Python packages:', pipList);
        } catch (pipErr) {
          console.log('Failed to list Python packages:', pipErr.message);
        }
      }
    }
  }
  
  // Last resort: try to install yt-dlp directly
  try {
    console.log('Attempting to install yt-dlp as last resort...');
    await execAsync('python3 -m pip install --user yt-dlp');
    const { stdout } = await execAsync('python3 -m yt_dlp --version');
    console.log('Successfully installed yt-dlp:', stdout.trim());
    return 'python3 -m yt_dlp';
  } catch (err) {
    console.error('❌ Failed to install yt-dlp:', err.message);
  }
  
  console.error('❌ yt-dlp not found in any expected location');
  return null;
}

// Global variable to store the working yt-dlp command
let YT_DLP_CMD = null;

// Initialize yt-dlp detection
findYtDlp().then(cmd => {
  YT_DLP_CMD = cmd;
  if (cmd) {
    console.log(`✅ Using yt-dlp command: ${cmd}`);
  } else {
    console.error('❌ Warning: yt-dlp not found during initialization');
  }
}).catch(err => {
  console.error('❌ Error during yt-dlp detection:', err);
});

// Function to wait for yt-dlp detection to complete
async function waitForYtDlp(maxWaitMs = 10000) {
  const startTime = Date.now();
  while (YT_DLP_CMD === null && (Date.now() - startTime) < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (YT_DLP_CMD === null) {
    console.warn('⚠️ yt-dlp detection timed out, will try fallback methods');
  }
  
  return YT_DLP_CMD;
}

// Create temp directory for yt-dlp cache - Heroku compatible
const TEMP_DIR = process.env.DYNO ? '/tmp/yt-discord-temp' : path.join(process.cwd(), 'temp');
console.log('Using temp directory:', TEMP_DIR);
fs.mkdir(TEMP_DIR, { recursive: true, mode: 0o777 })
  .then(async () => {
    console.log('Successfully created temp directory');
    // Ensure Heroku cache directory exists (only if /app exists)
    if (process.env.DYNO) {
      try {
        await fs.access('/app');
        await fs.mkdir('/app/.cache', { recursive: true, mode: 0o777 });
      } catch (err) {
        console.log('Note: /app directory not available (likely local test)');
      }
    }
  })
  .then(() => console.log('Cache directories ready'))
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
    // Wait for yt-dlp detection to complete
    await waitForYtDlp();
    
    const url = getYouTubeUrl(videoId);
    
    // Helper function to verify video exists
    async function verifyVideoExists(videoId) {
      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Verifying video ${videoId} (attempt ${attempt}/${maxRetries})`);
          
          const ytdlpCmd = YT_DLP_CMD || 'yt-dlp';
          
          // Print current state
          console.log('Verification attempt details:', {
            attempt,
            ytdlpCmd,
            pwd: process.cwd(),
            env: {
              PATH: process.env.PATH,
              PYTHONPATH: process.env.PYTHONPATH
            }
          });
          
          // Try different command variations
          const cmdVariations = [
            // Standard command
            [
              ytdlpCmd,
              '--no-download',
              '--get-title',
              '--verbose',
              '--ignore-config',
              '--no-playlist',
              '--no-cache-dir',
              '--extractor-args',
              'youtube:player_client=android',
              '--user-agent',
              '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"',
              `https://www.youtube.com/watch?v=${videoId}`
            ].join(' '),
            
            // Simpler command
            [
              ytdlpCmd,
              '--no-download',
              '--get-title',
              '--no-playlist',
              `https://www.youtube.com/watch?v=${videoId}`
            ].join(' '),
            
            // With debug info
            [
              ytdlpCmd,
              '--verbose',
              '--dump-json',
              '--no-download',
              '--no-playlist',
              `https://www.youtube.com/watch?v=${videoId}`
            ].join(' ')
          ];
          
          // Try each command variation
          for (const cmd of cmdVariations) {
            try {
              console.log(`Trying command: ${cmd}`);
              const { stdout, stderr } = await execAsync(cmd + ' 2>&1');
              
              if (stderr) {
                console.log('Command stderr:', stderr);
              }
              
              if (stdout) {
                console.log('Command stdout:', stdout.substring(0, 200) + '...');
                return true;
              }
            } catch (cmdErr) {
              console.log(`Command failed: ${cmdErr.message}`);
              // Continue to next variation
            }
          }
          
          // If all variations failed, throw error
          throw new Error('All command variations failed');
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
    await fs.mkdir(videoTempDir, { recursive: true, mode: 0o777 });
    
    // Get the yt-dlp command to use
    const ytdlpCmd = YT_DLP_CMD || 'yt-dlp';
    
    console.log('Current working directory:', process.cwd());
    console.log('Video temp directory:', videoTempDir);

    // Try different methods to get transcript
    const methods = [
      // Method 1: Try auto-generated subtitles in English (most reliable)
      `${ytdlpCmd} --cache-dir "${TEMP_DIR}" --sub-lang en --write-auto-sub --convert-subs srt --output "${videoTempDir}/%(title)s [%(id)s].%(ext)s" --skip-download "https://www.youtube.com/watch?v=${videoId}"`,
      // Method 2: Try original language subtitles as fallback
      `${ytdlpCmd} --cache-dir "${TEMP_DIR}" --write-auto-sub --convert-subs srt --output "${videoTempDir}/%(title)s [%(id)s].%(ext)s" --skip-download "https://www.youtube.com/watch?v=${videoId}"`
    ];

    for (const cmd of methods) {
      try {
        console.log(`Executing command: ${cmd}`);
        // Execute yt-dlp command with optimized settings for cloud deployment
        const isHeroku = !!process.env.DYNO;
        const { stdout, stderr } = await execAsync(cmd, { 
          timeout: isHeroku ? 60000 : 45000, // Extra time for Heroku cold starts
          shell: process.platform === 'win32' ? 'cmd' : '/bin/bash',
          env: { 
            ...process.env, 
            PATH: isHeroku ? `/app/.heroku/python/bin:${process.env.PATH}` : process.env.PATH,
            TMPDIR: TEMP_DIR,
            TEMP: TEMP_DIR,
            HOME: process.env.HOME || '/app',
            // Heroku-specific environment variables
            ...(isHeroku && {
              PYTHONPATH: `/app/.heroku/python/lib/python${process.env.PYTHON_VERSION || '3.11'}/site-packages`,
              LD_LIBRARY_PATH: '/app/.heroku/python/lib'
            })
          }
        });
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
          
          // Clean up the transcript - remove the title prefix since we'll use it in the filename
          const cleaned = srtContent
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
              await saveTranscript(videoId, cleaned, videoTitle);
            }
            
            return cleaned;
          }
        }
      } catch (methodError) {
        console.log(`Method failed:`, methodError?.message || methodError);
        
        // If the first method (auto-generated subtitles) fails with certain errors,
        // don't bother trying the fallback method as it's likely to fail too
        if (methodError?.message?.includes('Video unavailable') || 
            methodError?.message?.includes('Private video') ||
            methodError?.message?.includes('This live event will begin in')) {
          console.log('Video appears to be unavailable, skipping remaining methods');
          break;
        }
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
