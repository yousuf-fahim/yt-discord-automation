const ServiceManager = require('./src/core/service-manager');

async function testDatabaseFirstApproach() {
  try {
    console.log('🔍 Testing Database-First Report Generation...\n');

    // Set minimal env for testing
    process.env.NODE_ENV = 'test';
    process.env.DISCORD_BOT_TOKEN = 'test-token';
    process.env.DISCORD_GUILD_ID = 'test-guild';
    process.env.OPENAI_API_KEY = 'test-key';

    const serviceManager = new ServiceManager();
    await serviceManager.initializeAll();

    const reportService = await serviceManager.getService('report');
    
    console.log('📋 Testing getRecentSummaries() with database-first approach:');
    const summaries = await reportService.getRecentSummaries();
    
    console.log(`\n📊 Final result: ${summaries.length} summaries found`);
    
    if (summaries.length > 0) {
      console.log('\n📝 Sample summaries:');
      summaries.slice(0, 3).forEach((summary, idx) => {
        console.log(`  ${idx + 1}. ${summary.videoTitle}`);
        console.log(`     Created: ${summary.timestamp}`);
        console.log(`     Age: ${((Date.now() - new Date(summary.timestamp)) / (1000 * 60 * 60)).toFixed(1)}h ago`);
      });
    }

    console.log('\n📊 Testing full daily report generation:');
    const report = await reportService.generateDailyReport();
    console.log(`Report contains ${report.summaryCount} summaries`);
    console.log(`Report preview: ${report.data.substring(0, 200)}...`);

  } catch (error) {
    console.error('Test error:', error.message);
  }
}

testDatabaseFirstApproach();