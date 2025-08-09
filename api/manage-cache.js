/**
 * Cache management script for YouTube to Discord bot
 * 
 * This script allows viewing cache stats and cleaning the cache.
 * 
 * Usage:
 *   node api/manage-cache.js stats
 *   node api/manage-cache.js clean [maxAgeDays] [maxSizeMB]
 */

require('dotenv').config();
const { cleanCache, getCacheStats } = require('../utils/cache-manager');

async function main() {
  const command = process.argv[2]?.toLowerCase();
  
  if (!command || !['stats', 'clean'].includes(command)) {
    console.log('Usage:');
    console.log('  node api/manage-cache.js stats');
    console.log('  node api/manage-cache.js clean [maxAgeDays] [maxSizeMB]');
    console.log('');
    console.log('Commands:');
    console.log('  stats - Show cache statistics');
    console.log('  clean - Clean old cache files');
    console.log('');
    console.log('Options:');
    console.log('  maxAgeDays - Maximum age of cache files in days (default: 30)');
    console.log('  maxSizeMB  - Maximum total size of cache in MB (default: 500)');
    process.exit(1);
  }
  
  if (command === 'stats') {
    const stats = await getCacheStats();
    console.log('Cache Statistics:');
    console.log('----------------');
    console.log(`Total files: ${stats.files}`);
    console.log(`Total size: ${stats.size} MB`);
    console.log(`Transcripts: ${stats.transcripts}`);
    console.log(`Summaries: ${stats.summaries}`);
    
    if (stats.oldestFile) {
      console.log(`Oldest file: ${stats.oldestFile.name} (${stats.oldestFile.date})`);
    }
    
    if (stats.newestFile) {
      console.log(`Newest file: ${stats.newestFile.name} (${stats.newestFile.date})`);
    }
  } else if (command === 'clean') {
    const maxAgeDays = parseInt(process.argv[3]) || 30;
    const maxSizeMB = parseInt(process.argv[4]) || 500;
    
    console.log(`Cleaning cache (max age: ${maxAgeDays} days, max size: ${maxSizeMB} MB)...`);
    const result = await cleanCache({ maxAgeDays, maxSizeMB });
    
    if (result.error) {
      console.error(`Error cleaning cache: ${result.error}`);
      process.exit(1);
    }
    
    console.log('Cache Cleanup Results:');
    console.log('---------------------');
    console.log(`Files removed: ${result.cleaned}`);
    console.log(`Size before: ${result.sizeBefore} MB`);
    console.log(`Size after: ${result.sizeAfter} MB`);
    console.log(`Files before: ${result.filesBefore}`);
    console.log(`Files after: ${result.filesAfter}`);
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

