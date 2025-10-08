const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function simpleMigration() {
  console.log('🗄️ Simple Migration: Cache → Database\n');

  const db = new sqlite3.Database('./data/bot.db');

  // 1. Migrate summaries from cache
  console.log('📝 Migrating summaries...');
  const cacheDir = './cache';
  const summaryFiles = fs.readdirSync(cacheDir).filter(f => f.startsWith('summaries_') && f.endsWith('.json'));
  
  let migratedSummaries = 0;
  for (const file of summaryFiles) {
    const filePath = path.join(cacheDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const summaries = Array.isArray(data) ? data : (data.data || []);
    
    console.log(`  Processing ${file}: ${summaries.length} summaries`);
    
    for (const summary of summaries) {
      try {
        const content = summary.summaryContent || summary.content || '';
        const wordCount = content.split(' ').length;
        
        await new Promise((resolve, reject) => {
          db.run(`
            INSERT OR REPLACE INTO summaries 
            (video_id, title, content, url, prompt_type, word_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            summary.videoId,
            summary.videoTitle || summary.title,
            content,
            summary.videoUrl || summary.url,
            'default',
            wordCount,
            summary.timestamp || new Date().toISOString()
          ], function(err) {
            if (err) reject(err);
            else resolve();
          });
        });
        
        migratedSummaries++;
        console.log(`    ✅ ${summary.videoId}: ${summary.videoTitle}`);
      } catch (error) {
        console.log(`    ⚠️ Error: ${summary.videoId} - ${error.message}`);
      }
    }
  }
  
  console.log(`✅ Migrated ${migratedSummaries} summaries\n`);

  // 2. Check final database state
  console.log('📊 Database Summary:');
  
  await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM summaries', [], (err, row) => {
      console.log(`  Total summaries in database: ${row.count}`);
      resolve();
    });
  });

  await new Promise((resolve) => {
    db.get(`
      SELECT COUNT(*) as recent_count 
      FROM summaries 
      WHERE created_at >= datetime('now', '-72 hours')
    `, [], (err, row) => {
      console.log(`  Summaries from last 72 hours: ${row.recent_count}`);
      resolve();
    });
  });

  await new Promise((resolve) => {
    db.get(`
      SELECT video_id, title, created_at 
      FROM summaries 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [], (err, row) => {
      if (row) {
        console.log(`  Latest summary: ${row.title} (${row.created_at})`);
      }
      resolve();
    });
  });

  db.close();
  console.log('\n🎉 Migration completed!');
}

simpleMigration().catch(console.error);