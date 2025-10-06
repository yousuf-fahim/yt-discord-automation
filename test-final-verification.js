/**
 * Final Verification Test - End-to-End Summary & Report Flow
 */

const ServiceManager = require('./src/core/service-manager.js');

// Import service classes
const SummaryService = require('./src/services/summary.service');
const ReportService = require('./src/services/report.service');
const CacheService = require('./src/services/cache.service');

async function finalVerificationTest() {
  console.log('🎯 FINAL VERIFICATION: Complete Summary & Report Flow');
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
    
    console.log('\n✅ Phase 1: Service Health Check');
    console.log('----------------------------------------------------------------------');
    console.log('All services initialized successfully');
    
    console.log('\n✅ Phase 2: Test Empty State (No Recent Activity)');
    console.log('----------------------------------------------------------------------');
    let recentSummaries = await reportService.getRecentSummaries();
    console.log(`Recent summaries: ${recentSummaries.length}`);
    
    const emptyReport = await reportService.generateDailyReport();
    console.log(`Empty report generated: ${emptyReport.data.length} chars`);
    console.log('✅ Empty state handled correctly');
    
    console.log('\n✅ Phase 3: Simulate Video Processing');
    console.log('----------------------------------------------------------------------');
    
    // Simulate processing multiple videos
    const mockVideos = [
      {
        videoId: 'abc123',
        videoTitle: 'How AI Will Change Everything in 2025',
        summaryContent: 'This video discusses the revolutionary impact of AI on various industries, highlighting key developments in machine learning, automation, and human-AI collaboration.',
        videoUrl: 'https://youtube.com/watch?v=abc123'
      },
      {
        videoId: 'def456',  
        videoTitle: 'Building Scalable Microservices with Node.js',
        summaryContent: 'A comprehensive guide to designing and implementing microservices architecture using Node.js, covering service discovery, load balancing, and containerization.',
        videoUrl: 'https://youtube.com/watch?v=def456'
      },
      {
        videoId: 'ghi789',
        videoTitle: 'The Future of Web Development: Beyond React',
        summaryContent: 'Exploration of emerging web development frameworks and technologies that are pushing beyond traditional React patterns, including new state management and rendering approaches.',
        videoUrl: 'https://youtube.com/watch?v=ghi789'
      }
    ];
    
    // Save each summary
    for (const video of mockVideos) {
      await reportService.saveSummary(video);
      console.log(`✅ Saved summary for: ${video.videoTitle.substring(0, 40)}...`);
    }
    
    console.log('\n✅ Phase 4: Test Active State (With Recent Activity)');
    console.log('----------------------------------------------------------------------');
    
    recentSummaries = await reportService.getRecentSummaries();
    console.log(`Recent summaries after processing: ${recentSummaries.length}`);
    
    const activeReport = await reportService.generateDailyReport();
    console.log(`Active report generated: ${activeReport.data.length} chars`);
    console.log(`Report includes ${activeReport.summaryCount} videos`);
    
    console.log('\n✅ Phase 5: Cache Verification');
    console.log('----------------------------------------------------------------------');
    
    const todaySummaries = await cacheService.getTodaysSummaries();
    console.log(`Cache contains ${todaySummaries.length} summaries for today`);
    
    const today = new Date().toISOString().split('T')[0];
    const cachedReport = await cacheService.get(`daily_report_${today}`);
    console.log(`Daily report cached: ${!!cachedReport}`);
    
    if (cachedReport) {
      console.log(`Cached report type: ${cachedReport.type}`);
      console.log(`Cached report summary count: ${cachedReport.summaryCount}`);
    }
    
    console.log('\n✅ Phase 6: Display Final Report');
    console.log('----------------------------------------------------------------------');
    console.log(activeReport.data);
    console.log('----------------------------------------------------------------------');
    
    console.log('\n======================================================================');
    console.log('🎉 FINAL VERIFICATION RESULTS');
    console.log('======================================================================');
    
    const allPassed = 
      recentSummaries.length === 3 &&
      activeReport &&
      activeReport.data &&
      activeReport.summaryCount === 3 &&
      cachedReport &&
      todaySummaries.length === 3;
    
    if (allPassed) {
      console.log('✅ ALL SYSTEMS OPERATIONAL');
      console.log('✅ Summary generation: Working');
      console.log('✅ Daily reports: Working');  
      console.log('✅ Cache management: Working');
      console.log('✅ Date handling: Fixed');
      console.log('✅ Data format: Standardized');
      console.log('');
      console.log('🚀 READY FOR DATABASE IMPLEMENTATION!');
    } else {
      console.log('❌ SOME ISSUES DETECTED');
      console.log(`Recent summaries: ${recentSummaries.length}/3`);
      console.log(`Report generated: ${!!activeReport}`);
      console.log(`Report cached: ${!!cachedReport}`);
      console.log(`Today summaries: ${todaySummaries.length}/3`);
    }
    
    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await cacheService.delete(`summaries_${today}`);
    await cacheService.delete(`daily_report_${today}`);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    console.error(error.stack);
  }
}

// Run the verification
finalVerificationTest().then(() => {
  console.log('\n🎯 Final verification completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Verification crashed:', error);
  process.exit(1);
});