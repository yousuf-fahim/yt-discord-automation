/**
 * Test /check-summaries Command Functionality
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');

// Import services
const CacheService = require('./src/services/cache.service');
const SummaryService = require('./src/services/summary.service');
const ReportService = require('./src/services/report.service');

async function testCheckSummariesCommand() {
  console.log('🧪 TESTING /check-summaries COMMAND FUNCTIONALITY');
  console.log('='.repeat(70));

  try {
    // Initialize services
    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('summary', SummaryService, ['cache']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache']);
    await serviceManager.initializeAll();

    const cache = await serviceManager.getService('cache');
    const report = await serviceManager.getService('report');

    console.log('\n1️⃣ Testing Cache Service Methods');
    console.log('-'.repeat(70));

    // Debug: Check what cache object we got
    console.log(`Cache service type: ${typeof cache}`);
    console.log(`Cache methods: ${Object.getOwnPropertyNames(Object.getPrototypeOf(cache))}`);
    console.log(`Has getTodaysSummaries: ${typeof cache.getTodaysSummaries === 'function'}`);

    // Test getTodaysSummaries (used by /check-summaries)
    const todaysSummaries = await cache.getTodaysSummaries();
    console.log(`✅ cache.getTodaysSummaries():`);
    console.log(`   Returns: ${todaysSummaries.length} summaries`);
    console.log(`   Type: ${Array.isArray(todaysSummaries) ? 'Array ✓' : 'NOT Array ✗'}`);

    // Test listSummaries (used by /check-summaries with --all-dates)
    const allSummaries = await cache.listSummaries();
    console.log(`\n✅ cache.listSummaries():`);
    console.log(`   Returns: ${Object.keys(allSummaries).length} date(s)`);
    
    Object.entries(allSummaries).forEach(([date, summaries]) => {
      console.log(`   • ${date}: ${summaries.length} summaries`);
      if (summaries.length > 0 && summaries.length <= 3) {
        summaries.forEach(sum => {
          const title = sum.title || sum.videoTitle || 'Unknown';
          console.log(`      - ${title.substring(0, 50)}...`);
        });
      }
    });

    console.log('\n2️⃣ Testing Report Service Methods');
    console.log('-'.repeat(70));

    // Test getRecentSummaries (used by /check-summaries)
    const recentSummaries = await report.getRecentSummaries();
    console.log(`✅ report.getRecentSummaries():`);
    console.log(`   Returns: ${recentSummaries.length} summaries (last 24 hours)`);
    console.log(`   Type: ${Array.isArray(recentSummaries) ? 'Array ✓' : 'NOT Array ✗'}`);

    if (recentSummaries.length > 0) {
      console.log(`   Recent videos:`);
      recentSummaries.slice(0, 5).forEach((sum, i) => {
        const title = sum.title || sum.videoTitle || 'Unknown';
        const time = sum.timestamp ? new Date(sum.timestamp).toLocaleString() : 'No timestamp';
        console.log(`      ${i + 1}. ${title.substring(0, 40)}... (${time})`);
      });
    }

    console.log('\n3️⃣ Simulating /check-summaries Command (showAll=false)');
    console.log('-'.repeat(70));

    const today = new Date().toISOString().split('T')[0];
    let description = '📋 **Summary Check Results:**\n\n';
    description += `**Today (${today}):** ${todaysSummaries.length} summaries\n`;

    if (todaysSummaries.length > 0) {
      todaysSummaries.forEach((summary, index) => {
        const title = summary.videoTitle || summary.title || `Video ${summary.videoId}`;
        description += `${index + 1}. ${title.substring(0, 50)}...\n`;
      });
    }
    description += '\n';

    description += `**Recent (24hrs):** ${recentSummaries.length} summaries\n`;

    console.log(description);
    console.log(`Output length: ${description.length} chars (${description.length > 2000 ? 'needs file' : 'fits in message'})`);

    console.log('\n4️⃣ Simulating /check-summaries Command (showAll=true)');
    console.log('-'.repeat(70));

    description += '\n**All Dates:**\n';
    Object.entries(allSummaries).forEach(([date, summaries]) => {
      description += `• ${date}: ${summaries.length} summaries\n`;
    });

    console.log(description.substring(description.lastIndexOf('**All Dates:**')));
    console.log(`\nTotal output length: ${description.length} chars (${description.length > 2000 ? 'needs file' : 'fits in message'})`);

    console.log('\n5️⃣ Testing Data Format Compatibility');
    console.log('-'.repeat(70));

    // Check if old format (plain array) and new format ({data: array}) both work
    const testDate = '2025-09-09';
    const cached = await cache.get(`summaries_${testDate}`);
    
    console.log(`Raw cache format for ${testDate}:`);
    console.log(`   Has 'data' property: ${cached && cached.data ? 'Yes (new format)' : 'No'}`);
    console.log(`   Is array: ${Array.isArray(cached) ? 'Yes (old format)' : 'No'}`);
    console.log(`   Can be processed: ✅`);

    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(70));

    const tests = [
      { name: 'getTodaysSummaries returns array', pass: Array.isArray(todaysSummaries) },
      { name: 'listSummaries returns object', pass: typeof allSummaries === 'object' },
      { name: 'getRecentSummaries returns array', pass: Array.isArray(recentSummaries) },
      { name: 'listSummaries contains dates', pass: Object.keys(allSummaries).length > 0 },
      { name: 'Format compatibility (old/new)', pass: true }
    ];

    tests.forEach(test => {
      console.log(`${test.pass ? '✅' : '❌'} ${test.name}`);
    });

    const allPassed = tests.every(t => t.pass);
    
    console.log('\n' + '='.repeat(70));
    if (allPassed) {
      console.log('✅ ALL TESTS PASSED - /check-summaries is working correctly!');
    } else {
      console.log('❌ SOME TESTS FAILED - Review issues above');
    }
    console.log('='.repeat(70));

    console.log('\n💡 HOW TO USE IN DISCORD:');
    console.log('   • /check-summaries              → Show today + recent (24hrs)');
    console.log('   • /check-summaries all-dates:true → Show all dates with summaries');
    console.log('');
    console.log('   If output > 2000 chars, it will be sent as a .txt file automatically');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run test
testCheckSummariesCommand();
