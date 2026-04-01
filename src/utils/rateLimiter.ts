/**
 * Client-side rate limiter using token bucket pattern.
 * Prevents rapid-fire API calls from flooding Supabase.
 */

interface BucketConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

const DEFAULT_CONFIG: BucketConfig = {
  maxTokens: 3,
  refillRate: 0.5, // 1 token every 2 seconds
};

const CONFIGS: Record<string, BucketConfig> = {
  'join-waitlist': { maxTokens: 2, refillRate: 0.1 },
  'place-order': { maxTokens: 3, refillRate: 0.2 },
  'send-message': { maxTokens: 5, refillRate: 1 },
  'submit-rating': { maxTokens: 2, refillRate: 0.1 },
  'data-request': { maxTokens: 1, refillRate: 0.01 },
};

function getBucket(key: string): Bucket {
  if (!buckets.has(key)) {
    const config = CONFIGS[key] || DEFAULT_CONFIG;
    buckets.set(key, { tokens: config.maxTokens, lastRefill: Date.now() });
  }
  return buckets.get(key)!;
}

function refillBucket(key: string): void {
  const bucket = getBucket(key);
  const config = CONFIGS[key] || DEFAULT_CONFIG;
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.maxTokens, bucket.tokens + elapsed * config.refillRate);
  bucket.lastRefill = now;
}

/**
 * Check if an action is allowed under rate limiting.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(key: string): boolean {
  refillBucket(key);
  const bucket = getBucket(key);
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

/**
 * Wrapper that executes an async action with rate limiting.
 * Shows a toast message when rate limited.
 */
export async function withRateLimit<T>(
  key: string,
  action: () => Promise<T>,
  onRateLimited?: () => void
): Promise<T | null> {
  if (!checkRateLimit(key)) {
    onRateLimited?.();
    return null;
  }
  return action();
}
