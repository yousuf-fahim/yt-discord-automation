/**
 * Extended Discord Diagnostic with Manual Guild Fetch
 */

require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

async function extendedDiagnostic() {
  console.log('🔍 EXTENDED DISCORD DIAGNOSTIC');
  console.log('='.repeat(50));
  
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;
  
  try {
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    await client.login(token);
    console.log(`✅ Bot logged in as: ${client.user.tag}`);
    
    // Wait for client to be ready
    await new Promise(resolve => {
      if (client.isReady()) {
        resolve();
      } else {
        client.once('ready', resolve);
      }
    });
    
    console.log('🚀 Client is ready, checking guild access...');
    
    // Try manual guild fetch
    try {
      const guild = await client.guilds.fetch(guildId);
      console.log(`✅ Manual guild fetch successful: ${guild.name}`);
      console.log(`👥 Member count: ${guild.memberCount}`);
      console.log(`📅 Created: ${guild.createdAt}`);
      console.log(`👑 Owner: ${guild.ownerId}`);
      
      // Try to fetch bot member
      try {
        const botMember = await guild.members.fetch(client.user.id);
        console.log(`✅ Bot member found: ${botMember.displayName}`);
        console.log(`🎭 Roles: ${botMember.roles.cache.map(r => r.name).join(', ')}`);
        
        // Check permissions
        const permissions = botMember.permissions.toArray();
        console.log(`🔐 Permissions (${permissions.length}): ${permissions.join(', ')}`);
        
        // Check specific important permissions
        const important = [
          'UseApplicationCommands',
          'SendMessages', 
          'ViewChannel',
          'ReadMessageHistory',
          'EmbedLinks',
          'AttachFiles'
        ];
        
        console.log('\n🎯 Important Permissions Check:');
        important.forEach(perm => {
          const has = botMember.permissions.has(perm);
          console.log(`   ${perm}: ${has ? '✅' : '❌'}`);
        });
        
      } catch (memberError) {
        console.log(`❌ Failed to fetch bot member: ${memberError.message}`);
      }
      
    } catch (guildError) {
      console.log(`❌ Failed to fetch guild: ${guildError.message}`);
      
      // List available guilds
      console.log('\n📋 Available guilds in cache:');
      if (client.guilds.cache.size === 0) {
        console.log('   No guilds in cache');
      } else {
        client.guilds.cache.forEach(g => {
          console.log(`   - ${g.name} (${g.id}) - Members: ${g.memberCount}`);
        });
      }
    }
    
    // Test a simple interaction
    console.log('\n🧪 Testing command registration details...');
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
      const commands = await rest.get(
        Routes.applicationGuildCommands(client.user.id, guildId)
      );
      
      if (commands.length > 0) {
        console.log(`✅ Commands successfully registered for guild ${guildId}`);
        console.log(`📊 Command details:`);
        commands.slice(0, 3).forEach(cmd => {
          console.log(`   /${cmd.name} - ID: ${cmd.id} - Version: ${cmd.version}`);
        });
      }
    } catch (cmdError) {
      console.log(`❌ Command fetch error: ${cmdError.message}`);
    }
    
    await client.destroy();
    console.log('\n✅ Extended diagnostic complete!');
    
  } catch (error) {
    console.error('❌ Extended diagnostic failed:', error);
  }
  
  process.exit(0);
}

extendedDiagnostic().catch(console.error);