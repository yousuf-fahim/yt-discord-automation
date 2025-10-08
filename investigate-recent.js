const fs = require('fs');
const path = require('path');

async function investigateRecentActivity() {
  console.log('🔍 Investigating Recent Activity...\n');

  // Check current date/time
  const now = new Date();
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Current date: ${now.toISOString().split('T')[0]}`);

  // Check for any files modified in the last 24 hours
  console.log('\n📁 Recent file modifications:');
  const cacheDir = './cache';
  const dataDir = './data';

  const checkRecentFiles = (dir) => {
    try {
      const files = fs.readdirSync(dir);
      const recentFiles = [];
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        const hoursSinceModified = (now - stats.mtime) / (1000 * 60 * 60);
        
        if (hoursSinceModified <= 24) {
          recentFiles.push({
            file: filePath,
            modified: stats.mtime.toISOString(),
            hoursAgo: hoursSinceModified.toFixed(1)
          });
        }
      }
      
      return recentFiles;
    } catch (error) {
      console.log(`Error reading ${dir}:`, error.message);
      return [];
    }
  };

  const recentCacheFiles = checkRecentFiles(cacheDir);
  const recentDataFiles = checkRecentFiles(dataDir);

  console.log('\nCache files modified in last 24 hours:');
  if (recentCacheFiles.length === 0) {
    console.log('  None');
  } else {
    recentCacheFiles.forEach(f => {
      console.log(`  ${f.file} - ${f.hoursAgo}h ago (${f.modified})`);
    });
  }

  console.log('\nData files modified in last 24 hours:');
  if (recentDataFiles.length === 0) {
    console.log('  None');
  } else {
    recentDataFiles.forEach(f => {
      console.log(`  ${f.file} - ${f.hoursAgo}h ago (${f.modified})`);
    });
  }

  // Check if bot database was recently updated
  try {
    const dbPath = './data/bot.db';
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      const hoursSinceModified = (now - stats.mtime) / (1000 * 60 * 60);
      console.log(`\n🗄️ Database last modified: ${stats.mtime.toISOString()} (${hoursSinceModified.toFixed(1)}h ago)`);
    }
  } catch (error) {
    console.log('Error checking database:', error.message);
  }

  // Look for any summary-related cache keys that might exist
  console.log('\n🔑 Checking for potential summary cache keys:');
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const potentialKeys = [
    `summaries_${today}`,
    `summaries_${yesterday}`,
    `daily_report_${today}`,
    `daily_report_${yesterday}`
  ];

  potentialKeys.forEach(key => {
    const filePath = `./cache/${key}.json`;
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      console.log(`  ✅ Found: ${key} (modified: ${stats.mtime.toISOString()})`);
    } else {
      console.log(`  ❌ Missing: ${key}`);
    }
  });

  console.log('\n=== Analysis Complete ===');
}

investigateRecentActivity();