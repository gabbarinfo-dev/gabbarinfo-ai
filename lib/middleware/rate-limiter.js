// lib/middleware/rate-limiter.js
/**
 * In-Memory Sliding Window Rate Limiter for GabbarInfo AI
 * Protects expensive generation endpoints against automated spam and multi-tab flooding.
 * Super Admin (ndantare@gmail.com / owner) bypasses all rate limits.
 */

const rateLimitMap = new Map();

// Periodic cleanup every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > record.windowMs * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check if a request exceeds rate limits.
 * @param {string} identifier - Unique client ID (e.g. IP address or user email)
 * @param {string} actionType - 'IMAGE_GEN', 'BLOG_GEN', 'AI_QUERY', 'CAMPAIGN'
 * @param {number} maxRequests - Allowed requests in window
 * @param {number} windowMs - Window duration in milliseconds (default 60s)
 * @returns {{ allowed: boolean, remaining: number, resetInMs: number }}
 */
export function checkRateLimit(identifier, actionType = "DEFAULT", maxRequests = 20, windowMs = 60000) {
  const normId = (identifier || "").toLowerCase().trim();

  // Super Admin Bypass: Zero rate limits
  if (normId === "ndantare@gmail.com" || normId === process.env.OWNER_EMAIL?.toLowerCase()) {
    return { allowed: true, remaining: 9999, resetInMs: 0 };
  }

  const key = `${normId}:${actionType}`;
  const now = Date.now();

  let record = rateLimitMap.get(key);
  if (!record || now - record.windowStart > windowMs) {
    record = {
      windowStart: now,
      windowMs,
      count: 1,
    };
    rateLimitMap.set(key, record);
    return { allowed: true, remaining: maxRequests - 1, resetInMs: windowMs };
  }

  if (record.count >= maxRequests) {
    const resetInMs = Math.max(0, record.windowStart + windowMs - now);
    return { allowed: false, remaining: 0, resetInMs };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetInMs: Math.max(0, record.windowStart + windowMs - now),
  };
}
