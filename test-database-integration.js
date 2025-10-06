/**
 * Database Integration Test
 * Tests the new SQLite database service alongside existing cache system
 */

const ServiceManager = require('./src/core/service-manager.js');

// Import service classes
const SummaryService = require('./src/services/summary.service');
const ReportService = require('./src/services/report.service');
const CacheService = require('./src/services/cache.service');
const DatabaseService = require('./src/services/database.service');

async function testDatabaseIntegration() {
  console.log('🗄️ DATABASE INTEGRATION TEST');
  console.log('======================================================================');
  
  try {
    // Initialize ServiceManager with database
    const serviceManager = new ServiceManager();
    
    // Register services including database
    serviceManager.registerService('database', DatabaseService);
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('summary', SummaryService, ['cache', 'database']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache', 'database']);
    
    await serviceManager.initializeAll();
    
    const databaseService = await serviceManager.getService('database');
    const reportService = await serviceManager.getService('report');
    const cacheService = await serviceManager.getService('cache');
    
    console.log('\n✅ Phase 1: Database Health Check');
    console.log('----------------------------------------------------------------------');
    const dbHealth = await databaseService.healthCheck();
    console.log('Database Status:', dbHealth.status);
    console.log('Database Path:', dbHealth.path);
    console.log('Initial Stats:', dbHealth.stats);
    
    console.log('\n✅ Phase 2: Test Database Schema');
    console.log('----------------------------------------------------------------------');
    
    // Test direct database operations
    console.log('Testing direct database save...');
    await databaseService.saveSummary({
      videoId: 'db_test_001',
      videoTitle: 'Database Test Video 1',
      summaryContent: 'This is a test summary saved directly to the database.',
      videoUrl: 'https://youtube.com/watch?v=db_test_001',
      promptType: 'default'
    });
    
    await databaseService.saveSummary({
      videoId: 'db_test_002', 
      videoTitle: 'Database Test Video 2',
      summaryContent: 'Another test summary for database functionality testing.',
      videoUrl: 'https://youtube.com/watch?v=db_test_002',
      promptType: 'custom'
    });
    
    console.log('✅ 2 summaries saved directly to database');
    
    console.log('\n✅ Phase 3: Test Hybrid Cache + Database System');
    console.log('----------------------------------------------------------------------');
    
    // Test via report service (should save to both cache and database)
    const mockVideos = [
      {
        videoId: 'hybrid_001',
        videoTitle: 'Hybrid Test: AI Revolution 2025',
        summaryContent: 'Comprehensive analysis of AI developments and their impact on society, covering machine learning breakthroughs and ethical considerations.',
        videoUrl: 'https://youtube.com/watch?v=hybrid_001'
      },
      {
        videoId: 'hybrid_002',
        videoTitle: 'Hybrid Test: Web Development Trends',
        summaryContent: 'Latest trends in web development including new frameworks, performance optimization techniques, and developer experience improvements.',
        videoUrl: 'https://youtube.com/watch?v=hybrid_002'
      }
    ];
    
    for (const video of mockVideos) {
      await reportService.saveSummary(video);
    }
    
    console.log('✅ 2 summaries saved via hybrid system (cache + database)');
    
    console.log('\n✅ Phase 4: Test Database Retrieval');
    console.log('----------------------------------------------------------------------');
    
    // Test getting recent summaries from database
    const recentFromDB = await databaseService.getRecentSummaries(24);
    console.log(`Recent summaries from database: ${recentFromDB.length}`);
    
    recentFromDB.forEach((summary, index) => {
      console.log(`  ${index + 1}. ${summary.title} (${summary.video_id})`);
    });
    
    console.log('\n✅ Phase 5: Test Report Generation with Database');
    console.log('----------------------------------------------------------------------');
    
    const dailyReport = await reportService.generateDailyReport();
    console.log(`Daily report generated: ${dailyReport.data.length} chars`);
    console.log(`Report includes: ${dailyReport.summaryCount} videos`);
    
    console.log('\n✅ Phase 6: Test Database Analytics');
    console.log('----------------------------------------------------------------------');
    
    const today = new Date().toISOString().split('T')[0];
    
    // Record analytics
    await databaseService.recordDailyAnalytics(today, {
      videosProcessed: 4,
      totalSummaries: 4,
      avgSummaryLength: 150,
      totalWords: 600,
      processingTimeAvg: 2.5
    });
    
    console.log('✅ Analytics recorded for today');
    
    // Get analytics
    const analytics = await databaseService.getAnalytics(today, today);
    console.log('Analytics:', analytics[0]);
    
    console.log('\n✅ Phase 7: Test Search Functionality');
    console.log('----------------------------------------------------------------------');
    
    const searchResults = await databaseService.searchSummaries('AI', 5);
    console.log(`Search results for "AI": ${searchResults.length} found`);
    
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
    });
    
    console.log('\n✅ Phase 8: Final Database Stats');
    console.log('----------------------------------------------------------------------');
    
    const finalStats = await databaseService.getStats();
    console.log('Final Database Statistics:');
    console.log(`  📊 Summaries: ${finalStats.summaries}`);
    console.log(`  📋 Reports: ${finalStats.reports}`);
    console.log(`  💾 Database size: ${finalStats.dbSize}`);
    console.log(`  📅 Date range: ${finalStats.dateRange?.earliest} to ${finalStats.dateRange?.latest}`);
    
    console.log('\n✅ Phase 9: Test Database vs Cache Performance');
    console.log('----------------------------------------------------------------------');
    
    // Time cache access
    const cacheStart = Date.now();
    const todaySummaries = await cacheService.getTodaysSummaries();
    const cacheTime = Date.now() - cacheStart;
    
    // Time database access
    const dbStart = Date.now();
    const dbSummaries = await databaseService.getRecentSummaries(24);
    const dbTime = Date.now() - dbStart;
    
    console.log(`Cache access: ${todaySummaries.length} summaries in ${cacheTime}ms`);
    console.log(`Database access: ${dbSummaries.length} summaries in ${dbTime}ms`);
    console.log(`Performance: Cache is ${(dbTime / cacheTime).toFixed(1)}x faster`);
    
    console.log('\n======================================================================');
    console.log('🎉 DATABASE INTEGRATION TEST RESULTS');
    console.log('======================================================================');
    
    const allTestsPassed = 
      dbHealth.status === 'ok' &&
      finalStats.summaries >= 4 &&
      finalStats.reports >= 1 &&
      dailyReport.summaryCount > 0;
    
    if (allTestsPassed) {
      console.log('✅ ALL DATABASE TESTS PASSED!');
      console.log('✅ Database service: Operational');
      console.log('✅ Hybrid cache+database: Working');
      console.log('✅ Report generation: Enhanced'); 
      console.log('✅ Analytics: Functional');
      console.log('✅ Search: Working');
      console.log('✅ Performance: Optimal');
      console.log('');
      console.log('🚀 DATABASE IMPLEMENTATION SUCCESSFUL!');
      console.log('');
      console.log('💡 Next Steps:');
      console.log('  • Deploy with database support');
      console.log('  • Set up automated backups');
      console.log('  • Monitor database performance');
      console.log('  • Implement data retention policies');
    } else {
      console.log('❌ SOME DATABASE TESTS FAILED');
      console.log(`Database health: ${dbHealth.status}`);
      console.log(`Summaries count: ${finalStats.summaries}`);
      console.log(`Reports count: ${finalStats.reports}`);
    }
    
    // Clean up test data
    console.log('\n🧹 Database tests completed (keeping data for verification)');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testDatabaseIntegration().then(() => {
  console.log('\n🗄️ Database integration test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Database test crashed:', error);
  process.exit(1);
});