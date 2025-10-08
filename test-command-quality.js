#!/usr/bin/env node
/**
 * Comprehensive Command Quality Check
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');

// Import necessary services
const DatabaseService = require('./src/services/database.service');
const HybridCacheService = require('./src/services/hybrid-cache.service');
const SummaryService = require('./src/services/summary.service');
const ReportService = require('./src/services/report.service');
const CommandService = require('./src/services/command.service');

async function checkCommandQuality() {
  console.log('🔍 COMPREHENSIVE COMMAND QUALITY CHECK');
  console.log('='.repeat(60));

  try {
    // Register and initialize services
    serviceManager.registerService('database', DatabaseService);
    serviceManager.registerService('cache', HybridCacheService, ['database']);
    serviceManager.registerService('summary', SummaryService, ['cache', 'database']);
    serviceManager.registerService('report', ReportService, ['summary', 'cache', 'database']);
    serviceManager.registerService('command', CommandService, ['report', 'database', 'cache']);

    await serviceManager.initializeAll();

    const commandService = await serviceManager.getService('command');
    console.log('✅ Services initialized successfully\n');

    // Get all registered commands
    const commands = Array.from(commandService.commands.entries());
    console.log(`📋 ANALYZING ${commands.length} COMMANDS:\n`);

    const issues = [];
    const warnings = [];
    let passedCount = 0;

    for (const [name, commandConfig] of commands) {
      console.log(`🔍 Checking /${name}...`);
      
      // Check 1: Command has proper structure
      if (!commandConfig.data || !commandConfig.execute) {
        issues.push(`❌ /${name}: Missing data or execute function`);
        continue;
      }

      // Check 2: SlashCommandBuilder validation
      try {
        const data = commandConfig.data;
        if (!data.name || !data.description) {
          issues.push(`❌ /${name}: Missing name or description`);
          continue;
        }
        
        if (data.description.length > 100) {
          warnings.push(`⚠️  /${name}: Description too long (${data.description.length}/100 chars)`);
        }
        
        if (data.description.length < 10) {
          warnings.push(`⚠️  /${name}: Description too short (${data.description.length} chars)`);
        }

        // Check options
        if (data.options) {
          for (const option of data.options) {
            if (option.description && option.description.length > 100) {
              warnings.push(`⚠️  /${name}: Option "${option.name}" description too long`);
            }
          }
        }

      } catch (error) {
        issues.push(`❌ /${name}: Command data validation failed - ${error.message}`);
        continue;
      }

      // Check 3: Execute function validation
      try {
        const executeFunc = commandConfig.execute;
        if (typeof executeFunc !== 'function') {
          issues.push(`❌ /${name}: Execute is not a function`);
          continue;
        }

        // Check if function has proper parameter structure
        const funcStr = executeFunc.toString();
        if (!funcStr.includes('interaction')) {
          warnings.push(`⚠️  /${name}: Execute function doesn't use interaction parameter`);
        }
        
        if (!funcStr.includes('deferReply')) {
          warnings.push(`⚠️  /${name}: Execute function doesn't defer reply`);
        }

        if (!funcStr.includes('try') || !funcStr.includes('catch')) {
          warnings.push(`⚠️  /${name}: Execute function missing try/catch error handling`);
        }

      } catch (error) {
        issues.push(`❌ /${name}: Execute function validation failed - ${error.message}`);
        continue;
      }

      // Check 4: Category validation
      const categories = {
        'help': 'Help & Discovery',
        'health': 'Monitoring', 'status': 'Monitoring', 'logs': 'Monitoring', 
        'check-summaries': 'Monitoring', 'check-transcripts': 'Monitoring',
        'report': 'Reports', 'trigger-report': 'Reports', 'schedule': 'Reports',
        'process': 'Processing', 'test-summary': 'Processing', 
        'transcript': 'Processing', 'transcript-test': 'Processing',
        'config': 'Administration', 'model': 'Administration', 'cache': 'Administration',
        'prompts': 'Administration', 'channel-status': 'Administration'
      };

      if (!categories[name]) {
        warnings.push(`⚠️  /${name}: Command not categorized in help system`);
      }

      console.log(`  ✅ /${name} - Structure valid`);
      passedCount++;
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 QUALITY CHECK RESULTS:');
    console.log('='.repeat(60));
    
    console.log(`✅ Commands passed: ${passedCount}/${commands.length}`);
    console.log(`❌ Critical issues: ${issues.length}`);
    console.log(`⚠️  Warnings: ${warnings.length}`);

    if (issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      warnings.forEach(warning => console.log(`  ${warning}`));
    }

    if (issues.length === 0) {
      console.log('\n🎉 All commands are structurally sound!');
      
      // Additional quality checks
      console.log('\n🔍 ADDITIONAL QUALITY CHECKS:');
      
      // Check command naming consistency
      const namingIssues = [];
      commands.forEach(([name]) => {
        if (name.includes('_')) {
          namingIssues.push(`/${name} uses underscore (should use hyphens)`);
        }
        if (name.includes(' ')) {
          namingIssues.push(`/${name} contains spaces`);
        }
        if (name !== name.toLowerCase()) {
          namingIssues.push(`/${name} not lowercase`);
        }
      });

      if (namingIssues.length > 0) {
        console.log('⚠️  Naming issues:');
        namingIssues.forEach(issue => console.log(`  • ${issue}`));
      } else {
        console.log('✅ Command naming is consistent');
      }

      // Check for duplicate functionality
      const duplicateChecks = [
        { commands: ['health', 'status'], note: 'Both provide health info' },
        { commands: ['process', 'test-summary'], note: 'Both process videos' },
        { commands: ['transcript', 'transcript-test'], note: 'Both test transcripts' },
        { commands: ['report', 'trigger-report'], note: 'Both generate reports' }
      ];

      console.log('\n📋 Duplicate functionality analysis:');
      duplicateChecks.forEach(check => {
        const existingCommands = check.commands.filter(cmd => 
          commands.some(([name]) => name === cmd)
        );
        if (existingCommands.length > 1) {
          console.log(`  ℹ️  ${existingCommands.join(', ')}: ${check.note} (intentional)`);
        }
      });

      // Check help system coverage
      console.log('\n📚 Help system coverage:');
      const categorizedCommands = Object.keys(categories);
      const uncategorized = commands
        .map(([name]) => name)
        .filter(name => !categorizedCommands.includes(name));
      
      if (uncategorized.length > 0) {
        console.log(`⚠️  Uncategorized commands: ${uncategorized.join(', ')}`);
      } else {
        console.log('✅ All commands are categorized in help system');
      }
    }

    console.log('\n🏁 QUALITY CHECK COMPLETE');
    
    if (issues.length === 0 && warnings.length <= 5) {
      console.log('🌟 OVERALL RATING: EXCELLENT');
    } else if (issues.length === 0 && warnings.length <= 10) {
      console.log('👍 OVERALL RATING: GOOD');
    } else if (issues.length <= 2) {
      console.log('👌 OVERALL RATING: ACCEPTABLE');
    } else {
      console.log('👎 OVERALL RATING: NEEDS WORK');
    }

  } catch (error) {
    console.error('❌ Quality check failed:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the check
checkCommandQuality().catch(console.error);