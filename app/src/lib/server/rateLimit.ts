/**
 * Production-ready Rate Limiting
 * 
 * For production, this should use Redis or a distributed cache.
 * Currently uses in-memory Map which is suitable for single-instance deployments.
 * 
 * To upgrade to Redis:
 * 1. Install ioredis: npm install ioredis
 * 2. Set REDIS_URL environment variable
 * 3. Replace the Map implementation with Redis operations
 */

type LimitEntry = {
    count: number;
    resetAt: number;
};

type RateLimitOptions = {
    key: string;
    limit: number;
    windowMs: number;
};

const MAX_RATE_LIMIT_KEYS = 5000;
const rateLimitStore = new Map<string, LimitEntry>();

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
    const now = Date.now();

    // Clean up expired entries
    for (const [entryKey, entry] of rateLimitStore) {
        if (entry.resetAt <= now) rateLimitStore.delete(entryKey);
    }

    // Prevent memory overflow
    if (rateLimitStore.size >= MAX_RATE_LIMIT_KEYS) {
        const oldestKey = rateLimitStore.keys().next().value;
        if (oldestKey) rateLimitStore.delete(oldestKey);
    }

    const entry = rateLimitStore.get(key);
    if (!entry || entry.resetAt <= now) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return { success: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    if (entry.count >= limit) {
        return { success: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count += 1;
    return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export function rateLimitResponse(resetAt: number) {
    const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
    return new Response(
        JSON.stringify({ error: "Too many requests. Please try again shortly." }),
        {
            status: 429,
            headers: {
                "Content-Type": "application/json",
                "Retry-After": String(retryAfter),
            },
        }
    );
}
