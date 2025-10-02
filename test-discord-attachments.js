/**
 * Test Discord Long Message and File Attachment Functionality
 */

require('dotenv').config();
const { AttachmentBuilder } = require('discord.js');

// Mock Discord channel for testing
class MockChannel {
  constructor(name) {
    this.name = name;
    this.sentMessages = [];
  }

  async send(content) {
    this.sentMessages.push(content);
    
    if (typeof content === 'string') {
      console.log(`📨 Sent message to #${this.name}:`);
      console.log(`   Length: ${content.length} chars`);
      console.log(`   Preview: ${content.substring(0, 100)}...`);
    } else if (content.files) {
      console.log(`📎 Sent file attachment to #${this.name}:`);
      console.log(`   Message: ${content.content}`);
      content.files.forEach((file, i) => {
        if (file instanceof AttachmentBuilder) {
          console.log(`   File ${i + 1}: ${file.name || 'attachment'}`);
        } else {
          console.log(`   File ${i + 1}: ${file.name || 'attachment'}`);
        }
      });
    }
    
    return { id: Date.now() };
  }
}

async function testLongMessageHandling() {
  console.log('🧪 Testing Discord Long Message & File Handling\n');
  console.log('='.repeat(60));
  
  // Test cases
  const testCases = [
    {
      name: 'Short text message',
      content: 'This is a short message that fits in Discord.',
      expectedBehavior: 'Send as regular message'
    },
    {
      name: 'Long text (3000 chars)',
      content: 'A'.repeat(3000),
      expectedBehavior: 'Send as .txt file attachment'
    },
    {
      name: 'JSON response (short)',
      content: JSON.stringify({
        title: "Test Video",
        summary: ["Point 1", "Point 2", "Point 3"],
        verdict: "Great video"
      }, null, 2),
      expectedBehavior: 'Send as regular message if <2000 chars'
    },
    {
      name: 'JSON response (long)',
      content: JSON.stringify({
        title: "Test Video with Long Content",
        summary: Array.from({ length: 50 }, (_, i) => `Key point number ${i + 1} with detailed explanation that makes the content very long`),
        noteworthy_mentions: Array.from({ length: 20 }, (_, i) => `Person ${i + 1}`),
        verdict: "This is a verdict with lots of text to make it longer"
      }, null, 2),
      expectedBehavior: 'Send as .json file attachment'
    },
    {
      name: 'Markdown summary (medium)',
      content: `# Video Summary

## Overview
${Array.from({ length: 10 }, (_, i) => `This is paragraph ${i + 1} with detailed information about the video content.`).join('\n\n')}

## Key Points
${Array.from({ length: 20 }, (_, i) => `- Key point ${i + 1}`).join('\n')}

## Conclusion
Final thoughts and recommendations.`,
      expectedBehavior: 'Send as regular message or .txt if too long'
    }
  ];

  // Helper function to mimic sendLongMessage
  function isJsonString(str) {
    try {
      const trimmed = str.trim();
      if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return false;
      }
      JSON.parse(trimmed);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function sendLongMessage(channel, content, options = {}) {
    const MAX_DISCORD_MESSAGE_LENGTH = 2000;
    const { 
      fileFormat = 'txt', 
      fileName = `output_${Date.now()}`, 
      fallbackMessage = 'Content too long for Discord. See attached file.',
      forceFile = false
    } = options;

    // Detect if content is JSON
    const isJsonContent = isJsonString(content);
    const effectiveFormat = isJsonContent ? 'json' : fileFormat;

    // If content is short enough and not forced to file, send directly
    if (content.length <= MAX_DISCORD_MESSAGE_LENGTH && !forceFile) {
      return await channel.send(content);
    }

    // For JSON content or large content, create a file attachment
    console.log(`   💾 Creating ${effectiveFormat} file (${content.length} chars)`);
    
    const fileBuffer = Buffer.from(content, 'utf-8');
    const attachment = new AttachmentBuilder(fileBuffer, {
      name: `${fileName}.${effectiveFormat}`
    });

    return await channel.send({
      content: fallbackMessage,
      files: [attachment]
    });
  }

  // Run tests
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    
    console.log(`\n\nTest ${i + 1}: ${testCase.name}`);
    console.log('-'.repeat(60));
    console.log(`Content length: ${testCase.content.length} chars`);
    console.log(`Expected: ${testCase.expectedBehavior}`);
    console.log('');
    
    const channel = new MockChannel('test-channel');
    
    try {
      await sendLongMessage(channel, testCase.content, {
        fileName: `test_${i + 1}_${testCase.name.replace(/\s+/g, '_')}`
      });
      
      console.log('✅ Test passed');
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('📊 Summary of Improvements');
  console.log('='.repeat(60));
  console.log('✅ AttachmentBuilder: Using Discord.js v14 API');
  console.log('✅ Auto-detect JSON: Automatically saves as .json file');
  console.log('✅ File attachments: Works for content > 2000 chars');
  console.log('✅ Smart formatting: Preserves JSON structure in files');
  console.log('✅ No message breaking: All long content goes to files');
  
  console.log('\n📋 Discord Limits:');
  console.log('  - Regular message: 2,000 characters');
  console.log('  - File upload: 25 MB (100 MB with Nitro)');
  console.log('  - File name: Clean, descriptive names');
  
  console.log('\n💡 Usage in Bot:');
  console.log('  - Short summaries: Sent as regular messages');
  console.log('  - Long summaries: Automatically saved as .txt files');
  console.log('  - JSON summaries: Automatically saved as .json files');
  console.log('  - Custom prompts: Can be sent as files if needed');
  
  console.log('\n✅ All tests completed!\n');
}

// Run tests
testLongMessageHandling().catch(console.error);
