/**
 * Comprehensive Transcript Testing Suite
 * Tests all transcript extraction methods and provides detailed diagnostics
 */

require('dotenv').config();
const { robustTranscriptService } = require('../src/services/robust-transcript.service');
const { HerokuTranscriptOptimizer } = require('../scripts/heroku-transcript-setup');

class TranscriptTester {
  constructor() {
    this.testVideos = [
      {
        id: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        expectedLength: 1000, // Minimum expected transcript length
        hasSubtitles: true
      },
      {
        id: 'jNQXAC9IVRw',
        title: 'Me at the zoo',
        expectedLength: 100,
        hasSubtitles: true
      },
      {
        id: '9bZkp7q19f0',
        title: 'PSY - GANGNAM STYLE',
        expectedLength: 500,
        hasSubtitles: true
      }
    ];
    
    this.results = {
      environment: {},
      methods: {},
      videos: {},
      recommendations: [],
      overall: false
    };
  }

  async runComprehensiveTest() {
    console.log('🧪 Starting Comprehensive Transcript Testing Suite...');
    console.log('='.repeat(60));

    try {
      // 1. Environment checks
      await this.testEnvironment();
      
      // 2. Service initialization
      await this.testServiceInitialization();
      
      // 3. Method-specific tests
      await this.testExtractionMethods();
      
      // 4. End-to-end video tests
      await this.testVideoExtraction();
      
      // 5. Performance tests
      await this.testPerformance();
      
      // 6. Generate recommendations
      this.generateRecommendations();
      
      // 7. Summary report
      this.generateSummaryReport();

    } catch (error) {
      console.error('💥 Test suite failed:', error.message);
      this.results.overall = false;
    }

    return this.results;
  }

  async testEnvironment() {
    console.log('\n🔍 Testing Environment...');
    
    const envTests = {
      node: this.testNodeEnvironment(),
      heroku: this.testHerokuEnvironment(),
      dependencies: this.testDependencies(),
      permissions: this.testPermissions()
    };

    for (const [testName, testPromise] of Object.entries(envTests)) {
      try {
        this.results.environment[testName] = await testPromise;
        const status = this.results.environment[testName].success ? '✅' : '❌';
        console.log(`  ${status} ${testName}: ${this.results.environment[testName].message}`);
      } catch (error) {
        this.results.environment[testName] = { success: false, error: error.message };
        console.log(`  ❌ ${testName}: ${error.message}`);
      }
    }
  }

  async testNodeEnvironment() {
    const nodeVersion = process.version;
    const platform = process.platform;
    const arch = process.arch;
    const memory = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);

    return {
      success: true,
      message: `Node ${nodeVersion} on ${platform}-${arch}, ${memory}MB heap`,
      details: { nodeVersion, platform, arch, memory }
    };
  }

  async testHerokuEnvironment() {
    const isHeroku = !!process.env.DYNO;
    
    if (!isHeroku) {
      return { success: true, message: 'Local environment' };
    }

    const optimizer = new HerokuTranscriptOptimizer();
    const setupResults = await optimizer.setupHerokuEnvironment();
    
    return {
      success: setupResults.overall || false,
      message: setupResults.overall ? 'Heroku environment ready' : 'Heroku setup incomplete',
      details: setupResults
    };
  }

  async testDependencies() {
    const dependencies = ['yt-dlp', 'python3', 'ffmpeg'];
    const results = {};
    
    for (const dep of dependencies) {
      try {
        const { exec } = require('child_process');
        const util = require('util');
        const execAsync = util.promisify(exec);
        
        const { stdout } = await execAsync(`which ${dep}`);
        results[dep] = { available: true, path: stdout.trim() };
      } catch (error) {
        results[dep] = { available: false, error: error.message };
      }
    }

    const availableCount = Object.values(results).filter(r => r.available).length;
    
    return {
      success: availableCount >= 2, // At least 2 out of 3
      message: `${availableCount}/${dependencies.length} dependencies available`,
      details: results
    };
  }

  async testPermissions() {
    const fs = require('fs').promises;
    const path = require('path');
    
    const testDirs = ['/tmp', './temp', process.env.HOME || '/app'];
    const results = {};

    for (const dir of testDirs) {
      try {
        const testPath = path.join(dir, 'transcript-test');
        await fs.mkdir(testPath, { recursive: true });
        await fs.writeFile(path.join(testPath, 'test.txt'), 'test');
        await fs.unlink(path.join(testPath, 'test.txt'));
        await fs.rmdir(testPath);
        
        results[dir] = { writable: true };
      } catch (error) {
        results[dir] = { writable: false, error: error.message };
      }
    }

    const writableCount = Object.values(results).filter(r => r.writable).length;
    
    return {
      success: writableCount > 0,
      message: `${writableCount}/${testDirs.length} directories writable`,
      details: results
    };
  }

  async testServiceInitialization() {
    console.log('\n🚀 Testing Service Initialization...');
    
    try {
      await robustTranscriptService.initialize();
      const health = await robustTranscriptService.healthCheck();
      
      this.results.service = {
        success: health.status === 'healthy',
        message: `Service ${health.status}`,
        details: health
      };
      
      const status = this.results.service.success ? '✅' : '❌';
      console.log(`  ${status} Service: ${this.results.service.message}`);
      
    } catch (error) {
      this.results.service = { success: false, error: error.message };
      console.log(`  ❌ Service: ${error.message}`);
    }
  }

  async testExtractionMethods() {
    console.log('\n🔧 Testing Extraction Methods...');
    
    const methods = [
      { name: 'yt-dlp', test: () => this.testYtDlpMethod() },
      { name: 'npm-package', test: () => this.testNpmPackageMethod() },
      { name: 'direct-scraping', test: () => this.testDirectScrapingMethod() }
    ];

    for (const method of methods) {
      try {
        this.results.methods[method.name] = await method.test();
        const status = this.results.methods[method.name].success ? '✅' : '❌';
        console.log(`  ${status} ${method.name}: ${this.results.methods[method.name].message}`);
      } catch (error) {
        this.results.methods[method.name] = { success: false, error: error.message };
        console.log(`  ❌ ${method.name}: ${error.message}`);
      }
    }
  }

  async testYtDlpMethod() {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    if (!robustTranscriptService.ytDlpCmd) {
      return { success: false, message: 'yt-dlp not available' };
    }

    try {
      const testCmd = `${robustTranscriptService.ytDlpCmd} --version`;
      const { stdout } = await execAsync(testCmd, { timeout: 10000 });
      
      return {
        success: true,
        message: `yt-dlp v${stdout.trim()} working`,
        version: stdout.trim()
      };
    } catch (error) {
      return { success: false, message: 'yt-dlp test failed', error: error.message };
    }
  }

  async testNpmPackageMethod() {
    try {
      const { YoutubeTranscript } = require('youtube-transcript');
      
      // Test with a simple video
      const transcript = await Promise.race([
        YoutubeTranscript.fetchTranscript('dQw4w9WgXcQ', { lang: 'en' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 15000))
      ]);
      
      return {
        success: transcript && transcript.length > 0,
        message: `npm package working (${transcript?.length || 0} segments)`,
        segmentCount: transcript?.length || 0
      };
    } catch (error) {
      return { success: false, message: 'npm package test failed', error: error.message };
    }
  }

  async testDirectScrapingMethod() {
    try {
      const https = require('https');
      
      // Test if we can fetch YouTube page
      const pageData = await new Promise((resolve, reject) => {
        const req = https.get('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Bot/1.0)' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        });
        
        req.on('error', reject);
        req.setTimeout(15000, () => {
          req.abort();
          reject(new Error('timeout'));
        });
      });
      
      const hasPlayerResponse = pageData.includes('ytInitialPlayerResponse');
      
      return {
        success: hasPlayerResponse,
        message: hasPlayerResponse ? 'Direct scraping possible' : 'YouTube page structure changed',
        pageSize: Math.round(pageData.length / 1024) + 'KB'
      };
    } catch (error) {
      return { success: false, message: 'Direct scraping test failed', error: error.message };
    }
  }

  async testVideoExtraction() {
    console.log('\n🎬 Testing Video Extraction...');
    
    for (const video of this.testVideos) {
      try {
        console.log(`  Testing: ${video.title} (${video.id})`);
        
        const startTime = Date.now();
        const transcript = await robustTranscriptService.getTranscript(video.id, { skipCache: true });
        const duration = Date.now() - startTime;
        
        const success = transcript && transcript.length >= video.expectedLength;
        this.results.videos[video.id] = {
          success,
          message: success ? `Extracted ${transcript.length} chars in ${duration}ms` : 'Extraction failed',
          transcript: transcript ? transcript.substring(0, 200) + '...' : null,
          duration,
          length: transcript?.length || 0
        };
        
        const status = success ? '✅' : '❌';
        console.log(`    ${status} ${this.results.videos[video.id].message}`);
        
      } catch (error) {
        this.results.videos[video.id] = { success: false, error: error.message };
        console.log(`    ❌ ${error.message}`);
      }
    }
  }

  async testPerformance() {
    console.log('\n⚡ Testing Performance...');
    
    const performanceTests = {
      memory: this.testMemoryUsage(),
      concurrent: this.testConcurrentExtractions(),
      cache: this.testCachePerformance()
    };

    for (const [testName, testPromise] of Object.entries(performanceTests)) {
      try {
        this.results.performance = this.results.performance || {};
        this.results.performance[testName] = await testPromise;
        
        const status = this.results.performance[testName].success ? '✅' : '❌';
        console.log(`  ${status} ${testName}: ${this.results.performance[testName].message}`);
      } catch (error) {
        this.results.performance = this.results.performance || {};
        this.results.performance[testName] = { success: false, error: error.message };
        console.log(`  ❌ ${testName}: ${error.message}`);
      }
    }
  }

  async testMemoryUsage() {
    const initialMemory = process.memoryUsage();
    
    try {
      // Extract a transcript and measure memory change
      await robustTranscriptService.getTranscript('dQw4w9WgXcQ');
      const finalMemory = process.memoryUsage();
      
      const memoryIncrease = Math.round((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024);
      
      return {
        success: memoryIncrease < 50, // Less than 50MB increase
        message: `Memory increase: ${memoryIncrease}MB`,
        details: { initial: initialMemory, final: finalMemory, increase: memoryIncrease }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testConcurrentExtractions() {
    try {
      const startTime = Date.now();
      const promises = [
        robustTranscriptService.getTranscript('dQw4w9WgXcQ'),
        robustTranscriptService.getTranscript('jNQXAC9IVRw')
      ];
      
      const results = await Promise.allSettled(promises);
      const duration = Date.now() - startTime;
      
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      
      return {
        success: successCount >= 1,
        message: `${successCount}/2 concurrent extractions in ${duration}ms`,
        details: { successCount, duration, results: results.map(r => r.status) }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testCachePerformance() {
    try {
      const videoId = 'dQw4w9WgXcQ';
      
      // First extraction (should cache)
      const start1 = Date.now();
      await robustTranscriptService.getTranscript(videoId);
      const duration1 = Date.now() - start1;
      
      // Second extraction (should use cache)
      const start2 = Date.now();
      await robustTranscriptService.getTranscript(videoId);
      const duration2 = Date.now() - start2;
      
      const cacheSpeedup = duration1 / Math.max(duration2, 1);
      
      return {
        success: cacheSpeedup > 2, // At least 2x faster
        message: `Cache speedup: ${cacheSpeedup.toFixed(1)}x (${duration1}ms → ${duration2}ms)`,
        details: { duration1, duration2, speedup: cacheSpeedup }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  generateRecommendations() {
    console.log('\n💡 Generating Recommendations...');
    
    // Analyze results and generate recommendations
    const recommendations = [];
    
    // Environment recommendations
    if (!this.results.environment?.dependencies?.success) {
      recommendations.push({
        priority: 'high',
        category: 'dependencies',
        message: 'Install missing system dependencies (yt-dlp, python3, ffmpeg)',
        action: 'Update Aptfile and requirements.txt'
      });
    }
    
    // Service recommendations
    if (!this.results.service?.success) {
      recommendations.push({
        priority: 'high',
        category: 'service',
        message: 'Transcript service initialization failed',
        action: 'Check logs and verify yt-dlp installation'
      });
    }
    
    // Method recommendations
    const workingMethods = Object.values(this.results.methods || {}).filter(m => m.success).length;
    if (workingMethods === 0) {
      recommendations.push({
        priority: 'critical',
        category: 'methods',
        message: 'No transcript extraction methods working',
        action: 'Check network connectivity and YouTube accessibility'
      });
    } else if (workingMethods === 1) {
      recommendations.push({
        priority: 'medium',
        category: 'methods',
        message: 'Only one extraction method working',
        action: 'Set up additional methods for redundancy'
      });
    }
    
    // Performance recommendations
    if (this.results.performance?.memory && !this.results.performance.memory.success) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        message: 'High memory usage detected',
        action: 'Use larger Heroku dyno or optimize extraction process'
      });
    }
    
    // Heroku-specific recommendations
    if (process.env.DYNO) {
      recommendations.push({
        priority: 'low',
        category: 'heroku',
        message: 'Running on Heroku',
        action: 'Monitor rate limits and consider using proxy for blocked regions'
      });
    }
    
    this.results.recommendations = recommendations;
    
    for (const rec of recommendations) {
      const emoji = rec.priority === 'critical' ? '🚨' : rec.priority === 'high' ? '⚠️' : '💡';
      console.log(`  ${emoji} [${rec.priority.toUpperCase()}] ${rec.message}`);
      console.log(`     Action: ${rec.action}`);
    }
  }

  generateSummaryReport() {
    console.log('\n📊 Test Summary Report');
    console.log('='.repeat(60));
    
    // Calculate overall success
    const envSuccess = Object.values(this.results.environment || {}).every(r => r.success);
    const serviceSuccess = this.results.service?.success || false;
    const methodsSuccess = Object.values(this.results.methods || {}).some(m => m.success);
    const videosSuccess = Object.values(this.results.videos || {}).some(v => v.success);
    
    this.results.overall = envSuccess && serviceSuccess && methodsSuccess && videosSuccess;
    
    const overallStatus = this.results.overall ? '✅ PASS' : '❌ FAIL';
    console.log(`Overall Status: ${overallStatus}`);
    
    console.log('\nComponent Status:');
    console.log(`  Environment: ${envSuccess ? '✅' : '❌'}`);
    console.log(`  Service: ${serviceSuccess ? '✅' : '❌'}`);
    console.log(`  Methods: ${methodsSuccess ? '✅' : '❌'}`);
    console.log(`  Videos: ${videosSuccess ? '✅' : '❌'}`);
    
    // Success rates
    const methodSuccessRate = this.calculateSuccessRate(this.results.methods);
    const videoSuccessRate = this.calculateSuccessRate(this.results.videos);
    
    console.log('\nSuccess Rates:');
    console.log(`  Extraction Methods: ${methodSuccessRate}%`);
    console.log(`  Video Tests: ${videoSuccessRate}%`);
    
    // Critical issues
    const criticalIssues = this.results.recommendations?.filter(r => r.priority === 'critical').length || 0;
    if (criticalIssues > 0) {
      console.log(`\n🚨 Critical Issues: ${criticalIssues}`);
    }
    
    console.log(`\nTotal Recommendations: ${this.results.recommendations?.length || 0}`);
    console.log('\nFor detailed results, check the returned results object.');
  }

  calculateSuccessRate(results) {
    if (!results || Object.keys(results).length === 0) return 0;
    
    const total = Object.keys(results).length;
    const successful = Object.values(results).filter(r => r.success).length;
    
    return Math.round((successful / total) * 100);
  }
}

// Export for use in other modules
module.exports = { TranscriptTester };

// Run tests if called directly
if (require.main === module) {
  const tester = new TranscriptTester();
  
  console.log('🎯 YouTube Transcript Extraction - Comprehensive Test Suite');
  console.log('Testing all extraction methods and providing diagnostic information...\n');
  
  tester.runComprehensiveTest()
    .then(results => {
      console.log('\n🏁 Testing completed!');
      
      if (results.overall) {
        console.log('🎉 All systems operational! Transcript extraction should work reliably.');
      } else {
        console.log('⚠️ Issues detected. Review recommendations above.');
        console.log('📞 For Heroku deployment issues, run: node scripts/heroku-transcript-setup.js');
      }
      
      process.exit(results.overall ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test suite crashed:', error);
      process.exit(1);
    });
}
