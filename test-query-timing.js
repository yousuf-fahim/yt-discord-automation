const sqlite3 = require('sqlite3').verbose();

async function testRecentSummariesQuery() {
  console.log('🔍 Testing Recent Summaries Query Directly...\n');
  
  // Test the exact SQL query used by getRecentSummaries
  const db = new sqlite3.Database('./data/bot.db');
  
  const query = `
    SELECT * FROM summaries 
    WHERE created_at >= datetime('now', '-24 hours')
    ORDER BY created_at DESC
  `;
  
  console.log('📋 Testing exact database query:');
  console.log(query);
  console.log('');
  
  return new Promise((resolve, reject) => {
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Query error:', err);
        reject(err);
        return;
      }
      
      console.log(`Found ${rows.length} summaries in last 24 hours`);
      
      if (rows.length > 0) {
        console.log('\nSummaries found:');
        rows.forEach((row, idx) => {
          const hoursAgo = ((Date.now() - new Date(row.created_at)) / (1000 * 60 * 60)).toFixed(1);
          console.log(`  ${idx + 1}. ${row.title}`);
          console.log(`     Created: ${row.created_at} (${hoursAgo}h ago)`);
        });
      } else {
        console.log('\nNo summaries found in last 24 hours');
        
        // Check what we DO have
        const expandedQuery = `
          SELECT *, ROUND((julianday('now') - julianday(created_at)) * 24, 1) as hours_ago
          FROM summaries 
          ORDER BY created_at DESC 
          LIMIT 5
        `;
        
        db.all(expandedQuery, [], (err, allRows) => {
          if (err) {
            console.error('Expanded query error:', err);
            db.close();
            resolve();
            return;
          }
          
          console.log('\nMost recent summaries (any time):');
          allRows.forEach((row, idx) => {
            console.log(`  ${idx + 1}. ${row.title}`);
            console.log(`     Created: ${row.created_at} (${row.hours_ago}h ago)`);
          });
          
          db.close();
          resolve();
        });
      }
      
      if (rows.length > 0) {
        db.close();
        resolve();
      }
    });
  });
}

// Also test with different hour windows
async function testDifferentWindows() {
  console.log('\n⏱️ Testing Different Time Windows...\n');
  
  const db = new sqlite3.Database('./data/bot.db');
  const windows = [6, 12, 24, 48, 72];
  
  for (const hours of windows) {
    const query = `
      SELECT COUNT(*) as count FROM summaries 
      WHERE created_at >= datetime('now', '-${hours} hours')
    `;
    
    await new Promise((resolve) => {
      db.get(query, [], (err, row) => {
        if (err) {
          console.log(`${hours}h window: Error - ${err.message}`);
        } else {
          console.log(`${hours}h window: ${row.count} summaries`);
        }
        resolve();
      });
    });
  }
  
  db.close();
}

async function runTests() {
  try {
    await testRecentSummariesQuery();
    await testDifferentWindows();
    
    console.log('\n🕐 Current Time Info:');
    console.log(`System time: ${new Date().toISOString()}`);
    console.log(`Local time: ${new Date().toLocaleString()}`);
    console.log(`Unix timestamp: ${Date.now()}`);
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

runTests();