#!/usr/bin/env node

/**
 * Test slash command registration
 * Run this to manually register slash commands if they're not working
 */

require('dotenv').config();
const { REST, Routes } = require('discord.js');

async function registerCommands() {
  if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
    console.error('❌ Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID');
    process.exit(1);
  }

  try {
    console.log('🤖 Registering Discord slash commands...');
    
    // Import command service to get command definitions
    const { serviceManager } = require('./src/core/service-manager');
    const CommandService = require('./src/services/command.service');
    
    // Initialize service manager to get dependencies
    await serviceManager.initializeAll();
    
    const commandService = new CommandService(serviceManager, {
      logger: console
    });
    
    const commands = commandService.getCommandData();
    console.log(`📋 Found ${commands.length} commands to register`);
    
    // Register with Discord
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    
    const result = await rest.put(
      Routes.applicationGuildCommands(
        (await rest.get(Routes.currentApplication())).id,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );
    
    console.log(`✅ Successfully registered ${result.length} slash commands:`);
    result.forEach(cmd => {
      console.log(`   - /${cmd.name}: ${cmd.description}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
    
    if (error.code === 50001) {
      console.error('   Bot is missing access to guild. Check bot permissions and re-invite if needed.');
    } else if (error.code === 401) {
      console.error('   Invalid bot token. Check DISCORD_BOT_TOKEN environment variable.');
    } else if (error.code === 403) {
      console.error('   Bot lacks permissions. Re-invite with applications.commands scope.');
    }
  }
}

if (require.main === module) {
  registerCommands().catch(console.error);
}

module.exports = { registerCommands };
