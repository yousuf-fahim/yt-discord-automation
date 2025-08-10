/**
 * Cache management utilities for YouTube to Discord bot
 */
const fs = require('fs').promises;
const path = require('path');

// Cache directory
const CACHE_DIR = path.join(process.cwd(), 'cache');

/**
 * Clean old cache files based on age or total size
 * @param {Object} options - Cleanup options
 * @param {number} options.maxAgeDays - Maximum age of cache files in days
 * @param {number} options.maxSizeMB - Maximum total size of cache in MB
 * @returns {Promise<Object>} - Stats about cleaned files
 */
async function cleanCache({ maxAgeDays = 30, maxSizeMB = 500 } = {}) {
  try {
    console.log(`Cleaning cache (max age: ${maxAgeDays} days, max size: ${maxSizeMB} MB)...`);
    
    // Ensure cache directory exists
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    
    // Get all files in the cache directory
    const files = await fs.readdir(CACHE_DIR);
    
    if (files.length === 0) {
      console.log('Cache is empty.');
      return { cleaned: 0, size: 0 };
    }
    
    // Get stats for all files
    const now = new Date();
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(CACHE_DIR, file);
        const stats = await fs.stat(filePath);
        return {
          path: filePath,
          name: file,
          size: stats.size,
          mtime: stats.mtime,
          age: Math.floor((now - stats.mtime) / (1000 * 60 * 60 * 24)) // age in days
        };
      })
    );
    
    // Calculate total size
    const totalSizeBytes = fileStats.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = totalSizeBytes / (1024 * 1024);
    
    console.log(`Current cache: ${files.length} files, ${totalSizeMB.toFixed(2)} MB`);
    
    // Identify files to delete based on age
    const oldFiles = fileStats.filter(file => file.age > maxAgeDays);
    
    // Delete old files first
    for (const file of oldFiles) {
      console.log(`Deleting old file: ${file.name} (${file.age} days old)`);
      await fs.unlink(file.path);
    }
    
    // If we're still over the size limit, delete more files starting with the oldest
    if (totalSizeMB > maxSizeMB) {
      // Sort remaining files by age (oldest first)
      const remainingFiles = fileStats
        .filter(file => file.age <= maxAgeDays)
        .sort((a, b) => b.age - a.age);
      
      let currentSize = totalSizeBytes;
      const targetSize = maxSizeMB * 1024 * 1024;
      
      for (const file of remainingFiles) {
        if (currentSize <= targetSize) break;
        
        console.log(`Deleting file to reduce cache size: ${file.name}`);
        await fs.unlink(file.path);
        currentSize -= file.size;
      }
    }
    
    // Get updated stats
    const remainingFiles = await fs.readdir(CACHE_DIR);
    const newStats = await Promise.all(
      remainingFiles.map(async (file) => {
        const filePath = path.join(CACHE_DIR, file);
        const stats = await fs.stat(filePath);
        return { size: stats.size };
      })
    );
    
    const newSizeBytes = newStats.reduce((sum, file) => sum + file.size, 0);
    const newSizeMB = newSizeBytes / (1024 * 1024);
    
    const result = {
      cleaned: files.length - remainingFiles.length,
      sizeBefore: totalSizeMB.toFixed(2),
      sizeAfter: newSizeMB.toFixed(2),
      filesBefore: files.length,
      filesAfter: remainingFiles.length
    };
    
    console.log(`Cache cleanup complete. Removed ${result.cleaned} files. New size: ${result.sizeAfter} MB`);
    return result;
  } catch (error) {
    console.error('Error cleaning cache:', error);
    return { error: error.message };
  }
}

/**
 * Get cache stats
 * @returns {Promise<Object>} - Cache statistics
 */
async function getCacheStats() {
  try {
    // Ensure cache directory exists
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
    
    // Get all files in the cache directory
    const files = await fs.readdir(CACHE_DIR);
    
    if (files.length === 0) {
      return { 
        files: 0, 
        size: 0, 
        transcripts: 0, 
        summaries: 0,
        oldestFile: null,
        newestFile: null
      };
    }
    
    // Get stats for all files
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(CACHE_DIR, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          size: stats.size,
          mtime: stats.mtime
        };
      })
    );
    
    // Calculate total size
    const totalSizeBytes = fileStats.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = totalSizeBytes / (1024 * 1024);
    
    // Count different file types
    const transcripts = files.filter(file => file.endsWith('.txt')).length;
    const summaries = files.filter(file => file.includes('_summary_')).length;
    
    // Find oldest and newest files
    fileStats.sort((a, b) => a.mtime - b.mtime);
    const oldestFile = fileStats.length > 0 ? {
      name: fileStats[0].name,
      date: fileStats[0].mtime.toISOString()
    } : null;
    
    const newestFile = fileStats.length > 0 ? {
      name: fileStats[fileStats.length - 1].name,
      date: fileStats[fileStats.length - 1].mtime.toISOString()
    } : null;
    
    return {
      files: files.length,
      size: totalSizeMB.toFixed(2),
      transcripts,
      summaries,
      oldestFile,
      newestFile
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { error: error.message };
  }
}

module.exports = {
  cleanCache,
  getCacheStats
};


