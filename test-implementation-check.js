#!/usr/bin/env node
/**
 * Quick Implementation Check
 */

require('dotenv').config();
const { serviceManager } = require('./src/core/service-manager');
const CommandService = require('./src/services/command.service');

// Mock the required services
const mockService = {
  healthCheck: () => ({ status: 'ok', details: 'Mock service' }),
  getStats: () => ({ totalFiles: 0, totalSize: 0 }),
  generateSummary: () => 'Mock summary',
  generateDailyReport: () => 'Mock report'
};

async function checkImplementations() {
  console.log('🔍 CHECKING COMMAND IMPLEMENTATIONS');
  console.log('='.repeat(50));

  try {
    // Create a minimal service manager
    const mockServiceManager = {
      getService: (name) => Promise.resolve(mockService),
      config: {
        openai: { model: 'gpt-4o' },
        guildId: 'test-guild'
      }
    };

    const commandService = new CommandService(mockServiceManager, {
      discord: { config: { guildId: 'test-guild' } },
      logger: console
    });

    const registeredCommands = Array.from(commandService.commands.keys());
    console.log(`✅ Successfully registered ${registeredCommands.length} commands:`);
    
    registeredCommands.forEach(cmd => {
      console.log(`  • /${cmd}`);
    });

    // Check for missing methods in initializeCommands
    const initMethods = [
      'registerHelpCommand', 'registerHealthCommand', 'registerStatusCommand',
      'registerLogsCommand', 'registerCheckSummariesCommand', 'registerCheckTranscriptsCommand',
      'registerReportCommand', 'registerTriggerReportCommand', 'registerScheduleCommand',
      'registerProcessCommand', 'registerTestSummaryCommand', 'registerTranscriptCommand',
      'registerTranscriptTestCommand', 'registerConfigCommand', 'registerModelCommand',
      'registerCacheCommand', 'registerPromptsCommand', 'registerChannelStatusCommand'
    ];

    console.log('\n📋 CHECKING METHOD IMPLEMENTATIONS:');
    initMethods.forEach(method => {
      if (typeof commandService[method] === 'function') {
        console.log(`  ✅ ${method}`);
      } else {
        console.log(`  ❌ ${method} - MISSING!`);
      }
    });

    console.log('\n🎯 COMMAND REGISTRATION COMPLETE');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('is not a function')) {
      console.log('\n💡 This indicates a missing command method implementation');
    }
  }
}

checkImplementations();