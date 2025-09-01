#!/bin/bash

# YouTube Transcript API Setup Script for Heroku
# This script ensures the youtube-transcript-api Python package is installed

echo "🚀 Setting up YouTube Transcript API for Heroku..."

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 not found. Please ensure Python is installed."
    exit 1
fi

# Check if pip is available
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo "❌ pip not found. Please ensure pip is installed."
    exit 1
fi

# Use pip3 if available, otherwise pip
PIP_CMD="pip3"
if ! command -v pip3 &> /dev/null; then
    PIP_CMD="pip"
fi

echo "📦 Installing youtube-transcript-api using $PIP_CMD..."

# Install the package
$PIP_CMD install youtube-transcript-api

# Verify installation
echo "🔍 Verifying installation..."
python3 -c "
try:
    from youtube_transcript_api import YouTubeTranscriptApi
    print('✅ youtube-transcript-api installed successfully!')
except ImportError as e:
    print(f'❌ Installation failed: {e}')
    exit(1)
"

if [ $? -eq 0 ]; then
    echo "🎉 Setup complete! YouTube Transcript API is ready to use."
    
    # Test with a sample video
    echo "🧪 Testing with sample video..."
    node -e "
    const YouTubeTranscriptApiService = require('./src/services/youtube-transcript-api.service.js');
    
    async function test() {
        try {
            const service = new YouTubeTranscriptApiService();
            const health = await service.healthCheck();
            console.log('Health check:', health.status);
            
            if (health.status === 'healthy') {
                console.log('✅ Service is ready for production!');
            } else {
                console.log('⚠️ Service health check failed:', health.error);
            }
        } catch (error) {
            console.log('❌ Test failed:', error.message);
        }
    }
    
    test();
    "
else
    echo "❌ Setup failed. Please check the error messages above."
    exit 1
fi
