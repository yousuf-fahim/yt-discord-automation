const { isYouTubeLink, extractVideoId, isYouTubeShort, isYouTubeLive } = require('./utils/youtube');

// Test URLs
const testUrls = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://youtu.be/dQw4w9WgXcQ',
  'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  'https://youtube.com/watch?v=dQw4w9WgXcQ&live=1',
  'Not a YouTube link',
  'https://www.example.com'
];

console.log('Testing YouTube link detection:');
console.log('------------------------------');

testUrls.forEach(url => {
  const isYT = isYouTubeLink(url);
  const videoId = extractVideoId(url);
  const isShort = isYouTubeShort(url);
  const isLive = isYouTubeLive(url);
  
  console.log(`URL: ${url}`);
  console.log(`Is YouTube link: ${isYT}`);
  console.log(`Video ID: ${videoId || 'Not found'}`);
  console.log(`Is YouTube Short: ${isShort}`);
  console.log(`Is YouTube Live: ${isLive}`);
  console.log('------------------------------');
});
