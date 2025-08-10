from selenium import webdriver
from selenium.webdriver.firefox.service import Service
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
import sys
import time

def authenticate_youtube(url):
    options = Options()
    options.add_argument('--headless')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    try:
        driver = webdriver.Firefox(options=options)
        driver.get(url)
        
        # Wait for the video player to load
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.ID, "movie_player"))
        )
        
        # Get cookies and add them to yt-dlp
        cookies = driver.get_cookies()
        cookie_string = "; ".join([f"{cookie['name']}={cookie['value']}" for cookie in cookies])
        
        # Print cookie string that can be used with yt-dlp
        print(f"--cookies '{cookie_string}'")
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
    finally:
        if 'driver' in locals():
            driver.quit()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python youtube_auth.py <youtube_url>")
        sys.exit(1)
    
    authenticate_youtube(sys.argv[1])
