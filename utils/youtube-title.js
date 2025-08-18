/**
 * Utility to fetch YouTube video title without using the YouTube API
 */
const fetch = require('node-fetch');

/**
 * Fetches the title of a YouTube video by scraping the page
 * @param {string} videoId - The YouTube video ID
 * @returns {Promise<string|null>} - The video title or null if not found
 */
async function getYouTubeTitle(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Fetching title for ${url} using page scraping...`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch YouTube page: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const html = await response.text();
    
    // Try several patterns to extract the title
    const patterns = [
      /<meta name="title" content="([^"]+)"/i,
      /<title>([^<]+)<\/title>/i,
      /"title":"([^"]+)"/i
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const title = match[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .trim();
        
        console.log(`Found YouTube title: ${title}`);
        return title;
      }
    }
    
    console.log('Could not extract title from YouTube page');
    return null;
  } catch (error) {
    console.error('Error fetching YouTube title:', error);
    return null;
  }
}

module.exports = { getYouTubeTitle };






