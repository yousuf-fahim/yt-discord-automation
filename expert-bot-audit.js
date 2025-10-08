/**
 * Comprehensive Discord Bot Health Check & Audit
 * Expert-level analysis of all services and components
 */

const fs = require('fs');
const path = require('path');
const ServiceManager = require('./src/core/service-manager');

class BotAuditExpert {
  constructor() {
    this.auditResults = {
      services: {},
      integrations: {},
      configurations: {},
      database: {},
      issues: [],
      recommendations: []
    };
  }

  async performComprehensiveAudit() {
    console.log('🔍 DISCORD BOT EXPERT AUDIT - COMPREHENSIVE ANALYSIS\n');
    console.log('=' .repeat(60));

    // 1. Architecture Analysis
    await this.auditArchitecture();
    
    // 2. Service Dependencies
    await this.auditServiceDependencies();
    
    // 3. Configuration Validation
    await this.auditConfiguration();
    
    // 4. Database Integrity
    await this.auditDatabase();
    
    // 5. Discord Integration
    await this.auditDiscordIntegration();
    
    // 6. Performance & Reliability
    await this.auditPerformance();
    
    // 7. Security Analysis
    await this.auditSecurity();
    
    // 8. Error Handling
    await this.auditErrorHandling();

    // Generate final report
    this.generateAuditReport();
  }

  async auditArchitecture() {
    console.log('\n📐 ARCHITECTURE ANALYSIS');
    console.log('-'.repeat(40));

    const serviceFiles = this.scanServiceFiles();
    console.log(`✅ Found ${serviceFiles.length} service files`);

    // Check service manager pattern
    const hasServiceManager = fs.existsSync('./src/core/service-manager.js');
    console.log(`${hasServiceManager ? '✅' : '❌'} Service Manager: ${hasServiceManager ? 'Present' : 'Missing'}`);

    // Check dependency injection
    this.auditResults.services.architecture = {
      serviceCount: serviceFiles.length,
      hasServiceManager,
      services: serviceFiles
    };

    // Validate service structure
    for (const serviceFile of serviceFiles) {
      await this.validateServiceStructure(serviceFile);
    }
  }

  scanServiceFiles() {
    const servicesDir = './src/services';
    if (!fs.existsSync(servicesDir)) return [];
    
    return fs.readdirSync(servicesDir)
      .filter(file => file.endsWith('.service.js'))
      .map(file => file.replace('.service.js', ''));
  }

  async validateServiceStructure(serviceName) {
    const filePath = `./src/services/${serviceName}.service.js`;
    const content = fs.readFileSync(filePath, 'utf8');
    
    const checks = {
      hasConstructor: content.includes('constructor('),
      hasInitialize: content.includes('initialize(') || content.includes('async initialize'),
      hasErrorHandling: content.includes('try {') && content.includes('catch'),
      hasLogging: content.includes('this.logger'),
      hasServiceManager: content.includes('serviceManager'),
    };

    const score = Object.values(checks).filter(Boolean).length;
    const status = score >= 4 ? '✅' : score >= 2 ? '⚠️' : '❌';
    
    console.log(`  ${status} ${serviceName}: ${score}/5 checks passed`);
    
    if (score < 4) {
      this.auditResults.issues.push(`Service ${serviceName} missing critical patterns (score: ${score}/5)`);
    }
  }

  async auditServiceDependencies() {
    console.log('\n🔗 SERVICE DEPENDENCIES');
    console.log('-'.repeat(40));

    const dependencies = {
      'discord': ['transcript', 'summary', 'report'],
      'report': ['summary', 'cache', 'database'],
      'summary': ['cache'],
      'transcript': ['cache'],
      'cache': [],
      'database': []
    };

    for (const [service, deps] of Object.entries(dependencies)) {
      const serviceFile = `./src/services/${service}.service.js`;
      if (!fs.existsSync(serviceFile)) {
        console.log(`❌ Missing service: ${service}`);
        this.auditResults.issues.push(`Critical service missing: ${service}`);
        continue;
      }

      const content = fs.readFileSync(serviceFile, 'utf8');
      const missingDeps = deps.filter(dep => !content.includes(dep));
      
      if (missingDeps.length === 0) {
        console.log(`✅ ${service}: All dependencies present`);
      } else {
        console.log(`⚠️ ${service}: Missing dependencies - ${missingDeps.join(', ')}`);
        this.auditResults.issues.push(`${service} service missing dependencies: ${missingDeps.join(', ')}`);
      }
    }
  }

  async auditConfiguration() {
    console.log('\n⚙️ CONFIGURATION VALIDATION');
    console.log('-'.repeat(40));

    const requiredEnvVars = [
      'DISCORD_BOT_TOKEN',
      'DISCORD_GUILD_ID', 
      'OPENAI_API_KEY'
    ];

    const optionalEnvVars = [
      'VPS_TRANSCRIPT_API_URL',
      'RAPIDAPI_KEY',
      'YOUTUBE_API_KEY',
      'DAILY_REPORT_HOUR',
      'DAILY_REPORT_PROMPT_PREFIX'
    ];

    console.log('Required Environment Variables:');
    let missingRequired = 0;
    for (const envVar of requiredEnvVars) {
      const exists = process.env[envVar] ? true : false;
      console.log(`  ${exists ? '✅' : '❌'} ${envVar}: ${exists ? 'Set' : 'Missing'}`);
      if (!exists) {
        missingRequired++;
        this.auditResults.issues.push(`Missing required environment variable: ${envVar}`);
      }
    }

    console.log('\nOptional Environment Variables:');
    let optionalCount = 0;
    for (const envVar of optionalEnvVars) {
      const exists = process.env[envVar] ? true : false;
      console.log(`  ${exists ? '✅' : '⚪'} ${envVar}: ${exists ? 'Set' : 'Not set'}`);
      if (exists) optionalCount++;
    }

    console.log(`\n📊 Configuration Score: ${requiredEnvVars.length - missingRequired}/${requiredEnvVars.length} required, ${optionalCount}/${optionalEnvVars.length} optional`);

    if (missingRequired > 0) {
      this.auditResults.issues.push(`${missingRequired} required environment variables missing - bot may not function`);
    }
  }

  async auditDatabase() {
    console.log('\n🗄️ DATABASE INTEGRITY');
    console.log('-'.repeat(40));

    const dbPath = './data/bot.db';
    if (!fs.existsSync(dbPath)) {
      console.log('❌ Database file missing');
      this.auditResults.issues.push('Database file does not exist');
      return;
    }

    console.log('✅ Database file exists');

    // Check database using SQLite directly
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database(dbPath);

    const tables = await this.getDatabaseTables(db);
    console.log(`✅ Found ${tables.length} tables: ${tables.join(', ')}`);

    const expectedTables = ['summaries', 'transcripts', 'daily_reports', 'weekly_reports', 'monthly_reports', 'video_metadata', 'analytics', 'system_logs'];
    const missingTables = expectedTables.filter(table => !tables.includes(table));
    
    if (missingTables.length > 0) {
      console.log(`⚠️ Missing tables: ${missingTables.join(', ')}`);
      this.auditResults.issues.push(`Missing database tables: ${missingTables.join(', ')}`);
    }

    // Check data integrity
    for (const table of ['summaries', 'transcripts']) {
      if (tables.includes(table)) {
        const count = await this.getTableCount(db, table);
        console.log(`📊 ${table}: ${count} records`);
        
        if (count === 0) {
          this.auditResults.recommendations.push(`${table} table is empty - consider testing with sample data`);
        }
      }
    }

    db.close();
  }

  async getDatabaseTables(db) {
    return new Promise((resolve, reject) => {
      db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => row.name));
      });
    });
  }

  async getTableCount(db, tableName) {
    return new Promise((resolve, reject) => {
      db.get(`SELECT COUNT(*) as count FROM ${tableName}`, [], (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }

  async auditDiscordIntegration() {
    console.log('\n🤖 DISCORD INTEGRATION');
    console.log('-'.repeat(40));

    const discordServiceFile = './src/services/discord.service.js';
    if (!fs.existsSync(discordServiceFile)) {
      console.log('❌ Discord service missing');
      this.auditResults.issues.push('Discord service file not found');
      return;
    }

    const content = fs.readFileSync(discordServiceFile, 'utf8');

    // Check Discord.js patterns
    const discordChecks = {
      'Client Setup': content.includes('new Client('),
      'Intent Configuration': content.includes('GatewayIntentBits'),
      'Event Handlers': content.includes('Events.') || content.includes('.on('),
      'Slash Commands': content.includes('SlashCommandBuilder') || content.includes('commands'),
      'Error Handling': content.includes('catch') && content.includes('error'),
      'Message Processing': content.includes('messageCreate') || content.includes('message'),
      'YouTube Link Detection': content.includes('youtube.com') || content.includes('youtu.be'),
      'Reaction Management': content.includes('react('),
      'Channel Management': content.includes('channels.cache'),
      'Permission Handling': content.includes('permissions') || content.includes('guild')
    };

    console.log('Discord Integration Checks:');
    let passedChecks = 0;
    for (const [check, passed] of Object.entries(discordChecks)) {
      console.log(`  ${passed ? '✅' : '❌'} ${check}`);
      if (passed) passedChecks++;
      else {
        this.auditResults.issues.push(`Discord integration missing: ${check}`);
      }
    }

    console.log(`\n📊 Discord Integration Score: ${passedChecks}/${Object.keys(discordChecks).length}`);

    if (passedChecks < 8) {
      this.auditResults.issues.push('Discord integration incomplete - critical functionality missing');
    }
  }

  async auditPerformance() {
    console.log('\n⚡ PERFORMANCE & RELIABILITY');
    console.log('-'.repeat(40));

    const performanceChecks = [
      this.checkCaching(),
      this.checkRateLimiting(),
      this.checkMemoryManagement(),
      this.checkAsyncPatterns()
    ];

    for (const check of performanceChecks) {
      await check;
    }
  }

  checkCaching() {
    const cacheService = './src/services/cache.service.js';
    const hasCaching = fs.existsSync(cacheService);
    console.log(`${hasCaching ? '✅' : '❌'} Caching Service: ${hasCaching ? 'Present' : 'Missing'}`);
    
    if (hasCaching) {
      const content = fs.readFileSync(cacheService, 'utf8');
      const hasExpiration = content.includes('expire') || content.includes('ttl') || content.includes('timeout');
      console.log(`${hasExpiration ? '✅' : '⚠️'} Cache Expiration: ${hasExpiration ? 'Implemented' : 'Not implemented'}`);
      
      if (!hasExpiration) {
        this.auditResults.recommendations.push('Implement cache expiration to prevent memory bloat');
      }
    } else {
      this.auditResults.issues.push('No caching service - performance may be poor');
    }
  }

  checkRateLimiting() {
    // Check for Discord rate limiting
    const discordFile = './src/services/discord.service.js';
    if (fs.existsSync(discordFile)) {
      const content = fs.readFileSync(discordFile, 'utf8');
      const hasRateLimit = content.includes('rate') || content.includes('limit') || content.includes('throttle');
      console.log(`${hasRateLimit ? '✅' : '⚠️'} Rate Limiting: ${hasRateLimit ? 'Present' : 'Not detected'}`);
      
      if (!hasRateLimit) {
        this.auditResults.recommendations.push('Implement rate limiting to prevent API abuse');
      }
    }
  }

  checkMemoryManagement() {
    // Check for memory cleanup patterns
    const files = this.getAllServiceFiles();
    let hasCleanup = false;
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('cleanup') || content.includes('clear') || content.includes('setInterval')) {
        hasCleanup = true;
        break;
      }
    }
    
    console.log(`${hasCleanup ? '✅' : '⚠️'} Memory Management: ${hasCleanup ? 'Cleanup detected' : 'No cleanup patterns'}`);
    
    if (!hasCleanup) {
      this.auditResults.recommendations.push('Implement periodic cleanup to prevent memory leaks');
    }
  }

  checkAsyncPatterns() {
    const files = this.getAllServiceFiles();
    let hasProperAsync = true;
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      // Check for await without async, or missing error handling
      const awaitCount = (content.match(/await /g) || []).length;
      const asyncCount = (content.match(/async /g) || []).length;
      const tryCount = (content.match(/try {/g) || []).length;
      
      if (awaitCount > 0 && (asyncCount === 0 || tryCount === 0)) {
        hasProperAsync = false;
        this.auditResults.issues.push(`Improper async patterns in ${path.basename(file)}`);
      }
    }
    
    console.log(`${hasProperAsync ? '✅' : '❌'} Async Patterns: ${hasProperAsync ? 'Proper' : 'Issues detected'}`);
  }

  getAllServiceFiles() {
    const servicesDir = './src/services';
    if (!fs.existsSync(servicesDir)) return [];
    
    return fs.readdirSync(servicesDir)
      .filter(file => file.endsWith('.js'))
      .map(file => path.join(servicesDir, file));
  }

  async auditSecurity() {
    console.log('\n🔒 SECURITY ANALYSIS');
    console.log('-'.repeat(40));

    const securityChecks = [
      this.checkTokenSecurity(),
      this.checkInputValidation(),
      this.checkPermissions(),
      this.checkDataSanitization()
    ];

    for (const check of securityChecks) {
      await check;
    }
  }

  checkTokenSecurity() {
    // Check if tokens are properly handled
    const files = this.getAllServiceFiles();
    let hasHardcodedTokens = false;
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('process.env') && content.includes('TOKEN')) {
        // Good - using environment variables
        continue;
      }
      if (content.match(/['"]bot|sk-|ghp_|gho_/i)) {
        hasHardcodedTokens = true;
        this.auditResults.issues.push(`Potential hardcoded token in ${path.basename(file)}`);
      }
    }
    
    console.log(`${!hasHardcodedTokens ? '✅' : '❌'} Token Security: ${!hasHardcodedTokens ? 'Secure' : 'Issues detected'}`);
  }

  checkInputValidation() {
    const discordFile = './src/services/discord.service.js';
    if (fs.existsSync(discordFile)) {
      const content = fs.readFileSync(discordFile, 'utf8');
      const hasValidation = content.includes('validate') || content.includes('sanitize') || content.includes('escape');
      console.log(`${hasValidation ? '✅' : '⚠️'} Input Validation: ${hasValidation ? 'Present' : 'Not detected'}`);
      
      if (!hasValidation) {
        this.auditResults.recommendations.push('Implement input validation for user messages');
      }
    }
  }

  checkPermissions() {
    const discordFile = './src/services/discord.service.js';
    if (fs.existsSync(discordFile)) {
      const content = fs.readFileSync(discordFile, 'utf8');
      const hasPermissions = content.includes('permissions') || content.includes('roles') || content.includes('member');
      console.log(`${hasPermissions ? '✅' : '⚠️'} Permission Checks: ${hasPermissions ? 'Present' : 'Not detected'}`);
      
      if (!hasPermissions) {
        this.auditResults.recommendations.push('Implement permission checks for sensitive commands');
      }
    }
  }

  checkDataSanitization() {
    const files = this.getAllServiceFiles();
    let hasSanitization = false;
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('sanitize') || content.includes('escape') || content.includes('clean')) {
        hasSanitization = true;
        break;
      }
    }
    
    console.log(`${hasSanitization ? '✅' : '⚠️'} Data Sanitization: ${hasSanitization ? 'Present' : 'Not detected'}`);
    
    if (!hasSanitization) {
      this.auditResults.recommendations.push('Implement data sanitization for external content');
    }
  }

  async auditErrorHandling() {
    console.log('\n🚨 ERROR HANDLING');
    console.log('-'.repeat(40));

    const files = this.getAllServiceFiles();
    let totalTryBlocks = 0;
    let totalCatchBlocks = 0;
    let filesWithoutErrorHandling = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const tryCount = (content.match(/try {/g) || []).length;
      const catchCount = (content.match(/catch/g) || []).length;
      
      totalTryBlocks += tryCount;
      totalCatchBlocks += catchCount;
      
      if (tryCount === 0 && content.includes('async')) {
        filesWithoutErrorHandling.push(path.basename(file));
      }
    }
    
    console.log(`📊 Try/Catch blocks: ${totalTryBlocks} try, ${totalCatchBlocks} catch`);
    
    if (filesWithoutErrorHandling.length > 0) {
      console.log(`⚠️ Files without error handling: ${filesWithoutErrorHandling.join(', ')}`);
      this.auditResults.issues.push(`Services missing error handling: ${filesWithoutErrorHandling.join(', ')}`);
    } else {
      console.log('✅ All services have error handling');
    }
    
    // Check for global error handlers
    const mainFile = './src/main.js';
    if (fs.existsSync(mainFile)) {
      const content = fs.readFileSync(mainFile, 'utf8');
      const hasGlobalHandler = content.includes('uncaughtException') || content.includes('unhandledRejection');
      console.log(`${hasGlobalHandler ? '✅' : '⚠️'} Global Error Handler: ${hasGlobalHandler ? 'Present' : 'Missing'}`);
      
      if (!hasGlobalHandler) {
        this.auditResults.recommendations.push('Add global error handlers for uncaught exceptions');
      }
    }
  }

  generateAuditReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 COMPREHENSIVE AUDIT REPORT');
    console.log('='.repeat(60));

    // Summary
    const issueCount = this.auditResults.issues.length;
    const recommendationCount = this.auditResults.recommendations.length;
    
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Critical Issues: ${issueCount}`);
    console.log(`   Recommendations: ${recommendationCount}`);
    
    const overallHealth = issueCount === 0 ? 'EXCELLENT' : 
                         issueCount <= 3 ? 'GOOD' : 
                         issueCount <= 6 ? 'FAIR' : 'POOR';
    
    console.log(`   Overall Health: ${overallHealth}`);

    // Issues
    if (issueCount > 0) {
      console.log(`\n🚨 CRITICAL ISSUES TO FIX:`);
      this.auditResults.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }

    // Recommendations
    if (recommendationCount > 0) {
      console.log(`\n💡 RECOMMENDATIONS:`);
      this.auditResults.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    // Next Steps
    console.log(`\n🚀 NEXT STEPS:`);
    if (issueCount > 0) {
      console.log(`   1. Fix critical issues (${issueCount} items)`);
      console.log(`   2. Test bot functionality`);
      console.log(`   3. Implement recommendations`);
    } else {
      console.log(`   1. Implement recommendations for optimization`);
      console.log(`   2. Set up monitoring and alerting`);
      console.log(`   3. Regular health checks`);
    }

    console.log('\n✅ Audit Complete!');
  }
}

// Run the audit
async function runExpertAudit() {
  const auditor = new BotAuditExpert();
  await auditor.performComprehensiveAudit();
}

runExpertAudit().catch(console.error);