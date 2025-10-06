/**
 * Test Report Generation System
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');

// Import service classes
const DatabaseService = require('./src/services/database.service');
const HybridCacheService = require('./src/services/hybrid-cache.service');
const SummaryService = require('./src/services/summary.service');
const ReportService = require('./src/services/report.service');

async function testReports() {
  console.log('🧪 REPORT GENERATION TEST');
  console.log('='.repeat(60));

  try {
    // Register and initialize services
    serviceManager.registerService('database', DatabaseService);
    serviceManager.registerService('cache', HybridCacheService, ['database']);
    serviceManager.registerService('summary', SummaryService, ['cache', 'database']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache', 'database']);

    await serviceManager.initializeAll();

    const reportService = await serviceManager.getService('report');
    const databaseService = await serviceManager.getService('database');

    console.log('✅ Services initialized successfully');

    // Check database summaries
    console.log('\n📊 DATABASE STATUS:');
    
    // Get recent summaries (last 7 days)
    const recentSummaries = await databaseService.getRecentSummaries(24 * 7);
    console.log(`  Recent summaries (7 days): ${recentSummaries.length}`);
    
    // Get today's summaries using date range
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const todaySummaries = await databaseService.getSummariesByDateRange(today, tomorrow);
    console.log(`  Today's summaries (${today}): ${todaySummaries.length}`);

    if (recentSummaries.length > 0) {
      // Group by date
      const summariesByDate = {};
      recentSummaries.forEach(summary => {
        const date = new Date(summary.created_at).toISOString().split('T')[0];
        if (!summariesByDate[date]) summariesByDate[date] = [];
        summariesByDate[date].push(summary);
      });

      console.log('  Summaries by date:');
      Object.entries(summariesByDate).forEach(([date, sums]) => {
        console.log(`    • ${date}: ${sums.length} summaries`);
      });
    }

    // Test daily report generation
    console.log('\n📅 DAILY REPORT TEST:');
    const dailyReport = await reportService.generateDailyReport();
    
    console.log('✅ Daily report generated:');
    console.log(`    • Date: ${new Date(dailyReport.timestamp).toISOString().split('T')[0]}`);
    console.log(`    • Summary count: ${dailyReport.summaryCount}`);
    console.log(`    • Content length: ${dailyReport.data ? dailyReport.data.length : 0} chars`);
    console.log(`    • Type: ${dailyReport.type}`);

    if (dailyReport.data && dailyReport.data.length > 0) {
      console.log('\n📄 REPORT PREVIEW (first 300 chars):');
      console.log('─'.repeat(50));
      console.log(dailyReport.data.substring(0, 300) + '...');
      console.log('─'.repeat(50));
    }

    // Test weekly report
    console.log('\n📊 WEEKLY REPORT TEST:');
    const weeklyReport = await reportService.generateWeeklyReport();
    console.log('✅ Weekly report generated:');
    console.log(`    • Summary count: ${weeklyReport.summaryCount}`);
    console.log(`    • Content length: ${weeklyReport.data ? weeklyReport.data.length : 0} chars`);

    // Test monthly report
    console.log('\n📈 MONTHLY REPORT TEST:');
    const monthlyReport = await reportService.generateMonthlyReport();
    console.log('✅ Monthly report generated:');
    console.log(`    • Summary count: ${monthlyReport.summaryCount}`);
    console.log(`    • Content length: ${monthlyReport.data ? monthlyReport.data.length : 0} chars`);

    console.log('\n🎉 ALL REPORT TESTS COMPLETED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testReports().catch(console.error);