/**
 * Database Inspector - Quick Database Exploration Tool
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');
const DatabaseService = require('./src/services/database.service');

async function inspectDatabase() {
  console.log('🔍 DATABASE INSPECTOR');
  console.log('='.repeat(50));

  try {
    // Initialize database service
    serviceManager.registerService('database', DatabaseService);
    await serviceManager.initializeAll();
    
    const db = await serviceManager.getService('database');
    
    // Get basic stats
    console.log('\n📊 DATABASE STATISTICS:');
    const stats = await db.getStats();
    console.log(JSON.stringify(stats, null, 2));
    
    // Recent summaries
    console.log('\n📝 RECENT SUMMARIES:');
    const summaries = await db.getRecentSummaries(5);
    summaries.forEach((summary, i) => {
      console.log(`${i + 1}. ${summary.title}`);
      console.log(`   Video ID: ${summary.video_id}`);
      console.log(`   Created: ${summary.created_at}`);
      console.log(`   Words: ${summary.word_count || 'N/A'}`);
      console.log('');
    });
    
    // Search example
    console.log('\n🔍 SEARCH EXAMPLE (AI-related content):');
    const searchResults = await db.searchSummaries('AI');
    searchResults.forEach((result, i) => {
      console.log(`${i + 1}. ${result.title} (${result.video_id})`);
    });
    
    // Analytics
    console.log('\n📈 ANALYTICS:');
    const analytics = await db.getAnalytics('2025-10-06');
    if (analytics.length > 0) {
      analytics.forEach(entry => {
        console.log(`Date: ${entry.date}`);
        console.log(`Videos Processed: ${entry.videos_processed}`);
        console.log(`Total Summaries: ${entry.total_summaries}`);
        console.log(`Avg Length: ${entry.avg_summary_length}`);
        console.log('');
      });
    } else {
      console.log('No analytics data found for today');
    }
    
    console.log('🎯 Database inspection completed!');
    
  } catch (error) {
    console.error('❌ Error inspecting database:', error);
  }
  
  process.exit(0);
}

inspectDatabase();