"""
diagnostic_test_daraz_sign.py

Tests whether Daraz's mtop.global.detail.web.getdetailinfo endpoint
accepts a MINIMAL cookieParams payload, or whether it genuinely needs
the full browser cookie jar (tfstk, isg, epssw, etc.) to return valid
data.

WHY THIS TEST MATTERS:
    If minimal cookieParams works, client.py can be simple: no browser
    needed at all, just curl_cffi + the two-step token handshake.
    If it needs the full cookie jar, we likely need a lightweight
    browser visit first to collect those cookies legitimately, which
    is a heavier design closer to Noon's session_manager.py.

HOW TO RUN:
    pip install curl_cffi --break-system-packages
    python3 diagnostic_test_daraz_sign.py

WHAT IT DOES:
    1. First request with NO _m_h5_tk cookie (expected to fail, but
       the response should set a fresh _m_h5_tk via Set-Cookie).
    2. Extract the token from the fresh cookie.
    3. Compute sign = MD5(token & t & appKey & data) using a MINIMAL
       cookieParams (just the handful of identity cookies, not the
       full ~30-cookie jar).
    4. Retry with the new cookie + computed sign.
    5. Print the raw response so we can see whether it's valid product
       data, or an error (and if an error, what kind — that tells us
       whether the minimal payload is close-but-not-quite, or totally
       rejected).

WHAT TO SEND BACK:
    Just copy-paste everything this script prints. The important part
    is the final response body — if it contains real product data
    (title, price, seller name), the minimal payload works. If it
    returns an error like "MISSING_PARAMS" or a token/sign failure,
    that tells us the full cookie jar (or a specific missing field
    within it) is genuinely required.
"""

import hashlib
import json
import time
import urllib.parse

from curl_cffi.requests import Session

# ─── Configuration — edit these two if testing a different product ───────

PRODUCT_URL = "https://www.daraz.pk/products/dw-210-20-1-i212788200.html"
PRODUCT_URI = "dw-210-20-1-i212788200"  # the "uri" field — url path minus .html and query string

APP_KEY = "24937400"  # confirmed correct key from real capture verification
ENDPOINT = "https://acs-m.daraz.pk/h5/mtop.global.detail.web.getdetailinfo/1.0/"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36"
)


def build_data_payload(minimal_cookies: dict) -> str:
    """
    Builds the JSON string that goes into the "data" POST field.

    minimal_cookies: whatever cookie key/values we're testing — pass a
    small dict to test the "minimal" theory, or a full dict scraped
    from a real browser session to test the "needs everything" theory.
    """
    header_params = json.dumps({"user-agent": USER_AGENT})
    cookie_params = json.dumps(minimal_cookies)
    request_params = json.dumps({"spm": "a2a0e.pdp.0.0.test"})

    payload = {
        "deviceType": "pc",
        "path": PRODUCT_URL,
        "uri": PRODUCT_URI,
        "headerParams": header_params,
        "cookieParams": cookie_params,
        "requestParams": request_params,
    }
    return json.dumps(payload)


def compute_sign(token: str, t: str, data: str) -> str:
    base = f"{token}&{t}&{APP_KEY}&{data}"
    return hashlib.md5(base.encode()).hexdigest()


def build_headers() -> dict:
    return {
        "accept": "application/json",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded",
        "origin": "https://www.daraz.pk",
        "pragma": "no-cache",
        "referer": "https://www.daraz.pk/",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "user-agent": USER_AGENT,
        "x-i18n-language": "en",
        "x-i18n-regionid": "PK",
        "traffic": "drz-replatform",
    }


def make_request(session: Session, sign: str, t: str, data: str):
    params = {
        "jsv": "2.6.1",
        "appKey": APP_KEY,
        "t": t,
        "sign": sign,
        "api": "mtop.global.detail.web.getDetailInfo",
        "v": "1.0",
        "type": "originaljson",
        "isSec": "1",
        "AntiCreep": "true",
        "timeout": "20000",
        "dataType": "json",
        "sessionOption": "AutoLoginOnly",
        "x-i18n-language": "en",
        "x-i18n-regionID": "PK",
        "traffic": "drz-replatform",
    }
    resp = session.post(
        ENDPOINT,
        params=params,
        headers=build_headers(),
        data={"data": data},
        timeout=20,
    )
    return resp


def extract_token_from_cookies(session: Session) -> str | None:
    """
    Pulls _m_h5_tk out of the session's cookie jar and returns just the
    part before the underscore (the actual token used in signing).
    """
    tk = session.cookies.get("_m_h5_tk")
    if not tk:
        return None
    return tk.split("_")[0]


def main():
    print("=" * 70)
    print("STEP 1 — Initial request with no token (expected to fail,")
    print("         but should set a fresh _m_h5_tk cookie via Set-Cookie)")
    print("=" * 70)

    session = Session(impersonate="chrome124")

    t1 = str(int(time.time() * 1000))
    minimal_cookies_attempt_1 = {}  # genuinely empty on the first call
    data1 = build_data_payload(minimal_cookies_attempt_1)
    sign1 = compute_sign(token="", t=t1, data=data1)  # no token yet — this call is expected to fail

    resp1 = make_request(session, sign1, t1, data1)
    print(f"Status: {resp1.status_code}")
    print(f"Body: {resp1.text[:500]}")
    print()

    token = extract_token_from_cookies(session)
    print(f"Extracted token from Set-Cookie: {token}")
    print()

    if not token:
        print("!!! No _m_h5_tk cookie was set. Cannot proceed to step 2.")
        print("!!! This itself is useful info — send this whole output back.")
        return

    print("=" * 70)
    print("STEP 2 — Retry with fresh token, MINIMAL cookieParams")
    print("=" * 70)

    t2 = str(int(time.time() * 1000))

    # THE MINIMAL THEORY: only the identity-ish cookies, not the full
    # ~30-cookie jar. Adjust this dict if you want to test other subsets.
    minimal_cookies_attempt_2 = {
        "_m_h5_tk": session.cookies.get("_m_h5_tk", ""),
        "t_fv": "1784110995958",
        "t_uid": "test_uid_value",
    }
    data2 = build_data_payload(minimal_cookies_attempt_2)
    sign2 = compute_sign(token=token, t=t2, data=data2)

    resp2 = make_request(session, sign2, t2, data2)
    print(f"Status: {resp2.status_code}")
    print(f"Body (first 2000 chars): {resp2.text[:2000]}")
    print()

    print("=" * 70)
    print("RESULT INTERPRETATION")
    print("=" * 70)
    if '"ret"' in resp2.text and "SUCCESS" in resp2.text:
        print("Looks like SUCCESS — minimal cookieParams may be sufficient!")
        print("Check above: does the body actually contain product title/price?")
    else:
        print("Does NOT look like a clean success. Send this full output back —")
        print("the specific error code/message tells us what's actually required.")


if __name__ == "__main__":
    main()

