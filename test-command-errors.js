const path = require('path');

// Simplified test that focuses just on the method calls
async function testMethodCalls() {
  try {
    console.log('Testing method call fixes...\n');

    // Just check that the command service can be required without errors
    const CommandService = require('./src/services/command.service');
    console.log('✅ CommandService loaded successfully');

    // Read the command service file and check for problematic method calls
    const fs = require('fs');
    const commandServiceContent = fs.readFileSync('./src/services/command.service.js', 'utf8');

    // Check for the specific error patterns we fixed
    const patterns = [
      'sendDailyReports()',
      'sendWeeklyReports()', 
      'sendMonthlyReports()',
      'sendDailyReportToChannel(',
      'sendWeeklyReportToChannel(',
      'sendMonthlyReportToChannel('
    ];

    console.log('\nChecking for problematic method calls:');
    let foundIssues = false;

    patterns.forEach(pattern => {
      if (commandServiceContent.includes(pattern)) {
        console.log(`❌ Found problematic method call: ${pattern}`);
        foundIssues = true;
      } else {
        console.log(`✅ No issues with: ${pattern}`);
      }
    });

    if (!foundIssues) {
      console.log('\n✅ All method calls look correct!');
    } else {
      console.log('\n❌ Found some method call issues that need fixing');
    }

    // Check for correct method calls that should exist
    console.log('\nChecking for correct method calls:');
    const correctPatterns = [
      'sendDailyReport(report)',
      'generateDailyReport()',
      'sendWeeklyReport()',
      'generateWeeklyReport()',
      'sendMonthlyReport()',
      'generateMonthlyReport()'
    ];

    correctPatterns.forEach(pattern => {
      if (commandServiceContent.includes(pattern)) {
        console.log(`✅ Found correct method call: ${pattern}`);
      } else {
        console.log(`❓ Did not find expected pattern: ${pattern}`);
      }
    });

    console.log('\n=== Method call analysis completed ===');

  } catch (error) {
    console.error('Error during test:', error.message);
  }
}

testMethodCalls();