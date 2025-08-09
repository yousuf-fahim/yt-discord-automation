/**
 * Discord utility functions for channel and message operations
 */

/**
 * Gets all channels with a specific prefix
 * @param {import('discord.js').Client} client - Discord client
 * @param {string} prefix - Channel name prefix
 * @returns {Array<import('discord.js').TextChannel>} - Array of matching channels
 */
async function getChannelsByPrefix(client, prefix) {
  const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
  const channels = await guild.channels.fetch();
  
  return channels
    .filter(channel => 
      channel.type === 0 && // 0 is TextChannel
      channel.name.startsWith(prefix)
    )
    .map(channel => channel);
}

/**
 * Gets the pinned message from a channel
 * @param {import('discord.js').TextChannel} channel - Discord channel
 * @returns {Promise<string|null>} - Content of the first pinned message or null
 */
async function getPinnedMessage(channel) {
  try {
    const pinnedMessages = await channel.messages.fetchPinned();
    if (pinnedMessages.size === 0) {
      console.warn(`No pinned messages found in channel ${channel.name}`);
      return null;
    }
    
    // Get the first pinned message
    const firstPinned = pinnedMessages.first();
    return firstPinned.content;
  } catch (error) {
    console.error(`Error getting pinned message from ${channel.name}:`, error);
    return null;
  }
}

/**
 * Finds the corresponding output channel for a prompt channel
 * @param {import('discord.js').Client} client - Discord client
 * @param {string} promptChannelName - Name of the prompt channel
 * @param {string} promptPrefix - Prefix for prompt channels
 * @param {string} outputPrefix - Prefix for output channels
 * @returns {Promise<import('discord.js').TextChannel|null>} - Corresponding output channel or null
 */
async function findCorrespondingOutputChannel(client, promptChannelName, promptPrefix, outputPrefix) {
  try {
    // Extract the suffix (e.g., "1" from "yt-summary-prompt-1")
    const suffix = promptChannelName.substring(promptPrefix.length);
    
    // Construct the output channel name
    const outputChannelName = `${outputPrefix}${suffix}`;
    
    // Get the guild
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    
    // Find the channel
    const channels = await guild.channels.fetch();
    const outputChannel = channels.find(
      channel => channel.type === 0 && channel.name === outputChannelName
    );
    
    return outputChannel || null;
  } catch (error) {
    console.error('Error finding corresponding output channel:', error);
    return null;
  }
}

/**
 * Posts a message to a channel, handling long messages
 * @param {import('discord.js').TextChannel} channel - Discord channel
 * @param {string} content - Message content
 * @returns {Promise<import('discord.js').Message|null>} - Sent message or null
 */
async function postToChannel(channel, content) {
  try {
    // Discord has a 2000 character limit per message
    const MAX_LENGTH = 2000;
    
    if (content.length <= MAX_LENGTH) {
      return await channel.send(content);
    } else {
      // Split into multiple messages
      const parts = [];
      for (let i = 0; i < content.length; i += MAX_LENGTH) {
        parts.push(content.substring(i, i + MAX_LENGTH));
      }
      
      // Send each part
      const messages = [];
      for (const part of parts) {
        const message = await channel.send(part);
        messages.push(message);
      }
      
      return messages[0]; // Return the first message
    }
  } catch (error) {
    console.error(`Error posting to channel ${channel.name}:`, error);
    return null;
  }
}

/**
 * Gets a specific channel by name
 * @param {import('discord.js').Client} client - Discord client
 * @param {string} channelName - Channel name
 * @returns {Promise<import('discord.js').TextChannel|null>} - Channel or null
 */
async function getChannelByName(client, channelName) {
  try {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    const channels = await guild.channels.fetch();
    
    return channels.find(
      channel => channel.type === 0 && channel.name === channelName
    ) || null;
  } catch (error) {
    console.error(`Error getting channel ${channelName}:`, error);
    return null;
  }
}

module.exports = {
  getChannelsByPrefix,
  getPinnedMessage,
  findCorrespondingOutputChannel,
  postToChannel,
  getChannelByName
};
