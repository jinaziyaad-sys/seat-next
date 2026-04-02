import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, withRateLimit } from '../rateLimiter';

describe('rateLimiter', () => {
  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      expect(checkRateLimit('test-action-1')).toBe(true);
    });

    it('should allow requests up to max tokens', () => {
      // Default maxTokens is 3
      const key = 'test-default-' + Date.now();
      expect(checkRateLimit(key)).toBe(true);
      expect(checkRateLimit(key)).toBe(true);
      expect(checkRateLimit(key)).toBe(true);
    });

    it('should block after tokens exhausted', () => {
      const key = 'test-exhaust-' + Date.now();
      checkRateLimit(key);
      checkRateLimit(key);
      checkRateLimit(key);
      expect(checkRateLimit(key)).toBe(false);
    });
  });

  describe('withRateLimit', () => {
    it('should execute action when not rate limited', async () => {
      const key = 'test-with-' + Date.now();
      const result = await withRateLimit(key, async () => 'success');
      expect(result).toBe('success');
    });

    it('should return null and call callback when rate limited', async () => {
      const key = 'test-limited-' + Date.now();
      // Exhaust tokens
      await withRateLimit(key, async () => 'ok');
      await withRateLimit(key, async () => 'ok');
      await withRateLimit(key, async () => 'ok');

      let callbackCalled = false;
      const result = await withRateLimit(
        key,
        async () => 'should not run',
        () => { callbackCalled = true; }
      );
      expect(result).toBeNull();
      expect(callbackCalled).toBe(true);
    });
  });
});
