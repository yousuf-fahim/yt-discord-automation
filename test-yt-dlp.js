require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function testYtDlp(videoId) {
  console.log('\n=== Testing yt-dlp configuration ===\n');
  
  try {
    // 1. Check yt-dlp installation and version
    console.log('1. Checking yt-dlp installation...');
    try {
      const { stdout: version } = await execAsync('yt-dlp --version');
      console.log('yt-dlp version:', version.trim());
    } catch (error) {
      console.log('Error getting yt-dlp version:', error.message);
      console.log('Attempting to install/upgrade yt-dlp...');
      await execAsync('pip install --upgrade yt-dlp');
      const { stdout: newVersion } = await execAsync('yt-dlp --version');
      console.log('New yt-dlp version:', newVersion.trim());
    }

    // 2. Test basic video info fetch
    console.log('\n2. Testing basic video info fetch...');
    const basicCmd = `yt-dlp --no-download --get-title --verbose --no-warnings "https://www.youtube.com/watch?v=${videoId}"`;
    console.log('Command:', basicCmd);
    const { stdout: title, stderr } = await execAsync(basicCmd);
    if (stderr) console.log('stderr:', stderr);
    console.log('Video title:', title.trim());

    // 3. Test subtitle availability
    console.log('\n3. Testing subtitle availability...');
    const subsCmd = `yt-dlp --list-subs "https://www.youtube.com/watch?v=${videoId}"`;
    console.log('Command:', subsCmd);
    const { stdout: subs } = await execAsync(subsCmd);
    console.log('Available subtitles:', subs.trim());

    // 4. Test subtitle download
    console.log('\n4. Testing subtitle download...');
    const downloadCmd = `yt-dlp --sub-lang en --write-sub --convert-subs srt --skip-download "https://www.youtube.com/watch?v=${videoId}"`;
    console.log('Command:', downloadCmd);
    const { stdout: download } = await execAsync(downloadCmd);
    console.log('Download output:', download.trim());

    console.log('\n=== All tests passed successfully ===\n');
    return true;
  } catch (error) {
    console.error('\n=== Test failed ===\n');
    console.error('Error:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

// Test with a known working video (Let's use Rick Astley's video as it's reliable)
const TEST_VIDEO_ID = 'dQw4w9WgXcQ';
const TEST_VIDEO_2 = 'U-fZ8zpNLa8'; // The video that's failing

async function runTests() {
  console.log('Testing with known working video...');
  await testYtDlp(TEST_VIDEO_ID);
  
  console.log('\n\nTesting with problematic video...');
  await testYtDlp(TEST_VIDEO_2);
}

runTests().catch(console.error);
