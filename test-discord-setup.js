/**
 * Discord Setup Diagnostic Tool
 */

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

async function testDiscordSetup() {
  console.log('🔍 DISCORD BOT SETUP DIAGNOSTIC');
  console.log('='.repeat(50));
  
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  
  console.log(`🏷️  Guild ID: ${guildId}`);
  console.log(`🔑 Token present: ${!!token}`);
  console.log(`🔑 Token prefix: ${token ? token.substring(0, 20) + '...' : 'MISSING'}`);
  
  try {
    // Test bot login
    console.log('\n🤖 Testing bot login...');
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    await client.login(token);
    console.log(`✅ Bot logged in as: ${client.user.tag}`);
    console.log(`🆔 Bot ID: ${client.user.id}`);
    
    // Check guild access
    console.log('\n🏰 Checking guild access...');
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      console.log(`✅ Bot is in guild: ${guild.name}`);
      console.log(`👥 Guild member count: ${guild.memberCount}`);
      
      // Check bot permissions
      const botMember = guild.members.cache.get(client.user.id);
      if (botMember) {
        console.log(`✅ Bot member found in guild`);
        console.log(`🔐 Bot permissions: ${botMember.permissions.toArray().join(', ')}`);
        
        // Check specific permissions
        const hasUseSlashCommands = botMember.permissions.has('UseApplicationCommands');
        const hasSendMessages = botMember.permissions.has('SendMessages');
        const hasViewChannels = botMember.permissions.has('ViewChannel');
        
        console.log(`🎯 Use Slash Commands: ${hasUseSlashCommands ? '✅' : '❌'}`);
        console.log(`📝 Send Messages: ${hasSendMessages ? '✅' : '❌'}`);
        console.log(`👁️  View Channels: ${hasViewChannels ? '✅' : '❌'}`);
        
        if (!hasUseSlashCommands) {
          console.log('⚠️  WARNING: Bot lacks "Use Application Commands" permission!');
        }
      } else {
        console.log('❌ Bot member not found in guild cache');
      }
    } else {
      console.log('❌ Bot is not in the specified guild or guild not found');
      console.log('📋 Available guilds:');
      client.guilds.cache.forEach(g => {
        console.log(`   - ${g.name} (${g.id})`);
      });
    }
    
    // Test REST API access
    console.log('\n🌐 Testing REST API...');
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
      const guildCommands = await rest.get(
        Routes.applicationGuildCommands(client.user.id, guildId)
      );
      console.log(`✅ Found ${guildCommands.length} registered guild commands`);
      
      if (guildCommands.length > 0) {
        console.log('📋 Registered commands:');
        guildCommands.forEach(cmd => {
          console.log(`   - /${cmd.name}: ${cmd.description}`);
        });
      }
    } catch (error) {
      console.log('❌ Failed to fetch guild commands:', error.message);
    }
    
    // Test global commands
    try {
      const globalCommands = await rest.get(
        Routes.applicationCommands(client.user.id)
      );
      console.log(`📡 Found ${globalCommands.length} global commands`);
    } catch (error) {
      console.log('❌ Failed to fetch global commands:', error.message);
    }
    
    console.log('\n✅ Discord setup diagnostic complete!');
    
    await client.destroy();
    
  } catch (error) {
    console.error('❌ Discord setup test failed:', error.message);
    if (error.code === 'TokenInvalid') {
      console.log('💡 The Discord bot token is invalid. Please check your .env file.');
    }
  }
  
  process.exit(0);
}

testDiscordSetup().catch(console.error);