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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });
    
    if (!response.ok) {
      console.log(`Failed to fetch YouTube page: ${response.status} ${response.statusText}`);
      return null;
    }

    const html = await response.text();
    
    // Try several patterns to extract the title - updated for current YouTube structure
    const patterns = [
      // Most reliable patterns first
      /<meta property="og:title" content="([^"]+)"/i,
      /<meta name="twitter:title" content="([^"]+)"/i,
      /<meta name="title" content="([^"]+)"/i,
      // JSON-LD structured data
      /"name":"([^"]{10,}?)"/i,
      // Video details in page data
      /"videoDetails":\s*\{[^}]*"title":"([^"]+)"/i,
      // Page title (remove - YouTube suffix)
      /<title>([^<]+?)\s*-\s*YouTube<\/title>/i,
      // Generic title patterns as last resort
      /"title":\s*"([^"]{10,}?)"/i,
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
        
        console.log(`🔍 Pattern matched: "${title}"`);
        
        // Filter out generic YouTube titles, short/numeric-only titles, and channel names
        if (title === '- YouTube' || 
            title === 'YouTube' || 
            title.length < 10 || 
            /^[\d\s\.\,K]+$/.test(title) ||     // Numbers, spaces, K, dots, commas only
            /^[^\w]{2,}$/.test(title) ||        // Only symbols/punctuation
            /^@[\w-]+$/.test(title) ||          // Channel handles like @username
            /^[\w-]+\s*-\s*YouTube$/.test(title) || // Channel - YouTube format
            /^(Top comments|Comments|Related videos|More videos)$/i.test(title)) { // YouTube page elements
          console.log(`⚠️ Skipping invalid title: "${title}"`);
          continue;
        }
        
        console.log(`✅ Found YouTube title: ${title}`);
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






