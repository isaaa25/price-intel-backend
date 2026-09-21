"""
test_scrapfly_cookies.py

Standalone test: takes the cookies harvested via Scrapfly and fires a
single curl_cffi request at noon's search API to see what comes back.

No dependency on session_manager.py or SessionManager — this is a raw,
isolated test so you can see exactly what's happening without any of
that file's assumptions in the way.

Run:
    pip install curl_cffi --break-system-packages
    python test_scrapfly_cookies.py
"""

from curl_cffi.requests import Session

# ─────────────────────────────────────────────────────────────────────────
# COOKIES — pulled directly from your Scrapfly terminal output
# ─────────────────────────────────────────────────────────────────────────
# nguestv2 and _abck were NOT present in the harvest, so they're simply
# not included here. This is intentional — we want to see what noon's
# API does with an incomplete cookie set, not fabricate values.

COOKIES = {
    "ak_bmsc": "D4B531EE94800D563BB12DC6AAA69D34~000000000000000000000000000000~YAAQt8XOF3JtsTygAQAAA8yhVgEZLrMyS59ZyaJ73/4kupbS6q8FKFa5pF8YH908Shsi6uAHASROzUB5XrGwPyxaDI66czyXrtqdHf/6zPBruKoqH3Emkd/kL6MTrQpk99NuRjfUub2Qiw32orplJEZJ9sAkzp4Di0pG+h0BvLWGpr/wwCtWcSgPYYvgmM1pMpZwo1wf68iAXpSedepnt1Vbml0OLu2t9U29XyTInLmQ804PnyIwM/Vv8sYFZhk1BuFaRjhwogi414mxfsX8Q6sy+4+CfX6g+YK4iUTXmyjQNQeIIvNjGRor8MX2nj7n5v7m/sKNLiuB03hYMtzhlcOkY2yWt9NMsaXn2ub41AyMCd7+NcOcKZmWK8rRS8AE/RSEufxazeoJFhsrdugQkRi4xYUOKXrFytENGs822J2KZ08MAw2s/Oe8Yd+GVV2sXpPO573GmFgttU9NmyhVi3Gf3Ci2b9zlorrQznRjDJGgWh47nCMhBBQGtgLT22y94mtoNXljUNWoXh8gtx1z9cutalnZjLFoBeQ=",
    "bm_sc": "4~1~393099478~YAAQt8XOF7hrsTygAQAAr7GhVgmy6XIhWTTPuBeJNt6kViCIUadmC9j3x0A4ghj7F3+4WtDTVAi4P1/sQaAfh222RI05gdvVm+K3RgACqH0z1cbwsdEQ14FvyKqxNPedoVuK9xxMRWhJSYR8lX8qiixsC0e/cE85V62UCqs7BtnRl30OCfkrSlw1JJA1uVRC+g2dRd758iAj8ZfR6o8v3B1t0JkeIJp6Z7rgRuOoY1bqnH25i2+VhfntiZEEofno1YhUrgCKfjB2AnadtgVVY/xbGsCjmEm/kc162rgj5cHqa445qtvMPV7FpkahKspxA056OSeYKefZDcQHoLgel06b5u3USvhPOPnc4UcY40pwM2uW797LJuC1G+ElRHESSNS+ybcbJEZ4hvgpIVOQ4CN73/QT+1rWTqUHUt5enCu2dkl9eMFX9DjcV9G4CwKig4jgMpnP4SyMNwUNNA+SC+zi+RbUXaH6TbuCSHeTa16O4/eufrjzMoKc57UbTPeADQhnvWuNy3TbMO7uCpDVVS7LyQ==~0~0~0",
    "AKA_A2": "A",
    "bm_mi": "29810558D384B895CCD7C8845BB55D38~YAAQt8XOF2lqsTygAQAAMp2hVgEjwc5CtSnxCCs07N68kiAj7pT4ribSjMbicHd1aKcRlxLlTFnHOR7yfQx64kot3HBnCBnXmwILH/u9xa5wbE0ml7CsqTP5Eb2AJJ2zBkApUf7U43Za+M+3WEcg2jrTKSH0/HWOvErE8r7voiEbSLIYsnoN1mqtMfUeD7njjbmrx4XbkNZzXUu7DJIiYHHjbTJAYUv93X82X/IyAYj2FhGN3XCYXdfWPuFjmw3qH2sTp/wJjtVII9mDr9dShHlOrACWw8xPGlghJSzAhql6b6A6XQ0wQkB6R3qPHxA2d6DOFU73/EsUWrTzJPg=~1",
    "bm_lso": "A6BF02B1C2C73DB2577E66A91F2EDF6087C7DFB9BFA5E38857ABB0B24695813B~YAAQt8XOF/9vsTygAQAAjgGiVgjHNuaoxKTgYWmf3+utldVmgCY7TXtPZzhKNwy4w06dbVFP3ZcqGAYWuDyxJVvQx5+tAJ6G3+EmdXinya02WuS+PPxgxnU+M+eBXYJkt5L+wgOZsvtpGmz2Nc68Ml+cojw7MYHvpM1La/LUCgtGTcKIMhridS8S4Tx8BNYjv89QkceB6vg10zKo2WodQDllNUTGLS3vcwY5oZ57GUjRbSZIP2vQCPRbAoRZw3linJf7DCaEUjQWoIZ1IhatSLcFHJGUq2sB8mIo8Vr1fQl7faOLkU9DNElgHF3WxjLwFRatdBN0FEed1O+gNN9xzLCibgz30ymwwbKgOODg6ZPgsQ22A70xeMiMIqAe+ZlkV12inCdWKAmFHNM8HdQU/0VCg0tMoiL6FGO3lTzVMqbGq176mmNDlfUxXepq17Kk/Z4pbtr3cSivaFpJFOCNBjZi17GIan9x7dYTp8gCVkJ3IykP/8ddYBM=~1788159861702",
    "bm_so": "A6BF02B1C2C73DB2577E66A91F2EDF6087C7DFB9BFA5E38857ABB0B24695813B~YAAQt8XOF/9vsTygAQAAjgGiVgjHNuaoxKTgYWmf3+utldVmgCY7TXtPZzhKNwy4w06dbVFP3ZcqGAYWuDyxJVvQx5+tAJ6G3+EmdXinya02WuS+PPxgxnU+M+eBXYJkt5L+wgOZsvtpGmz2Nc68Ml+cojw7MYHvpM1La/LUCgtGTcKIMhridS8S4Tx8BNYjv89QkceB6vg10zKo2WodQDllNUTGLS3vcwY5oZ57GUjRbSZIP2vQCPRbAoRZw3linJf7DCaEUjQWoIZ1IhatSLcFHJGUq2sB8mIo8Vr1fQl7faOLkU9DNElgHF3WxjLwFRatdBN0FEed1O+gNN9xzLCibgz30ymwwbKgOODg6ZPgsQ22A70xeMiMIqAe+ZlkV12inCdWKAmFHNM8HdQU/0VCg0tMoiL6FGO3lTzVMqbGq176mmNDlfUxXepq17Kk/Z4pbtr3cSivaFpJFOCNBjZi17GIan9x7dYTp8gCVkJ3IykP/8ddYBM=",
    "bm_sv": "E8B14E3494E57972489A9417C734DF54~YAAQt8XOFwBwsTygAQAAjgGiVgFLE6cgNWz02GtqHn0OlPj/x4TNqdQh9ELZSl5T6E/I14K/2iZZPi5eYMP6+5DjkgM7wh8NbP6qR8m6Q0efBwGcbJ8R8gmErR60MsApE+Q1XENr2GJ9kic3UjLXYnqN50LcqDOZDFBbnK0DzXPyPBdCGLFHmF7XfJwVhCqAb5iTcYJGAzR7D3L/tLK20X6/9+xTLhV1+ajiMY1uAyLJUA8m2WKv+eDqYFhOtA==~1",
    "bm_s": "YAAQVucVAnTYljegAQAAk4miVgZotLMn0/eUaS+TZGsZ76EaN8x9iUbMbL2p2MFLYJh+QGxGZU7zEn7rcwPtu0dmExQG4ydIHrXJurWZtLr4ZVFeBGhMPrJK6zpm/L1gJPHXYG9ryoS1CskxLzH4OWBA6x8n6kio1Qy8Po+eblstimyt5KizywhYFRNBglCoXyLOF2FYbl72l0gyyjVkP9svZlMdO2AalThMhLn6PGJZQn/EboyUc3tA9RFLuLV3D/2A0wAPQdBPOz53SZh30sy8SNjca3EN8/w/iO7KL/GTzoY5FA+AFjZWZLhU3i60Y2jmchHNM+swla3mraZkmhaWok+ISuiIrWZY8vJBAkpg8FceXb2hS2G60tn23ArwgihgdOY4jFj0GGRHfEqoY2mC9tZZmjJVtweXbsoCaOxR73wNTdxHGFLjk3zWwesLZ+JI7TpuHEoNNpnFujwk/03i8HXRc18ENDAMS070JMzx4FdJUubT7tV2cFZji5AkJ/xptOYAs7hro997w8ReWjVpecrSNmFhGSkqnZ6OI9jWEkardabnI/dsdBRlHMBugw3iB41/i1EUqRz4dIbPhSmnndGijNzH4Bdgf9curDiGXlNmN0ATMBSjqlVEFR3+GypxVs1YjUmTLepYybJyYyHpR++buAiYkJc6ISh1ezstPu3lk2AjWJb3KaiD760O0R3Il6S9aPXNAo+EI92zDt9O/jput7kdpHvUtA9w867DFL/cFJu4x9D5CJXTXMixanTqERKKPxeACAJ75JNcoDLOwMq+QNw9lsN6rUDDRBQp9Bn4+waA38UuIEVDQcinrlMQbwOaI8064pZI8cOybIjh0PJF8lBmpAnOpBTIuv21uHmPIRQbjClIxeZAL5ZRoiXMtA7c/F9t1NxzJrlHxVFPiUpHT4WkKyIBvTJsmU/C6zcOgT80cSLx/5SENFKTeg3r4pfV+t4fVVq8OqPU0EzZZUyt3TJa/mw5seN29UEKVTJ2Q3PTGzdX/3Ognf1xl/R78qVmyadVup7FC5g6yZ9ADNzt+jfu0ziWYFJzLtLD7gdNg77r2hMyoi26wEx84KN9BLAJC7vTk8WHCkYyLOmobYKSwQ1flTauTpL6z0dECorWffshXKB8WgexRmdfZwEf6QsSHqBjUwnhhiI/AEl7na7Yo+wGpeCjYrNtixMk/Zx0/1RV2JYttLokAcJedpzS",
    # NOT present in the Scrapfly harvest — left out deliberately:
    #   "nguestv2": ...
    #   "_abck":    ...
}

# NOTE on ak_bmsc: Scrapfly's `secure` flag for this one came back False
# in your first run and it's also missing a domain match in some cookie
# jars vs the others (.noon.com vs .www.noon.com for bm_lso). If this
# test fails on cookie-domain grounds, that's the first thing to check —
# not all 8 cookies necessarily belong on every subdomain/path noon uses.

# ─────────────────────────────────────────────────────────────────────────
# USER AGENT — must match what Scrapfly's browser actually presented,
# NOT a value you pick independently. Pulled verbatim from your
# "REQUEST HEADERS" terminal output (second run, macOS UA).
# ─────────────────────────────────────────────────────────────────────────
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"

# curl_cffi's available impersonation targets are fixed version strings,
# not arbitrary — 152 isn't an option as of current curl_cffi releases.
# chrome131 is the closest available match. This mismatch (UA=152 vs
# TLS-fingerprint=131) is a real variable in your result — see notes below.
IMPERSONATE_TARGET = "chrome131"

# ─────────────────────────────────────────────────────────────────────────
# PROXY — Akamai often checks IP consistency between the session that
# earned the cookies and the session that spends them. Scrapfly used
# its own AE-geo'd IP pool to harvest these cookies — it did NOT use
# your iProyal residential proxy. So this request is going out through
# a *different* IP than the one that earned the cookies, by construction.
# Fill in an AE residential proxy below if you want to test that variable
# in isolation, or leave PROXY = None to test with your real public IP
# and see what happens with no proxy at all.
# ─────────────────────────────────────────────────────────────────────────
PROXY = None  # e.g. "socks5://user:pass@host:port"

# ─────────────────────────────────────────────────────────────────────────
# TARGET
# ─────────────────────────────────────────────────────────────────────────
API_URL = (
    "https://www.noon.com/_vs/nc/mp-customer-catalog-api/api/v3/u/search/"
    "?q=iphone+17"
)
REFERER = "https://www.noon.com/uae-en/search/?q=iphone+17"


def build_headers() -> dict:
    cookie_string = "; ".join(f"{k}={v}" for k, v in COOKIES.items())

    return {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache, max-age=0, must-revalidate, no-store",
        "cookie": cookie_string,
        "priority": "u=1, i",
        "referer": REFERER,
        "sec-ch-ua": '"Chromium";v="131", "Not?A_Brand";v="24", "Google Chrome";v="131"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": USER_AGENT,
        "x-locale": "en-ae",
        "x-mp-country": "ae",
        "x-platform": "web",
        # x-visitor-id, x-ecom-zonecode, x-rocket-zonecode, x-lat, x-lng,
        # x-ab-test all normally come from decoding the x-whoami-data
        # cookie — which we don't have, since nguestv2/whoami never ran.
        # Deliberately omitted rather than faked with fallback constants,
        # so this test tells you what noon's API does with a genuinely
        # incomplete header set, not a stitched-together guess.
    }


def main():
    headers = build_headers()

    print("=" * 70)
    print("REQUEST")
    print("=" * 70)
    print(f"URL:         {API_URL}")
    print(f"Impersonate: {IMPERSONATE_TARGET}")
    print(f"Proxy:       {PROXY}")
    print(f"Cookie count sent: {len(COOKIES)}")
    print()

    session = Session(impersonate=IMPERSONATE_TARGET)

    try:
        resp = session.get(
            API_URL,
            headers=headers,
            proxy=PROXY,
            timeout=30,
        )
    except Exception as exc:
        print(f"REQUEST FAILED (network/exception level): {exc}")
        return

    print("=" * 70)
    print("RESPONSE")
    print("=" * 70)
    print(f"Status code: {resp.status_code}")
    print(f"Response headers: {dict(resp.headers)}")
    print()

    print("--- BODY (first 1000 chars) ---")
    print(resp.text[:1000])
    print()

    if resp.status_code == 200:
        try:
            data = resp.json()
            nb_hits = data.get("nbHits")
            hits = data.get("hits", [])
            print(f"nbHits: {nb_hits}")
            print(f"len(hits): {len(hits)}")
            if hits:
                print(f"First hit SKU: {hits[0].get('sku')}")
                print(f"First hit name: {hits[0].get('name')}")
        except Exception as exc:
            print(f"Response was 200 but not parseable JSON: {exc}")
    elif resp.status_code == 403:
        print("403 — Akamai rejected this request outright.")
    else:
        print(f"Unexpected status {resp.status_code} — inspect body above.")


if __name__ == "__main__":
    main()