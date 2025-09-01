/**
 * Heroku Deployment Optimization for Transcript Service
 * Handles Heroku-specific requirements and limitations
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class HerokuTranscriptOptimizer {
  constructor() {
    this.isHeroku = !!process.env.DYNO;
    this.buildpack = process.env.BUILDPACK_URL;
    this.pythonVersion = process.env.PYTHON_VERSION || '3.11';
  }

  /**
   * Setup Heroku environment for transcript extraction
   */
  async setupHerokuEnvironment() {
    if (!this.isHeroku) {
      console.log('⚠️ Not running on Heroku, skipping Heroku-specific setup');
      return { success: true, message: 'Local environment' };
    }

    console.log('🚀 Setting up Heroku environment for transcript extraction...');

    try {
      // 1. Check Python availability
      const pythonStatus = await this.checkPythonSetup();
      
      // 2. Install or verify yt-dlp
      const ytDlpStatus = await this.ensureYtDlpInstallation();
      
      // 3. Setup cache directories
      const cacheStatus = await this.setupHerokuCacheDirectories();
      
      // 4. Configure environment variables
      const envStatus = await this.configureHerokuEnvironment();
      
      // 5. Test transcript functionality
      const testStatus = await this.testTranscriptFunctionality();

      const results = {
        python: pythonStatus,
        ytDlp: ytDlpStatus,
        cache: cacheStatus,
        environment: envStatus,
        test: testStatus,
        overall: pythonStatus.success && ytDlpStatus.success && cacheStatus.success
      };

      console.log('📊 Heroku setup results:', results);
      return results;

    } catch (error) {
      console.error('❌ Heroku setup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async checkPythonSetup() {
    try {
      console.log('🐍 Checking Python setup...');
      
      const { stdout: pythonVersion } = await execAsync('python3 --version');
      const { stdout: pipVersion } = await execAsync('python3 -m pip --version');
      
      console.log(`✅ Python: ${pythonVersion.trim()}`);
      console.log(`✅ Pip: ${pipVersion.trim()}`);
      
      return { 
        success: true, 
        pythonVersion: pythonVersion.trim(),
        pipVersion: pipVersion.trim()
      };
    } catch (error) {
      console.error('❌ Python setup check failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async ensureYtDlpInstallation() {
    try {
      console.log('📦 Checking yt-dlp installation...');
      
      // First check if already installed
      try {
        const { stdout } = await execAsync('python3 -m yt_dlp --version');
        console.log(`✅ yt-dlp already installed: v${stdout.trim()}`);
        return { success: true, version: stdout.trim(), method: 'existing' };
      } catch (existingError) {
        console.log('ℹ️ yt-dlp not found, attempting installation...');
      }

      // Install yt-dlp
      console.log('📥 Installing yt-dlp...');
      const installCommands = [
        'python3 -m pip install --user yt-dlp',
        'python3 -m pip install --upgrade yt-dlp',
        'pip3 install --user yt-dlp'
      ];

      for (const cmd of installCommands) {
        try {
          console.log(`Trying: ${cmd}`);
          await execAsync(cmd, { timeout: 120000 }); // 2 minutes timeout
          
          // Verify installation
          const { stdout } = await execAsync('python3 -m yt_dlp --version');
          console.log(`✅ yt-dlp installed successfully: v${stdout.trim()}`);
          return { success: true, version: stdout.trim(), method: 'installed' };
        } catch (cmdError) {
          console.log(`Command failed: ${cmdError.message}`);
        }
      }

      throw new Error('All installation methods failed');

    } catch (error) {
      console.error('❌ yt-dlp installation failed:', error.message);
      
      // Provide helpful suggestions
      const suggestions = [
        'Add python buildpack to your Heroku app',
        'Add requirements.txt with yt-dlp dependency',
        'Check if Aptfile includes necessary system dependencies',
        'Consider using heroku-buildpack-python-extras'
      ];
      
      return { 
        success: false, 
        error: error.message,
        suggestions
      };
    }
  }

  async setupHerokuCacheDirectories() {
    try {
      console.log('📁 Setting up Heroku cache directories...');
      
      const directories = [
        '/tmp/transcript-temp',
        '/tmp/yt-dlp-cache',
        '/app/.cache/yt-dlp',
        process.env.HOME + '/.cache/yt-dlp'
      ];

      const results = {};
      
      for (const dir of directories) {
        try {
          await fs.mkdir(dir, { recursive: true, mode: 0o777 });
          
          // Test write permissions
          const testFile = path.join(dir, 'test-write');
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
          
          results[dir] = { success: true, writable: true };
          console.log(`✅ Directory ready: ${dir}`);
        } catch (dirError) {
          results[dir] = { success: false, error: dirError.message };
          console.log(`❌ Directory failed: ${dir} - ${dirError.message}`);
        }
      }

      const successCount = Object.values(results).filter(r => r.success).length;
      
      return {
        success: successCount > 0,
        directories: results,
        successCount,
        totalCount: directories.length
      };

    } catch (error) {
      console.error('❌ Cache directory setup failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async configureHerokuEnvironment() {
    try {
      console.log('⚙️ Configuring Heroku environment...');
      
      const environmentVars = {
        PYTHONPATH: `/app/.heroku/python/lib/python${this.pythonVersion}/site-packages`,
        PATH: `/app/.heroku/python/bin:${process.env.PATH}`,
        TMPDIR: '/tmp',
        HOME: process.env.HOME || '/app',
        YT_DLP_CACHE_DIR: '/tmp/yt-dlp-cache',
        TRANSCRIPT_TEMP_DIR: '/tmp/transcript-temp'
      };

      // Set environment variables for current process
      Object.assign(process.env, environmentVars);

      console.log('✅ Environment variables configured');
      return { success: true, variables: environmentVars };

    } catch (error) {
      console.error('❌ Environment configuration failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async testTranscriptFunctionality() {
    try {
      console.log('🧪 Testing transcript functionality...');
      
      const testVideoId = 'dQw4w9WgXcQ'; // Rick Astley - Never Gonna Give You Up
      
      // Test 1: yt-dlp basic functionality
      try {
        const cmd = `python3 -m yt_dlp --no-download --get-title "https://www.youtube.com/watch?v=${testVideoId}"`;
        const { stdout } = await execAsync(cmd, { timeout: 30000 });
        console.log(`✅ yt-dlp basic test passed: ${stdout.trim()}`);
      } catch (basicError) {
        console.log(`⚠️ yt-dlp basic test failed: ${basicError.message}`);
      }

      // Test 2: Subtitle extraction
      try {
        const subtitleCmd = `python3 -m yt_dlp --write-auto-sub --convert-subs srt --skip-download --output "/tmp/test-%(id)s.%(ext)s" "https://www.youtube.com/watch?v=${testVideoId}"`;
        await execAsync(subtitleCmd, { timeout: 60000 });
        
        // Check if subtitle file was created
        const files = await fs.readdir('/tmp');
        const subtitleFiles = files.filter(f => f.includes(testVideoId) && f.endsWith('.srt'));
        
        if (subtitleFiles.length > 0) {
          console.log(`✅ Subtitle extraction test passed: ${subtitleFiles[0]}`);
          
          // Clean up test files
          for (const file of subtitleFiles) {
            await fs.unlink(path.join('/tmp', file)).catch(() => {});
          }
        } else {
          console.log('⚠️ Subtitle extraction test: no files created');
        }
      } catch (subtitleError) {
        console.log(`⚠️ Subtitle extraction test failed: ${subtitleError.message}`);
      }

      return { success: true, message: 'Tests completed' };

    } catch (error) {
      console.error('❌ Transcript functionality test failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate Heroku deployment recommendations
   */
  generateHerokuRecommendations() {
    const recommendations = {
      buildpacks: [
        'heroku/python',
        'https://github.com/heroku/heroku-buildpack-python'
      ],
      requiredFiles: {
        'requirements.txt': [
          'yt-dlp>=2023.9.24',
          'requests>=2.31.0',
          'urllib3>=1.26.0'
        ],
        'Aptfile': [
          'ffmpeg',
          'python3-dev',
          'python3-pip'
        ],
        'runtime.txt': [
          'python-3.11.0'
        ]
      },
      environmentVariables: {
        PYTHON_VERSION: '3.11',
        CACHE_TRANSCRIPTS: 'true',
        MAX_TRANSCRIPT_RETRIES: '5',
        TRANSCRIPT_RETRY_DELAY: '10000'
      },
      procfileExample: 'web: node src/main.js',
      tips: [
        'Use larger dyno sizes (standard-1x or better) for reliable transcript extraction',
        'Set up monitoring alerts for transcript failures',
        'Consider using a proxy service for blocked regions',
        'Cache transcripts aggressively to reduce API calls',
        'Monitor memory usage as yt-dlp can be memory intensive'
      ]
    };

    return recommendations;
  }
}

// Export for use in setup scripts
module.exports = { HerokuTranscriptOptimizer };

// Run setup if called directly
if (require.main === module) {
  const optimizer = new HerokuTranscriptOptimizer();
  optimizer.setupHerokuEnvironment()
    .then(results => {
      console.log('🎯 Heroku setup completed:', results);
      if (!results.overall) {
        console.log('📋 Recommendations:', optimizer.generateHerokuRecommendations());
      }
    })
    .catch(error => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}
