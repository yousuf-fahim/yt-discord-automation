require('dotenv').config();
const { getChannelsByPrefix, getPinnedMessage, findCorrespondingOutputChannel, postToChannel, getChannelByName } = require('../utils/discord');
const { generateSummary } = require('../utils/openai');
const { saveSummary } = require('../utils/cache');
const { getYouTubeUrl } = require('../utils/youtube');
const { getYouTubeTitle } = require('../utils/youtube-title');

// Configuration
const SUMMARY_PROMPT_PREFIX = process.env.SUMMARY_PROMPT_PREFIX || 'yt-summary-prompt-';
const SUMMARIES_OUTPUT_PREFIX = process.env.SUMMARIES_OUTPUT_PREFIX || 'yt-summaries-';
const YT_TRANSCRIPTS_CHANNEL = process.env.DISCORD_YT_TRANSCRIPTS_CHANNEL || 'yt-transcripts';

/**
 * Extract the video title from summary text or JSON
 * @param {string} summary - Summary text which might contain JSON
 * @returns {string|null} - Video title or null if not found
 */
function getVideoTitle(summary) {
  try {
    // Try to parse JSON
    const summaryObj = JSON.parse(summary);
    if (summaryObj && summaryObj.title) {
      return summaryObj.title;
    }
  } catch (e) {
    // Not JSON, try to find title in text
    const titleMatch = summary.match(/title[": ]+(.*?)["\\n,}]/i);
    if (titleMatch && titleMatch[1]) {
      return titleMatch[1].trim();
    }
  }
  return null;
}

/**
 * Generates summaries for a YouTube video and posts them to Discord
 * @param {import('discord.js').Client} client - Discord client
 * @param {string} videoId - YouTube video ID
 * @param {string} transcript - Video transcript
 * @param {string} originalUrl - Original YouTube URL from the message
 * @returns {Promise<void>}
 */
async function generateSummaries(client, videoId, transcript, originalUrl) {
  try {
    // Get current date for tracking
    const today = new Date().toISOString().split('T')[0];
    global.summaryStats = global.summaryStats || {};
    global.summaryStats[today] = global.summaryStats[today] || {
      count: 0,
      videos: new Set(),
      lastUpdate: new Date()
    };

    // Get all prompt channels
    const promptChannels = await getChannelsByPrefix(client, SUMMARY_PROMPT_PREFIX);
    
    if (promptChannels.length === 0) {
      console.warn('No prompt channels found');
      // Send error message to the original channel
      const sourceChannel = await getChannelByName(client, YT_TRANSCRIPTS_CHANNEL);
      if (sourceChannel) {
        await sourceChannel.send({
          content: '⚠️ No summary prompt channels found. Please set up at least one channel with prefix: ' + SUMMARY_PROMPT_PREFIX,
          flags: ['SuppressNotifications']
        });
      }
      return;
    }
    
    console.log(`Found ${promptChannels.length} prompt channels`);
    
    // Validate output channels exist before processing
    const missingOutputChannels = [];
    for (const promptChannel of promptChannels) {
      const outputChannel = await findCorrespondingOutputChannel(
        client,
        promptChannel.name,
        SUMMARY_PROMPT_PREFIX,
        SUMMARIES_OUTPUT_PREFIX
      );
      if (!outputChannel) {
        missingOutputChannels.push(promptChannel.name.replace(SUMMARY_PROMPT_PREFIX, SUMMARIES_OUTPUT_PREFIX));
      }
    }
    
    if (missingOutputChannels.length > 0) {
      console.warn('Missing output channels:', missingOutputChannels);
      const sourceChannel = await getChannelByName(client, YT_TRANSCRIPTS_CHANNEL);
      if (sourceChannel) {
        await sourceChannel.send({
          content: `⚠️ Missing summary output channels:\n${missingOutputChannels.map(ch => '- ' + ch).join('\n')}\nPlease create these channels to receive summaries.`,
          flags: ['SuppressNotifications']
        });
      }
      return;
    }
    
    // Optionally post the transcript to the transcripts channel
    if (YT_TRANSCRIPTS_CHANNEL) {
      const transcriptsChannel = await getChannelByName(client, YT_TRANSCRIPTS_CHANNEL);
      if (transcriptsChannel) {
        console.log('Posting transcript to transcripts channel...');
        
        // Create a file attachment for the transcript (better than posting a long message)
        const transcriptBuffer = Buffer.from(transcript, 'utf8');
        // Try to get video title from multiple sources
        let videoTitle = null;
        
        // First try: Extract title from the transcript itself (first 100 chars)
        try {
          // Look for common title patterns in the first part of the transcript
          const firstPart = transcript.substring(0, 500);
          const titleMatches = firstPart.match(/(?:title|video|about):\s*["']?([^"'\n.]{5,100})["']?/i);
          if (titleMatches && titleMatches[1]) {
            videoTitle = titleMatches[1].trim();
            console.log(`Extracted title from transcript: ${videoTitle}`);
          }
        } catch (error) {
          console.log('Error extracting title from transcript:', error);
        }
        
        // Second try: Direct YouTube page scraping (no API key needed)
        if (!videoTitle) {
          try {
            videoTitle = await getYouTubeTitle(videoId);
            if (videoTitle) {
              console.log(`Found video title from page scraping: ${videoTitle}`);
            }
          } catch (error) {
            console.log('Error fetching video title from page scraping:', error);
          }
        }
        
        // Third try: YouTube API
        if (!videoTitle) {
          try {
            if (process.env.YOUTUBE_API_KEY) {
              const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`);
              const data = await response.json();
              if (data.items && data.items.length > 0) {
                videoTitle = data.items[0].snippet.title;
                console.log(`Found video title from YouTube API: ${videoTitle}`);
              }
            }
          } catch (error) {
            console.log('Error fetching video title from YouTube API:', error);
          }
        }
        
        // Third try: Extract from original URL if it's a YouTube URL
        if (!videoTitle && originalUrl) {
          try {
            const urlObj = new URL(originalUrl);
            if (urlObj.searchParams.has('v')) {
              // Try to extract title from URL parameters
              const urlTitle = urlObj.searchParams.get('title') || 
                              urlObj.searchParams.get('name');
              if (urlTitle) {
                videoTitle = decodeURIComponent(urlTitle.replace(/\+/g, ' '));
                console.log(`Extracted title from URL: ${videoTitle}`);
              }
            }
          } catch (error) {
            console.log('Error extracting title from URL:', error);
          }
        }
        
        // Use video title if available, or a default title with video ID
        const displayTitle = videoTitle || `YouTube Video (${videoId})`;
        
        // Use video title for transcript file name
        const transcriptFileName = videoTitle ? `${videoTitle.replace(/[^a-zA-Z0-9-_\.]/g, '_')}_transcript.txt` : `${videoId}_transcript.txt`;
        await transcriptsChannel.send({
          files: [{
            attachment: transcriptBuffer,
            name: transcriptFileName
          }]
        });
      }
    }
    
    // Process each prompt channel
    for (const promptChannel of promptChannels) {
      try {
        console.log(`Processing prompt channel: ${promptChannel.name}`);
        
        // Get the pinned prompt
        let prompt = await getPinnedMessage(promptChannel);
        if (!prompt) {
          console.warn(`No pinned prompt found in channel ${promptChannel.name}`);
          continue;
        }
        // Enforce strict prompt format for OpenAI
        prompt = `You’re an advanced content summarizer.\nYour task is to analyze the transcript of a YouTube video and return a concise summary in JSON format only.\nInclude the video’s topic, key points, and any noteworthy mentions.\nDo not include anything outside of the JSON block. Be accurate, structured, and informative.\n\nFormat your response like this:\n\n{\n  "title": "Insert video title here",\n  "summary": [\n    "Key point 1",\n    "Key point 2",\n    "Key point 3"\n  ],\n  "noteworthy_mentions": [\n    "Person, project, or tool name if mentioned",\n    "Important reference or example"\n  ],\n  "verdict": "Brief 1-line overall takeaway"\n}`;
        
        // Find the corresponding output channel
        const outputChannel = await findCorrespondingOutputChannel(
          client, 
          promptChannel.name, 
          SUMMARY_PROMPT_PREFIX, 
          SUMMARIES_OUTPUT_PREFIX
        );
        
        if (!outputChannel) {
          console.warn(`No corresponding output channel found for ${promptChannel.name}`);
          continue;
        }
        
        console.log(`Generating summary with prompt from ${promptChannel.name}...`);
        
        // Generate the summary
        let summary;
        try {
          console.log(`Calling OpenAI API for video ${videoId} with prompt from ${promptChannel.name}...`);
          summary = await generateSummary(transcript, prompt);
          
          if (!summary) {
            console.error(`Failed to generate summary for video ${videoId} with prompt from ${promptChannel.name}`);
            await outputChannel.send({
              content: `⚠️ Failed to generate summary for video: ${originalUrl || getYouTubeUrl(videoId)}\nPlease check the server logs for more information.`,
              flags: ['SuppressNotifications']
            });
            continue;
          }
          
          console.log(`Summary generated successfully. Length: ${summary.length}`);
          // Log the first 100 chars to help with debugging
          console.log(`Summary preview: ${summary.substring(0, 100)}...`);
        } catch (summaryError) {
          console.error(`Error generating summary for video ${videoId}:`, summaryError);
          
          // More detailed error logging
          if (summaryError.response) {
            console.error('OpenAI API response error:', {
              status: summaryError.response.status,
              statusText: summaryError.response.statusText,
              data: summaryError.response.data
            });
          }
          
          await outputChannel.send({
            content: `❌ Error generating summary for video: ${originalUrl || getYouTubeUrl(videoId)}\nError: ${summaryError.message || 'API Error'}\nCheck server logs for details.`,
            flags: ['SuppressNotifications']
          });
          continue;
        }
        
        // Extract the prompt index (e.g., "1" from "yt-summary-prompt-1")
        const promptIndex = promptChannel.name.substring(SUMMARY_PROMPT_PREFIX.length);
        
        // Cache the summary
        await saveSummary(videoId, promptIndex, summary);
        
        // Update summary statistics
        const today = new Date().toISOString().split('T')[0];
        global.summaryStats[today].count++;
        global.summaryStats[today].videos.add(videoId);
        global.summaryStats[today].lastUpdate = new Date();
        
        // Update the summariesCollected count in report.js
        if (typeof summariesCollected !== 'undefined') {
          summariesCollected = global.summaryStats[today].count;
        }
        
        // Parse JSON summary into a readable Discord format
        let videoTitle = null;
        let formattedSummary = summary;
        
        try {
          const summaryObj = JSON.parse(summary);
          if (summaryObj) {
            // Extract title
            if (summaryObj.title) {
              videoTitle = summaryObj.title;
            }
            
            // Format JSON as readable text with Discord markdown and better separation
            formattedSummary = `${summaryObj.title || "Video Summary"}\n\n`;
            
            formattedSummary += "**Summary:**\n";
            if (summaryObj.summary && typeof summaryObj.summary === 'string') {
              formattedSummary += `${summaryObj.summary}\n\n`;
            } else if (summaryObj.summary && Array.isArray(summaryObj.summary)) {
              formattedSummary += `${summaryObj.summary.join('\n')}\n\n`;
            }
            
            formattedSummary += "**Key Points:**\n";
            if (summaryObj.summary && Array.isArray(summaryObj.summary)) {
              summaryObj.summary.forEach(point => {
                formattedSummary += `• ${point}\n`;
              });
              formattedSummary += "\n";
            }
            
            if (summaryObj.verdict) {
              formattedSummary += `**Verdict:**\n${summaryObj.verdict}\n\n`;
            }
            
            if (summaryObj.noteworthy_mentions && Array.isArray(summaryObj.noteworthy_mentions) && summaryObj.noteworthy_mentions.length > 0) {
              formattedSummary += "**Noteworthy Mentions:**\n";
              summaryObj.noteworthy_mentions.forEach(mention => {
                formattedSummary += `• ${mention}\n`;
              });
            }
          }
        } catch (e) {
          // Not JSON or couldn't parse - use summary as-is
          console.log('Could not parse JSON summary:', e.message);
        }
        
        // Post the formatted summary to the output channel
        console.log(`Posting summary to ${outputChannel.name}...`);
        
        // Use video title if available, otherwise use a default title with video ID
        const titleDisplay = videoTitle ? 
          `${videoTitle}` : 
          `YouTube Video (${videoId})`;
          
        await postToChannel(
          outputChannel,
          `**SUMMARY: ${titleDisplay}**\n\n${formattedSummary}`
        );
        
        console.log(`Summary posted to ${outputChannel.name}`);
      } catch (error) {
        console.error(`Error processing prompt channel ${promptChannel.name}:`, error);
      }
    }
  } catch (error) {
    console.error('Error generating summaries:', error);
  }
}

module.exports = {
  generateSummaries
};
