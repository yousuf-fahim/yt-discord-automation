const ServiceManager = require('./src/core/service-manager');

async function compareDailyReportMethods() {
  try {
    console.log('🔍 Comparing Scheduled vs Manual Daily Report Data Access...\n');

    // Create a minimal service manager that bypasses validation
    const serviceManager = new ServiceManager();
    
    // Mock essential services for testing
    const mockDiscord = { client: { user: { username: 'TestBot' } } };
    const mockLogger = {
      info: (msg) => console.log(`[INFO] ${msg}`),
      error: (msg, err) => console.log(`[ERROR] ${msg}`, err?.message || ''),
      debug: (msg) => console.log(`[DEBUG] ${msg}`),
      warn: (msg) => console.log(`[WARN] ${msg}`)
    };

    // Create cache service
    const CacheService = require('./src/services/cache.service');
    const cacheService = new CacheService(serviceManager);

    // Create database service  
    const DatabaseService = require('./src/services/database.service');
    const databaseService = new DatabaseService(serviceManager);
    await databaseService.initialize();

    // Create report service with dependencies
    const ReportService = require('./src/services/report.service');
    const reportService = new ReportService(serviceManager, {
      summary: null,
      cache: cacheService,
      database: databaseService
    });

    console.log('📅 Current Time Analysis:');
    const now = new Date();
    console.log(`System time: ${now.toISOString()}`);
    console.log(`Local time: ${now.toLocaleString()}`);
    console.log(`Date string: ${now.toISOString().split('T')[0]}`);

    // Test the getRecentSummaries method directly
    console.log('\n🔍 Testing getRecentSummaries() method:');
    const recentSummaries = await reportService.getRecentSummaries();
    console.log(`Found ${recentSummaries.length} recent summaries`);

    if (recentSummaries.length > 0) {
      console.log('\nSample summaries found:');
      recentSummaries.slice(0, 3).forEach((summary, idx) => {
        console.log(`  ${idx + 1}. ${summary.videoTitle}`);
        console.log(`     Timestamp: ${summary.timestamp}`);
        console.log(`     Age: ${((new Date() - new Date(summary.timestamp)) / (1000 * 60 * 60)).toFixed(1)} hours ago`);
      });
    }

    // Test direct database query
    console.log('\n🗄️ Testing direct database query:');
    const dbSummaries = await databaseService.getRecentSummaries(24);
    console.log(`Database found ${dbSummaries.length} summaries in last 24 hours`);

    // Test with different time windows
    const timeWindows = [24, 48, 72, 96];
    console.log('\n⏱️ Testing different time windows:');
    for (const hours of timeWindows) {
      const summaries = await databaseService.getRecentSummaries(hours);
      console.log(`  Last ${hours} hours: ${summaries.length} summaries`);
    }

    // Test generateDailyReport directly
    console.log('\n📊 Testing generateDailyReport():');
    const dailyReport = await reportService.generateDailyReport();
    console.log(`Generated report with ${dailyReport.summaryCount} summaries`);
    console.log(`Report type: ${dailyReport.type}`);
    console.log(`Report timestamp: ${new Date(dailyReport.timestamp).toISOString()}`);
    
    // Show first 200 chars of report
    const reportPreview = dailyReport.data.substring(0, 200);
    console.log(`Report preview: ${reportPreview}...`);

    // Check for any timezone issues
    console.log('\n🌍 Timezone Analysis:');
    console.log(`process.env.TZ: ${process.env.TZ || 'not set'}`);
    console.log(`Date.getTimezoneOffset(): ${new Date().getTimezoneOffset()} minutes`);
    
    // Test the exact SQL query used
    console.log('\n🔍 Testing exact SQL query:');
    const testQuery = `
      SELECT video_id, title, created_at,
             ROUND((julianday('now') - julianday(created_at)) * 24, 1) as hours_ago
      FROM summaries 
      WHERE created_at >= datetime('now', '-24 hours')
      ORDER BY created_at DESC
    `;
    
    try {
      const rows = await databaseService.getAllQuery(testQuery, []);
      console.log(`SQL query returned ${rows.length} rows`);
      if (rows.length > 0) {
        rows.forEach(row => {
          console.log(`  ${row.title} - ${row.hours_ago}h ago (${row.created_at})`);
        });
      }
    } catch (error) {
      console.log(`SQL query error: ${error.message}`);
    }

  } catch (error) {
    console.error('Diagnostic error:', error);
  }
}

compareDailyReportMethods();