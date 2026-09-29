/**
 * Mirrors backend app/utils/marketplace_url.py (domain-only v1).
 */

const NOON_PATH_COUNTRY = {
  "uae-en": "UAE",
  "uae-ar": "UAE",
  "saudi-en": "Saudi Arabia",
  "saudi-ar": "Saudi Arabia",
  "egypt-en": "Egypt",
  "egypt-ar": "Egypt",
  "kuwait-en": "Kuwait",
  "kuwait-ar": "Kuwait",
  "qatar-en": "Qatar",
  "qatar-ar": "Qatar",
  "bahrain-en": "Bahrain",
  "bahrain-ar": "Bahrain",
};

const DARAZ_HOST_COUNTRY = {
  "daraz.pk": "Pakistan",
  "daraz.com.bd": "Bangladesh",
  "daraz.com.np": "Nepal",
  "daraz.com.mm": "Myanmar",
};

const COUNTRY_CURRENCY = {
  UAE: "AED",
  "Saudi Arabia": "SAR",
  Egypt: "EGP",
  Kuwait: "KWD",
  Qatar: "QAR",
  Bahrain: "BHD",
  Pakistan: "PKR",
  Bangladesh: "BDT",
  Nepal: "NPR",
  Myanmar: "MMK",
};

function normalizeUrl(url) {
  let raw = (url || "").trim();
  if (!raw) throw new Error("URL is required.");
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  return raw;
}

function normalizedHost(hostname) {
  let host = (hostname || "").toLowerCase();
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

/**
 * @returns {{ marketplace: string, country: string, currency: string, host: string }}
 */
export function parseMarketplaceUrl(url) {
  const normalized = normalizeUrl(url);
  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw new Error("Could not parse this URL. Paste a full Noon or Daraz link.");
  }

  const host = normalizedHost(parsed.hostname);
  if (!host) {
    throw new Error("Could not read a hostname from this URL.");
  }

  for (const [darazHost, country] of Object.entries(DARAZ_HOST_COUNTRY)) {
    if (host === darazHost || host.endsWith("." + darazHost)) {
      return {
        marketplace: "daraz",
        country,
        currency: COUNTRY_CURRENCY[country],
        host,
      };
    }
  }

  if (host.includes("noon.com")) {
    const segments = parsed.pathname.toLowerCase().split("/").filter(Boolean);
    let country = null;
    for (const seg of segments) {
      if (NOON_PATH_COUNTRY[seg]) {
        country = NOON_PATH_COUNTRY[seg];
        break;
      }
    }
    if (!country) {
      throw new Error(
        "Noon URL must include a country segment (e.g. /uae-en/, /saudi-en/)."
      );
    }
    return {
      marketplace: "noon",
      country,
      currency: COUNTRY_CURRENCY[country],
      host,
    };
  }

  throw new Error(
    "URL must be a supported Noon or Daraz link (e.g. noon.com/uae-en/... or daraz.pk/...)."
  );
}

export function validateProductUrl(url, expectedMarketplace, expectedCountry) {
  const info = parseMarketplaceUrl(url);
  const expM = (expectedMarketplace || "").trim().toLowerCase();
  const expC = (expectedCountry || "").trim();

  if (info.marketplace !== expM) {
    throw new Error(
      `URL is a ${info.marketplace} link, but this store is ${expM}. Use a ${expM} product URL.`
    );
  }
  if (info.country !== expC) {
    throw new Error(
      `URL is for ${info.country}, but this store is ${expC}. Use a ${expC} product URL.`
    );
  }
  return info;
}

export function currencyForCountry(country) {
  return COUNTRY_CURRENCY[country] || null;
}