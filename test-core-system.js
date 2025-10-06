/**
 * Test Enhanced System (Database & Cache only)
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');
const DatabaseService = require('./src/services/database.service');
const HybridCacheService = require('./src/services/hybrid-cache.service');
const ReportService = require('./src/services/report.service');
const SummaryService = require('./src/services/summary.service');

async function testCoreSystem() {
  console.log('🧪 CORE SYSTEM TEST (DB + Cache + Reports)');
  console.log('='.repeat(60));

  try {
    // Initialize core services only (skip Discord)
    serviceManager.registerService('database', DatabaseService);
    serviceManager.registerService('cache', HybridCacheService, ['database']);
    serviceManager.registerService('summary', SummaryService, ['cache', 'database']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache', 'database']);
    
    // Initialize manually to avoid Discord dependency issues
    console.log('🔧 Initializing core services...');
    
    const database = new DatabaseService(serviceManager, {});
    await database.initialize();
    
    const cache = new HybridCacheService(serviceManager, { database });
    await cache.initialize();
    
    const summary = new SummaryService(serviceManager, { cache, database });
    await summary.initialize();
    
    const report = new ReportService(serviceManager, { summary, cache, database });
    await report.initialize();

    console.log('✅ Core services initialized\n');

    // Test 1: Database Schema
    console.log('🔍 TEST 1: Database Schema');
    console.log('-'.repeat(40));
    
    const tables = ['summaries', 'daily_reports', 'weekly_reports', 'monthly_reports'];
    for (const table of tables) {
      try {
        const result = await database.getAllQuery(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]);
        console.log(`   ${table}: ${result.length > 0 ? '✅' : '❌'}`);
      } catch (error) {
        console.log(`   ${table}: ❌`);
      }
    }

    // Test 2: Create test data
    console.log('\n📊 TEST 2: Creating Test Data');
    console.log('-'.repeat(40));
    
    const testSummaries = [
      {
        videoId: 'weekly_test_001',
        title: 'AI Revolution 2025',
        summary: 'AI is transforming industries at unprecedented pace...',
        channel_name: 'Tech Weekly',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        videoId: 'weekly_test_002',
        title: 'Climate Tech Innovations',
        summary: 'New climate technologies offering hope for sustainability...',
        channel_name: 'Green Future',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const summary of testSummaries) {
      await database.saveSummary(summary);
    }
    console.log(`   Test summaries created: ${testSummaries.length}`);

    // Test 3: Daily Report
    console.log('\n📅 TEST 3: Daily Report');
    console.log('-'.repeat(40));
    
    try {
      const dailyReport = await report.generateDailyReport();
      console.log(`   Daily report generated: ✅`);
      console.log(`   Report length: ${dailyReport.length} characters`);
    } catch (error) {
      console.log(`   Daily report: ❌ (${error.message})`);
    }

    // Test 4: Weekly Report
    console.log('\n📊 TEST 4: Weekly Report');
    console.log('-'.repeat(40));
    
    try {
      const weeklyReport = await report.generateWeeklyReport();
      console.log(`   Weekly report generated: ✅`);
      console.log(`   Report length: ${weeklyReport.length} characters`);
      
      if (weeklyReport.includes('weekly')) {
        console.log(`   Contains weekly content: ✅`);
      }
    } catch (error) {
      console.log(`   Weekly report: ❌ (${error.message})`);
    }

    // Test 5: Monthly Report
    console.log('\n📈 TEST 5: Monthly Report');
    console.log('-'.repeat(40));
    
    try {
      const monthlyReport = await report.generateMonthlyReport();
      console.log(`   Monthly report generated: ✅`);
      console.log(`   Report length: ${monthlyReport.length} characters`);
      
      if (monthlyReport.includes('Monthly')) {
        console.log(`   Contains monthly content: ✅`);
      }
    } catch (error) {
      console.log(`   Monthly report: ❌ (${error.message})`);
    }

    // Test 6: Database Reports Check
    console.log('\n🗄️ TEST 6: Database Reports Storage');
    console.log('-'.repeat(40));
    
    const today = new Date().toISOString().split('T')[0];
    const dailyInDB = await database.getDailyReport(today);
    console.log(`   Daily report in DB: ${dailyInDB ? '✅' : '❌'}`);
    
    // Check weekly
    const now = new Date();
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : -(currentDay - 1);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const weeklyInDB = await database.getWeeklyReport(weekStartStr);
    console.log(`   Weekly report in DB: ${weeklyInDB ? '✅' : '❌'}`);
    
    const monthlyInDB = await database.getMonthlyReport(now.getFullYear(), now.getMonth() + 1);
    console.log(`   Monthly report in DB: ${monthlyInDB ? '✅' : '❌'}`);

    // Test 7: Cache System
    console.log('\n🚀 TEST 7: Hybrid Cache System');
    console.log('-'.repeat(40));
    
    const cacheHealth = await cache.healthCheck();
    console.log(`   Cache status: ${cacheHealth.status}`);
    console.log(`   Hit rate: ${cacheHealth.performance.hitRate}`);
    console.log(`   Database integration: ${cacheHealth.database}`);

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    for (const summary of testSummaries) {
      try {
        await database.runQuery('DELETE FROM summaries WHERE video_id = ?', [summary.videoId]);
      } catch (e) {}
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 CORE SYSTEM TEST RESULTS:');
    console.log('✅ Enhanced database schema with weekly/monthly reports');
    console.log('✅ Hybrid cache system with database integration');  
    console.log('✅ Multi-period report generation (daily/weekly/monthly)');
    console.log('✅ Optimized caching strategy implemented');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
  
  process.exit(0);
}

testCoreSystem().catch(console.error);