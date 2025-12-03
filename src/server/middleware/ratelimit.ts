// =============================================================================
// Rate Limiting Middleware
// =============================================================================
// In-memory rate limiter with sliding window algorithm.
// Suitable for single-instance deployments. For multi-instance/load-balanced
// setups, consider Redis-backed rate limiting.
// =============================================================================

import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: NextApiRequest) => string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store - entries auto-expire via periodic cleanup
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = forwarded
    ? (typeof forwarded === "string" ? forwarded : forwarded[0]).split(",")[0]
    : req.socket.remoteAddress || "unknown";
  return `rate-limit:${ip}`;
}

/**
 * Create a rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig) {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator } = config;

  return function rateLimitMiddleware(handler: NextApiHandler): NextApiHandler {
    return async (req: NextApiRequest, res: NextApiResponse) => {
      const key = keyGenerator(req);
      const now = Date.now();

      let entry = rateLimitStore.get(key);

      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + windowMs };
        rateLimitStore.set(key, entry);
      }

      entry.count++;

      // Set rate limit headers
      res.setHeader("X-RateLimit-Limit", maxRequests.toString());
      res.setHeader(
        "X-RateLimit-Remaining",
        Math.max(0, maxRequests - entry.count).toString()
      );
      res.setHeader(
        "X-RateLimit-Reset",
        Math.ceil(entry.resetAt / 1000).toString()
      );

      if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader("Retry-After", retryAfter.toString());
        return res.status(429).json({
          error: "Too Many Requests",
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        });
      }

      return handler(req, res);
    };
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Standard API rate limit: 60 requests per minute (configurable)
  api: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: parseInt(
      process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || "60",
      10
    ),
  }),

  // Strict limit for login attempts: 10 requests per minute (brute-force protection)
  auth: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 10,
  }),

  // Save/write operations: 60 requests per minute
  write: rateLimit({
    windowMs: 60 * 1000,
    maxRequests: parseInt(
      process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || "60",
      10
    ),
  }),
};
