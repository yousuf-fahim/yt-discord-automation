/**
 * COMPREHENSIVE BOT HEALTH CHECK & DIAGNOSTICS
 * Tests all aspects: Commands, Performance, Functionality, Services
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');
const path = require('path');
const fs = require('fs').promises;

// Import services
const DiscordService = require('./src/services/discord.service');
const TranscriptService = require('./src/services/transcript.service');
const SummaryService = require('./src/services/summary.service');
const ReportService = require('./src/services/report.service');
const CacheService = require('./src/services/cache.service');
const CommandService = require('./src/services/command.service');

async function runComprehensiveDiagnostics() {
  console.log('🔬 COMPREHENSIVE BOT DIAGNOSTICS');
  console.log('='.repeat(70));
  console.log('Checking all services, commands, and functionality\n');

  const results = {
    passed: [],
    failed: [],
    warnings: []
  };

  try {
    // ==========================================
    // 1. SERVICE INITIALIZATION
    // ==========================================
    console.log('1️⃣ SERVICE INITIALIZATION TEST');
    console.log('-'.repeat(70));

    serviceManager.registerService('cache', CacheService);
    serviceManager.registerService('transcript', TranscriptService, ['cache']);
    serviceManager.registerService('summary', SummaryService, ['cache']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache']);

    await serviceManager.initializeAll();

    const cache = serviceManager.getService('cache');
    const transcript = serviceManager.getService('transcript');
    const summary = serviceManager.getService('summary');
    const report = serviceManager.getService('report');

    console.log('✅ All services initialized successfully\n');
    results.passed.push('Service Initialization');

    // ==========================================
    // 2. CACHE SERVICE TEST
    // ==========================================
    console.log('\n2️⃣ CACHE SERVICE TEST');
    console.log('-'.repeat(70));

    // Test basic cache operations
    await cache.set('test_key', { data: 'test_value' });
    const cached = await cache.get('test_key');
    
    if (cached && cached.data === 'test_value') {
      console.log('✅ Cache read/write: Working');
      results.passed.push('Cache Operations');
    } else {
      console.log('❌ Cache read/write: FAILED');
      results.failed.push('Cache Operations');
    }

    // Test getTodaysSummaries
    const todaysSummaries = await cache.getTodaysSummaries();
    console.log(`✅ getTodaysSummaries(): Returns ${todaysSummaries.length} summaries`);
    
    // Test listSummaries
    const allSummaries = await cache.listSummaries();
    const dateCount = Object.keys(allSummaries).length;
    console.log(`✅ listSummaries(): Found ${dateCount} date(s) with summaries`);
    
    if (dateCount > 0) {
      Object.entries(allSummaries).forEach(([date, sums]) => {
        console.log(`   • ${date}: ${sums.length} summaries`);
      });
    }

    // Test cache stats
    const stats = await cache.getStats();
    console.log(`✅ Cache stats: ${stats.totalFiles} files, ${stats.totalSize}`);
    results.passed.push('Cache Service Methods');

    // ==========================================
    // 3. REPORT SERVICE TEST (/check-summary dependency)
    // ==========================================
    console.log('\n3️⃣ REPORT SERVICE TEST (check-summary dependency)');
    console.log('-'.repeat(70));

    // Test getRecentSummaries (used by /check-summary)
    const recentSummaries = await report.getRecentSummaries();
    console.log(`✅ getRecentSummaries(): ${recentSummaries.length} summaries in last 24hrs`);
    
    if (recentSummaries.length === 0) {
      results.warnings.push('No recent summaries found (expected if no videos processed today)');
    } else {
      results.passed.push('Report Service - Recent Summaries');
      recentSummaries.slice(0, 3).forEach((sum, i) => {
        console.log(`   ${i + 1}. ${sum.videoTitle || sum.title || 'Unknown'}`);
      });
    }

    // Test getSummariesByDate (internal method)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      const todaySums = await report.getSummariesByDate(today);
      console.log(`✅ getSummariesByDate(): ${todaySums.length} summaries for today`);
      results.passed.push('Report Service - Date Query');
    } catch (error) {
      console.log(`❌ getSummariesByDate(): FAILED - ${error.message}`);
      results.failed.push('Report Service - Date Query');
    }

    // ==========================================
    // 4. COMMAND SERVICE TEST
    // ==========================================
    console.log('\n4️⃣ COMMAND SERVICE TEST');
    console.log('-'.repeat(70));

    // Check if CommandService can be instantiated (it needs Discord service mock)
    try {
      // Create a minimal mock
      const mockLogger = {
        info: () => {},
        error: () => {},
        debug: () => {},
        warn: () => {}
      };

      const commandService = new CommandService(serviceManager, {
        discord: null, // Would be Discord service in real scenario
        logger: mockLogger
      });

      const commands = Array.from(commandService.commands.keys());
      console.log(`✅ CommandService initialized with ${commands.length} commands`);
      
      // Check if check-summaries exists
      const hasCheckSummaries = commands.includes('check-summaries');
      if (hasCheckSummaries) {
        console.log('✅ /check-summaries command: FOUND');
        results.passed.push('Command Registration - check-summaries');
      } else {
        console.log('❌ /check-summaries command: MISSING');
        results.failed.push('Command Registration - check-summaries');
      }

      // List all commands
      console.log('\n📋 Registered Commands:');
      commands.forEach(cmd => {
        console.log(`   • /${cmd}`);
      });

      results.passed.push('Command Service Initialization');
    } catch (error) {
      console.log(`❌ CommandService initialization: FAILED - ${error.message}`);
      results.failed.push('Command Service Initialization');
    }

    // ==========================================
    // 5. SUMMARY SERVICE PERFORMANCE
    // ==========================================
    console.log('\n5️⃣ SUMMARY SERVICE PERFORMANCE TEST');
    console.log('-'.repeat(70));

    const testTranscript = 'This is a test video about AI. It covers machine learning basics.';
    const start = Date.now();
    
    try {
      const testSummary = await summary.generateSummary(
        testTranscript,
        'Test Video',
        'https://youtube.com/test',
        null
      );
      
      const duration = Date.now() - start;
      console.log(`✅ Summary generation: ${(duration/1000).toFixed(2)}s`);
      console.log(`✅ Summary length: ${testSummary.summary.length} chars`);
      
      if (duration < 60000) { // Under 60 seconds
        results.passed.push('Summary Performance');
      } else {
        results.warnings.push('Summary generation slow (>60s)');
      }
    } catch (error) {
      console.log(`❌ Summary generation: FAILED - ${error.message}`);
      results.failed.push('Summary Performance');
    }

    // ==========================================
    // 6. FILE SYSTEM CHECK
    // ==========================================
    console.log('\n6️⃣ FILE SYSTEM CHECK');
    console.log('-'.repeat(70));

    const cacheDir = path.join(process.cwd(), 'cache');
    try {
      await fs.access(cacheDir);
      const files = await fs.readdir(cacheDir);
      console.log(`✅ Cache directory: Accessible (${files.length} files)`);
      results.passed.push('File System Access');
    } catch (error) {
      console.log(`❌ Cache directory: ${error.message}`);
      results.failed.push('File System Access');
    }

    // ==========================================
    // 7. CONFIGURATION CHECK
    // ==========================================
    console.log('\n7️⃣ CONFIGURATION CHECK');
    console.log('-'.repeat(70));

    const config = serviceManager.config;
    
    const checks = [
      { name: 'OpenAI API Key', value: !!config.openai.apiKey, critical: true },
      { name: 'OpenAI Model', value: config.openai.model, critical: true },
      { name: 'Max Tokens', value: config.openai.maxTokens, critical: false },
      { name: 'Discord Token', value: !!config.discord.token, critical: true },
      { name: 'Guild ID', value: !!config.discord.guildId, critical: true }
    ];

    checks.forEach(check => {
      const status = check.value ? '✅' : '❌';
      console.log(`${status} ${check.name}: ${check.value || 'NOT SET'}`);
      
      if (!check.value && check.critical) {
        results.failed.push(`Config: ${check.name}`);
      } else if (check.value) {
        results.passed.push(`Config: ${check.name}`);
      }
    });

    // ==========================================
    // FINAL REPORT
    // ==========================================
    console.log('\n\n' + '='.repeat(70));
    console.log('📊 DIAGNOSTIC RESULTS');
    console.log('='.repeat(70));

    console.log(`\n✅ PASSED: ${results.passed.length} tests`);
    results.passed.forEach(test => console.log(`   • ${test}`));

    if (results.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS: ${results.warnings.length}`);
      results.warnings.forEach(warn => console.log(`   • ${warn}`));
    }

    if (results.failed.length > 0) {
      console.log(`\n❌ FAILED: ${results.failed.length} tests`);
      results.failed.forEach(fail => console.log(`   • ${fail}`));
    }

    // ==========================================
    // RECOMMENDATIONS
    // ==========================================
    console.log('\n' + '='.repeat(70));
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(70));

    if (results.failed.length === 0) {
      console.log('✅ All critical tests passed!');
      console.log('✅ Bot is healthy and ready for use.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix:');
      results.failed.forEach(fail => console.log(`   • ${fail}`));
    }

    if (results.warnings.length > 0) {
      console.log('\n⚠️  Warnings to consider:');
      results.warnings.forEach(warn => console.log(`   • ${warn}`));
    }

    console.log('\n📋 Specific Issues:');
    
    if (recentSummaries.length === 0) {
      console.log('• /check-summaries may show empty results');
      console.log('  → Solution: Process some YouTube videos first');
    }

    console.log('\n🎯 To test /check-summaries:');
    console.log('  1. Post a YouTube link in Discord');
    console.log('  2. Wait for summary to generate');
    console.log('  3. Run /check-summaries');
    console.log('  4. Should show the processed video\n');

    // Overall health score
    const totalTests = results.passed.length + results.failed.length;
    const healthScore = ((results.passed.length / totalTests) * 100).toFixed(1);
    
    console.log('='.repeat(70));
    console.log(`🏥 OVERALL HEALTH SCORE: ${healthScore}%`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run diagnostics
runComprehensiveDiagnostics();
