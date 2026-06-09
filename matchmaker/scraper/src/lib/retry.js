// Exponential backoff retry with auto-throttle on rate-limit signals.
// Tracks recent error rate per host and inflates the base delay when the
// target starts pushing back (429/403).

const HOST_STATE = new Map();

function hostFromUrl(u) {
  try { return new URL(u).host; } catch { return "unknown"; }
}

function getState(host) {
  if (!HOST_STATE.has(host)) {
    HOST_STATE.set(host, { recentErrors: [], baseDelayMs: 0 });
  }
  return HOST_STATE.get(host);
}

function noteResult(host, ok) {
  const s = getState(host);
  const now = Date.now();
  s.recentErrors = s.recentErrors.filter((t) => now - t < 60_000);
  if (!ok) {
    s.recentErrors.push(now);
    // 3+ errors in last minute → start adding 5 s, 10 s, 15 s cooldown
    s.baseDelayMs = Math.min(15_000, (s.recentErrors.length - 2) * 5_000);
  } else if (s.recentErrors.length === 0) {
    s.baseDelayMs = 0;
  }
}

export function getThrottleDelay(url) {
  return getState(hostFromUrl(url)).baseDelayMs;
}

// Retry fn with exponential backoff. fn must return a value (success) or throw.
// `isRetryable(err)` decides whether to retry; default: anything except a hard 404.
export async function withRetry(
  fn,
  { url = "", attempts = 3, baseMs = 1500, factor = 2, isRetryable = () => true } = {}
) {
  const host = hostFromUrl(url);
  for (let i = 0; i < attempts; i++) {
    try {
      const v = await fn();
      noteResult(host, true);
      return v;
    } catch (err) {
      noteResult(host, false);
      if (i === attempts - 1 || !isRetryable(err)) throw err;
      const jitter = Math.random() * 500;
      const wait = baseMs * Math.pow(factor, i) + jitter + getState(host).baseDelayMs;
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export function isRetryableHttpStatus(status) {
  return status === 429 || status === 403 || (status >= 500 && status < 600);
}
