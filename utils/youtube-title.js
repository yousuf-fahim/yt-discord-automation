/**
 * Utility to fetch YouTube video title without using the YouTube API
 */

/**
 * Fetches the title of a YouTube video by scraping the page
 * @param {string} videoId - The YouTube video ID
 * @returns {Promise<string|null>} - The video title or null if not found
 */
async function getYouTubeTitle(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`Fetching title for ${url} using page scraping...`);
    
    // Use built-in fetch (Node.js 18+) or require node-fetch for older versions
    let fetchFunction;
    try {
      fetchFunction = globalThis.fetch || require('node-fetch');
    } catch (error) {
      console.log('Fetch not available, skipping title extraction');
      return null;
    }
    
    const response = await fetchFunction(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch YouTube page: ${response.status} ${response.statusText}`);
      return null;
    }

    const html = await response.text();
    
    // Try several patterns to extract the title - updated for current YouTube structure
    const patterns = [
      // New YouTube structure patterns
      /<meta property="og:title" content="([^"]+)"/i,
      /<meta name="twitter:title" content="([^"]+)"/i,
      /"videoDetails":\s*\{[^}]*"title":"([^"]+)"/i,
      /"title":\s*"([^"]+)"/i,
      // Legacy patterns as fallback
      /<meta name="title" content="([^"]+)"/i,
      /<title>([^<]+)<\/title>/i
    ];
    
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let title = match[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/\\u0026/g, '&')
          .replace(/\\"/g, '"')
          .trim();
        
        // Filter out generic YouTube titles
        if (title === '- YouTube' || title === 'YouTube' || title.length < 3) {
          console.log(`Skipping generic title: "${title}"`);
          continue;
        }
        
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






