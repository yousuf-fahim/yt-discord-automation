/**
 * Quick test to verify bot connectivity and channel monitoring
 */

require('dotenv').config();

// Simple test that you can run to verify the bot setup
console.log('🔍 BOT CONFIGURATION CHECK');
console.log('=' .repeat(40));

console.log('\n📧 Environment Variables:');
console.log('✅ DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Missing');
console.log('✅ DISCORD_GUILD_ID:', process.env.DISCORD_GUILD_ID || 'Using default');
console.log('✅ OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set' : 'Missing');

console.log('\n📋 Channel Configuration:');
console.log('✅ Primary upload channel:', process.env.DISCORD_YT_SUMMARIES_CHANNEL || 'yt-uploads');

const allowedPatterns = process.env.DISCORD_ALLOWED_CHANNELS ? 
  process.env.DISCORD_ALLOWED_CHANNELS.split(',').map(s => s.trim()) : 
  ['youtube', 'videos', 'media', 'links', 'general', 'bot-spam', 'feeds', 'notifications'];

console.log('✅ Allowed channel patterns:', allowedPatterns.join(', '));

console.log('\n🎯 TEST INSTRUCTIONS:');
console.log('1. Make sure your bot (yt-summaries#4880) is ONLINE in Discord');
console.log('2. Post YouTube links ONLY in these channels:');
console.log(`   • #${process.env.DISCORD_YT_SUMMARIES_CHANNEL || 'yt-uploads'}`);
console.log('   • Or channels with these words: ' + allowedPatterns.join(', '));
console.log('3. Watch for bot reactions: 🤖 → 🗒️ → ✅');
console.log('4. If no reactions appear, the bot is not processing the message');

console.log('\n🔧 TROUBLESHOOTING:');
console.log('❌ No reactions = Wrong channel or bot offline');
console.log('🤖 Only = Bot started but failed during processing'); 
console.log('🤖🗒️ Only = Transcript worked but summary failed');
console.log('🤖🗒️✅ = Full success, check database');

console.log('\n📊 Current database status:');