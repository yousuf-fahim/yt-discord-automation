/**
 * Test Daily Report Generation
 */

const ServiceManager = require('./src/core/service-manager.js');

// Import service classes
const SummaryService = require('./src/services/summary.service');
const ReportService = require('./src/services/report.service');
const CacheService = require('./src/services/cache.service');

async function testDailyReportGeneration() {
  console.log('🧪 TESTING DAILY REPORT GENERATION');
  console.log('======================================================================');
  
  try {
    // Initialize ServiceManager
    const serviceManager = new ServiceManager();
    
    // Register services with their dependencies
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('summary', SummaryService, ['cache']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache']);
    
    await serviceManager.initializeAll();
    
    const reportService = serviceManager.getService('report');
    const cacheService = serviceManager.getService('cache');
    
    console.log('\n1️⃣ Testing Report Service Health');
    console.log('----------------------------------------------------------------------');
    const reportHealth = await reportService.healthCheck();
    console.log('Report Service Health:', reportHealth);
    
    console.log('\n2️⃣ Testing Recent Summaries Retrieval');
    console.log('----------------------------------------------------------------------');
    const recentSummaries = await reportService.getRecentSummaries();
    console.log(`Recent summaries found: ${recentSummaries.length}`);
    
    if (recentSummaries.length > 0) {
      console.log('Sample summary:');
      console.log('  - Video ID:', recentSummaries[0].videoId);
      console.log('  - Title:', recentSummaries[0].videoTitle?.substring(0, 50) + '...');
    }
    
    console.log('\n3️⃣ Testing Daily Report Generation');
    console.log('----------------------------------------------------------------------');
    
    if (recentSummaries.length === 0) {
      console.log('⚠️  No recent summaries found - creating mock data for testing...');
      
      // Create mock summary for testing
      const mockSummary = {
        videoId: 'test123',
        videoTitle: 'Test Video for Daily Report',
        summaryContent: 'This is a test summary for daily report generation testing.',
        videoUrl: 'https://youtube.com/watch?v=test123',
        timestamp: new Date().toISOString()
      };
      
      // Save mock summary to today's cache in new format
      const today = new Date().toISOString().split('T')[0];
      const summaryData = {
        data: [mockSummary],
        timestamp: Date.now(),
        type: 'summaries',
        date: today
      };
      
      await cacheService.set(`summaries_${today}`, summaryData);
      console.log('✅ Mock summary saved for today in new format');
      
      // Re-fetch recent summaries
      const newRecentSummaries = await reportService.getRecentSummaries();
      console.log(`Updated recent summaries: ${newRecentSummaries.length}`);
    }
    
    console.log('\n4️⃣ Generating Daily Report');
    console.log('----------------------------------------------------------------------');
    const reportResult = await reportService.generateDailyReport();
    
    if (reportResult && reportResult.data) {
      console.log('✅ Daily report generated successfully!');
      console.log(`Report length: ${reportResult.data.length} characters`);
      console.log(`Report type: ${reportResult.type || 'daily'}`);
      console.log(`Generated at: ${new Date(reportResult.timestamp).toISOString()}`);
      
      console.log('\n📊 Report Preview:');
      console.log('──────────────────────────────────────────────────────────────────────');
      console.log(reportResult.data.substring(0, 500) + '...');
      console.log('──────────────────────────────────────────────────────────────────────');
    } else {
      console.log('❌ Daily report generation failed');
      console.log('Result:', reportResult);
    }
    
    console.log('\n5️⃣ Testing Cache Storage');
    console.log('----------------------------------------------------------------------');
    const today = new Date().toISOString().split('T')[0];
    const cachedReport = await cacheService.get(`daily_report_${today}`);
    
    if (cachedReport) {
      console.log('✅ Report cached successfully');
      console.log(`Cache timestamp: ${new Date(cachedReport.timestamp).toISOString()}`);
    } else {
      console.log('❌ Report not found in cache');
    }
    
    console.log('\n======================================================================');
    console.log('📊 DAILY REPORT TEST RESULTS');
    console.log('======================================================================');
    
    if (reportResult && reportResult.data && cachedReport) {
      console.log('✅ ALL TESTS PASSED - Daily reports are working!');
    } else {
      console.log('❌ SOME TESTS FAILED - Check issues above');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testDailyReportGeneration().then(() => {
  console.log('\n🎉 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});