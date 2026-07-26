# Save as debug_bootstrap.py at project root, then run:
# python debug_bootstrap.py

import asyncio
import sys
sys.path.insert(0, '.')

from app.config import settings
from scraper.platforms.noon.proxy_manager import ProxyManager
from scraper.platforms.noon.browser import get_browser, get_context, NOON_HOME

async def debug():
    proxy_manager = ProxyManager()
    proxy_dict = proxy_manager.get_patchright()
    
    print(f"Proxy dict: {proxy_dict}")
    
    playwright, browser = await get_browser(headless=False)
    
    # Test 1: WITH proxy
    print("\n--- TEST WITH PROXY ---")
    context = await get_context(browser, 
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        proxy=proxy_dict
    )
    page = await context.new_page()
    await page.goto(NOON_HOME, wait_until="domcontentloaded", timeout=60_000)
    
    # Poll for 90 seconds
    for i in range(30):
        await asyncio.sleep(3)
        cookies = await context.cookies("https://www.noon.com")
        names = {c["name"] for c in cookies}
        print(f"  {i*3}s: cookies present: {sorted(names)}")
        if "bm_sv" in names and "nguestv2" in names:
            print("  SUCCESS: bm_sv and nguestv2 found!")
            break
    
    await browser.close()
    await playwright.stop()

asyncio.run(debug())