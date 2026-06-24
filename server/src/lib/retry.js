export async function withRetry(fn, { maxRetries = 5, baseDelay = 1000, label = "operation" } = {}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRateLimit = err.status === 429 || err.message?.includes("rate") || err.message?.includes("Quota") || err.message?.includes("quota");
      const isTransient = err.status >= 500 || err.code === "ECONNRESET" || err.code === "ETIMEDOUT";

      if (attempt < maxRetries && (isRateLimit || isTransient)) {
        const delay = isRateLimit ? 62000 : (baseDelay * Math.pow(2, attempt) + Math.random() * 500);
        console.warn(`[retry] ${label} attempt ${attempt + 1} failed (${err.message || "error"}), retrying in ${Math.round(delay / 1000)}s...`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        break;
      }
    }
  }

  console.error(`[retry] ${label} failed after ${maxRetries} attempts: ${lastError?.message || lastError}`);
  throw lastError;
}

export function createTimer() {
  const start = Date.now();
  return {
    elapsed() {
      return Date.now() - start;
    },
    elapsedStr() {
      const ms = Date.now() - start;
      return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
    },
  };
}
