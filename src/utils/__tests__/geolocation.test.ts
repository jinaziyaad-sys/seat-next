import { describe, it, expect } from 'vitest';
import { calculateDistance, formatDistance } from '../geolocation';

describe('geolocation', () => {
  describe('calculateDistance', () => {
    it('should return 0 for same point', () => {
      const dist = calculateDistance(-33.9249, 18.4241, -33.9249, 18.4241);
      expect(dist).toBe(0);
    });

    it('should calculate distance between Cape Town and Johannesburg', () => {
      // Cape Town to Johannesburg ~1260km
      const dist = calculateDistance(-33.9249, 18.4241, -26.2041, 28.0473);
      expect(dist).toBeGreaterThan(1200);
      expect(dist).toBeLessThan(1350);
    });

    it('should return same distance regardless of direction', () => {
      const d1 = calculateDistance(-33.9, 18.4, -26.2, 28.0);
      const d2 = calculateDistance(-26.2, 28.0, -33.9, 18.4);
      expect(Math.abs(d1 - d2)).toBeLessThan(0.001);
    });
  });

  describe('formatDistance', () => {
    it('should format distances under 1km in meters', () => {
      expect(formatDistance(0.5)).toBe('500m');
      expect(formatDistance(0.123)).toBe('123m');
    });

    it('should format distances over 1km in kilometers', () => {
      expect(formatDistance(5.3)).toBe('5.3km');
      expect(formatDistance(10.0)).toBe('10.0km');
    });
  });
});
