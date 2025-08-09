/**
 * YouTube utility functions for extracting and validating YouTube links
 */

/**
 * Checks if a string contains a YouTube link
 * @param {string} text - Text to check for YouTube links
 * @returns {boolean} - True if the text contains a YouTube link
 */
function isYouTubeLink(text) {
  if (!text) return false;
  
  // Enhanced regex to catch more YouTube URL formats
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/|youtube\.com\/clip\/|youtube\.com\/live\/)([a-zA-Z0-9_-]+)(?:\S+)?/i;
  
  // Also check for youtu.be domain without path
  if (/youtu\.be\/?$/i.test(text)) {
    return true;
  }
  
  return youtubeRegex.test(text);
}

/**
 * Extracts the YouTube video ID from a YouTube URL
 * @param {string} text - Text containing a YouTube URL
 * @returns {string|null} - The YouTube video ID or null if not found
 */
function extractVideoId(text) {
  if (!text) return null;
  
  // Enhanced regex to catch more YouTube URL formats
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/|youtube\.com\/clip\/)([a-zA-Z0-9_-]+)(?:\S+)?/i;
  
  // Try standard YouTube URL formats
  const match = text.match(youtubeRegex);
  if (match && match[1]) {
    return match[1];
  }
  
  // Try to extract from query parameters for complex URLs
  try {
    const urlObj = new URL(text);
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return videoId;
      }
    }
  } catch (e) {
    // Not a valid URL, continue with other methods
  }
  
  // Check if it's just a video ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
    return text;
  }
  
  return null;
}

/**
 * Constructs a full YouTube URL from a video ID
 * @param {string} videoId - YouTube video ID
 * @returns {string} - Full YouTube URL
 */
function getYouTubeUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Checks if the YouTube link is a YouTube Short
 * @param {string} url - YouTube URL to check
 * @returns {boolean} - True if the URL is a YouTube Short
 */
function isYouTubeShort(url) {
  return url.includes('youtube.com/shorts/');
}

/**
 * Checks if the YouTube link is a YouTube Live video
 * @param {string} url - YouTube URL to check
 * @returns {boolean} - True if the URL is a YouTube Live video
 */
async function isYouTubeLive(url) {
  try {
    // First check URL parameters
    if (url.includes('&live=1') || url.includes('?live=1')) {
      return true;
    }

    // Then check page metadata
    const videoId = extractVideoId(url);
    if (!videoId) return false;

    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
    if (!response.ok) return false;

    const data = await response.json();
    // Check title and author name for common live indicators
    const liveIndicators = ['🔴', 'LIVE', '(Live)', '[Live]', 'Live Stream'];
    return liveIndicators.some(indicator => 
      data.title?.includes(indicator) || data.author_name?.includes(indicator)
    );
  } catch (error) {
    console.error('Error checking if video is live:', error);
    return false;
  }
}

module.exports = {
  isYouTubeLink,
  extractVideoId,
  getYouTubeUrl,
  isYouTubeShort,
  isYouTubeLive
};
