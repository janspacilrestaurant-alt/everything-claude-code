// Realistic User-Agent pool. Rotated per browser context to avoid trivial
// fingerprint-based blocks. Pinned to current major Chromium/Firefox/Safari
// releases — refresh once every 6 months.
export const UA_POOL = [
  // Desktop Chrome
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  // Desktop Firefox
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
  "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0",
  // Desktop Safari
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
];

export function pickUA() {
  return UA_POOL[Math.floor(Math.random() * UA_POOL.length)];
}

// Bazoš mobile app UA + device-id. Bazoš's /api/v1/ads.php rejects anything
// that doesn't look like the real Android/iOS app.
export const BAZOS_MOBILE = {
  ua: "bazos/2.12.1 (Android 14; SM-A546B)",
  deviceId: () =>
    "ecc-" +
    [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
};
