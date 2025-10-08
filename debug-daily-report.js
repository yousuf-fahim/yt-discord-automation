const ServiceManager = require('./src/core/service-manager');

async function debugDailyReport() {
  try {
    console.log('🔍 Debugging Daily Report Data Sources...\n');

    // Initialize service manager
    const serviceManager = new ServiceManager();
    await serviceManager.initializeAll();

    const reportService = await serviceManager.getService('report');
    const cacheService = await serviceManager.getService('cache');
    const database = await serviceManager.getService('database');

    // Check today's date calculations
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const today = new Date(todayStr);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    console.log('📅 Date Analysis:');
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Today string: ${todayStr}`);
    console.log(`Today date: ${today.toISOString()}`);
    console.log(`Yesterday: ${yesterday.toISOString().split('T')[0]}`);

    // Check cache for summaries
    console.log('\n📦 Cache Analysis:');
    
    // Check today's summaries
    const todaySummariesKey = `summaries_${todayStr}`;
    const todayCache = await cacheService.get(todaySummariesKey);
    console.log(`Today's cache key: ${todaySummariesKey}`);
    console.log(`Today's cache data:`, todayCache ? {
      type: typeof todayCache,
      isArray: Array.isArray(todayCache),
      hasData: todayCache.data ? true : false,
      length: Array.isArray(todayCache) ? todayCache.length : (todayCache.data ? todayCache.data.length : 0)
    } : 'null');

    // Check yesterday's summaries
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const yesterdaySummariesKey = `summaries_${yesterdayStr}`;
    const yesterdayCache = await cacheService.get(yesterdaySummariesKey);
    console.log(`Yesterday's cache key: ${yesterdaySummariesKey}`);
    console.log(`Yesterday's cache data:`, yesterdayCache ? {
      type: typeof yesterdayCache,
      isArray: Array.isArray(yesterdayCache),
      hasData: yesterdayCache.data ? true : false,
      length: Array.isArray(yesterdayCache) ? yesterdayCache.length : (yesterdayCache.data ? yesterdayCache.data.length : 0)
    } : 'null');

    // List all cache keys to see what's actually there
    console.log('\n🗝️ All Cache Keys:');
    const allKeys = await cacheService.getAllKeys();
    const summaryKeys = allKeys.filter(key => key.includes('summaries_'));
    console.log('Summary-related keys:', summaryKeys);

    // Check database
    if (database) {
      console.log('\n🗄️ Database Analysis:');
      const recentSummaries = await database.getRecentSummaries(48); // Check last 48 hours
      console.log(`Recent summaries in database (48hrs): ${recentSummaries.length}`);
      
      if (recentSummaries.length > 0) {
        console.log('Sample recent summaries:');
        recentSummaries.slice(0, 3).forEach((summary, idx) => {
          console.log(`  ${idx + 1}. ${summary.title} (${summary.created_at})`);
        });
      }
    }

    // Test the actual getRecentSummaries method
    console.log('\n🔄 Testing getRecentSummaries method:');
    const recentSummaries = await reportService.getRecentSummaries();
    console.log(`Returned summaries: ${recentSummaries.length}`);

    if (recentSummaries.length > 0) {
      console.log('Sample summaries:');
      recentSummaries.slice(0, 2).forEach((summary, idx) => {
        console.log(`  ${idx + 1}. ${summary.videoTitle} (timestamp: ${summary.timestamp})`);
      });
    }

    // Generate actual daily report
    console.log('\n📊 Generating Daily Report:');
    const report = await reportService.generateDailyReport();
    console.log(`Report generated with ${report.summaryCount} summaries`);
    console.log('Report preview:', report.data.substring(0, 200) + '...');

  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugDailyReport();