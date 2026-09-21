# """
# scrapfly_step1_harvest.py  (simplified)

# Just three things: visit Noon's homepage through Scrapfly, print the
# cookies, print the request headers, print a snippet of the page
# content. Nothing else.

# Scrapfly already gives us a parsed "cookies" field directly (confirmed
# from the real result keys) - no manual Set-Cookie string parsing
# needed at all.

# BEFORE RUNNING:
#     pip install scrapfly-sdk --break-system-packages
#     Set SCRAPFLY_API_KEY below.
# """

# from scrapfly import ScrapeConfig, ScrapflyClient

# SCRAPFLY_API_KEY = "scp-live-d5af719d388a48f292e50c3dd8aa3c91"
# NOON_HOMEPAGE = "https://www.noon.com/uae-en/"

# client = ScrapflyClient(key=SCRAPFLY_API_KEY)

# print("Requesting Noon homepage through Scrapfly ASP...")

# api_response = client.scrape(
#     scrape_config=ScrapeConfig(
#         url=NOON_HOMEPAGE,
#         asp=True,
#         render_js=True,
#         country="ae",
#     )
# )

# result = api_response.scrape_result

# print("\n--- COOKIES ---")
# print(result.get("cookies"))

# print("\n--- REQUEST HEADERS ---")
# print(dict(result.get("request_headers", {})))

# print("\n--- CONTENT SNIPPET (first 300 chars) ---")
# print(str(result.get("content"))[:300])
"""
scrapfly_step1_harvest_v3.py

Adds a js_scenario: wait, then a scroll (Scrapfly's docs specifically
say this scroll action uses REAL MOUSE INPUT, not simulated JS), then
another wait. This is the same category of signal your own browser.py
already deliberately provides via mouse-movement simulation - testing
whether Scrapfly's version of that same idea is enough to get past
whatever stage was blocking bm_sv/nguestv2 in the plain render_js=True
run.

BEFORE RUNNING:
    pip install scrapfly-sdk --break-system-packages
    Set SCRAPFLY_API_KEY below.
"""

from scrapfly import ScrapeConfig, ScrapflyClient

SCRAPFLY_API_KEY = "scp-live-d5af719d388a48f292e50c3dd8aa3c91"
NOON_HOMEPAGE = "https://www.noon.com/uae-en/"

client = ScrapflyClient(key=SCRAPFLY_API_KEY)

cookies_jar = {}

# we'll fill up this jar with the desired cookies from the Scrapfly result, then pass it to the next file so that it can use it

print("Requesting Noon homepage through Scrapfly ASP with a scroll scenario...")

api_response = client.scrape(
    scrape_config=ScrapeConfig(
        url=NOON_HOMEPAGE,
        asp=True,
        render_js=True,
        country="ae",
        # session_sticky_pr
        js_scenario=[
            {"wait": 2000},     # let the initial page settle
            {"scroll": {}},     # real mouse-input scroll to bottom
            {"wait": 3000},     # give any triggered XHRs time to complete
        ],
    )
)

result = api_response.scrape_result
print("\n -- results keys --")
print(result.keys())

# dumping cookies into the cookie jar
for cookie in result.get("cookies", []):
    cookies_jar[cookie.get("name")] = cookie.get("value")
print("\n--- COOKIES ---")
cookies = result.get("cookies", [])
print("Cookies received from Scrapfly:")
print(cookies)
print("\n--- COOKIE DETAILS ---")
for c in cookies:
    print(f"  {c.get('name')} (expires: {c.get('expires')})")

print(f"\nTotal cookies: {len(cookies)}")

cookie_names = {c.get("name") for c in cookies}
print("\n--- CRITICAL COOKIE CHECK ---")
for critical_name in ("bm_sv", "nguestv2", "_abck"):
    status = "PRESENT" if critical_name in cookie_names else "MISSING"
    print(f"{critical_name}: {status}")

print("\n--- REQUEST HEADERS ---")
print(dict(result.get("request_headers", {})))

print("\n--- CONTENT SNIPPET (first 300 chars) ---")
print(str(result.get("content"))[:300])