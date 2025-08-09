const fs = require('fs').promises;
const path = require('path');

// Cache directory
const CACHE_DIR = path.join(process.cwd(), 'cache');

/**
 * Ensures the cache directory exists
 * @returns {Promise<void>}
 */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating cache directory:', error);
  }
}

/**
 * Saves a transcript to the cache
 * @param {string} videoId - YouTube video ID
 * @param {string} transcript - Transcript text
 * @returns {Promise<void>}
 */
async function saveTranscript(videoId, transcript) {
  try {
    await ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${videoId}.txt`);
    await fs.writeFile(filePath, transcript, 'utf8');
    console.log(`Transcript cached for video ${videoId}`);
  } catch (error) {
    console.error('Error saving transcript to cache:', error);
  }
}

/**
 * Gets a transcript from the cache if available
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<string|null>} - Transcript text or null if not in cache
 */
async function getTranscriptFromCache(videoId) {
  try {
    const filePath = path.join(CACHE_DIR, `${videoId}.txt`);
    const stats = await fs.stat(filePath);
    
    // Check if the file exists and is not empty
    if (stats.isFile() && stats.size > 0) {
      const transcript = await fs.readFile(filePath, 'utf8');
      return transcript;
    }
    
    return null;
  } catch (error) {
    // File doesn't exist or can't be read
    return null;
  }
}

/**
 * Saves a summary to the cache
 * @param {string} videoId - YouTube video ID
 * @param {number} promptIndex - Index of the prompt used
 * @param {string} summary - Summary text
 * @returns {Promise<void>}
 */
async function saveSummary(videoId, promptIndex, summary) {
  try {
    await ensureCacheDir();
    const filePath = path.join(CACHE_DIR, `${videoId}_summary_${promptIndex}.json`);
    await fs.writeFile(filePath, JSON.stringify({
      videoId,
      promptIndex,
      summary,
      timestamp: new Date().toISOString()
    }), 'utf8');
  } catch (error) {
    console.error('Error saving summary to cache:', error);
  }
}

/**
 * Gets all summaries generated on a specific date
 * @param {Date} date - Date to get summaries for
 * @returns {Promise<Array>} - Array of summary objects
 */
async function getSummariesByDate(date) {
  try {
    await ensureCacheDir();
    
    // Get all files in the cache directory
    const files = await fs.readdir(CACHE_DIR);
    
    // Filter for summary files
    const summaryFiles = files.filter(file => file.includes('_summary_'));
    
    const summaries = [];
    
    // Get the date string in ISO format (YYYY-MM-DD)
    const dateString = date.toISOString().split('T')[0];
    
    // Read each summary file and check if it was generated on the specified date
    for (const file of summaryFiles) {
      try {
        const filePath = path.join(CACHE_DIR, file);
        const content = await fs.readFile(filePath, 'utf8');
        const summary = JSON.parse(content);
        
        // Check if the summary was generated on the specified date
        if (summary.timestamp && summary.timestamp.startsWith(dateString)) {
          summaries.push(summary);
        }
      } catch (error) {
        console.error(`Error reading summary file ${file}:`, error);
      }
    }
    
    return summaries;
  } catch (error) {
    console.error('Error getting summaries by date:', error);
    return [];
  }
}

module.exports = {
  saveTranscript,
  getTranscriptFromCache,
  saveSummary,
  getSummariesByDate
};
