import { describe, it, expect } from 'vitest';
import { checkVenueStatus, getAvailableReservationTimes, calculateMinutesDiff } from '../businessHours';
import type { BusinessHours, HolidayClosure } from '../businessHours';

const defaultHours: BusinessHours = {
  monday: { open: '09:00', close: '17:00', is_closed: false },
  tuesday: { open: '09:00', close: '17:00', is_closed: false },
  wednesday: { open: '09:00', close: '17:00', is_closed: false },
  thursday: { open: '09:00', close: '17:00', is_closed: false },
  friday: { open: '09:00', close: '22:00', is_closed: false },
  saturday: { open: '10:00', close: '23:00', is_closed: false },
  sunday: { open: '00:00', close: '00:00', is_closed: true },
};

const gracePeriods = { last_reservation: 30, last_order: 15, last_waitlist_join: 30 };

describe('businessHours', () => {
  describe('checkVenueStatus', () => {
    it('should show open during business hours', () => {
      // Monday at 12:00
      const monday = new Date('2026-04-06T12:00:00');
      const status = checkVenueStatus(defaultHours, [], gracePeriods, 'waitlist', monday);
      expect(status.is_open).toBe(true);
    });

    it('should show closed on Sunday', () => {
      const sunday = new Date('2026-04-05T12:00:00');
      const status = checkVenueStatus(defaultHours, [], gracePeriods, 'waitlist', sunday);
      expect(status.is_open).toBe(false);
    });

    it('should handle holiday closures', () => {
      const holidays: HolidayClosure[] = [
        { date: '2026-04-06', is_closed: true, reason: 'Public Holiday' }
      ];
      const monday = new Date('2026-04-06T12:00:00');
      const status = checkVenueStatus(defaultHours, holidays, gracePeriods, 'waitlist', monday);
      expect(status.is_open).toBe(false);
      expect(status.message).toContain('Public Holiday');
    });
  });

  describe('calculateMinutesDiff', () => {
    it('should calculate difference correctly', () => {
      expect(calculateMinutesDiff('09:00', '10:30')).toBe(90);
      expect(calculateMinutesDiff('14:00', '14:00')).toBe(0);
    });
  });

  describe('getAvailableReservationTimes', () => {
    it('should return slots for an open day', () => {
      // Monday
      const date = new Date('2026-04-06');
      const slots = getAvailableReservationTimes(date, defaultHours, []);
      expect(slots.length).toBeGreaterThan(0);
      expect(slots[0]).toBe('09:00');
    });

    it('should return empty for closed day', () => {
      const sunday = new Date('2026-04-05');
      const slots = getAvailableReservationTimes(sunday, defaultHours, []);
      expect(slots).toEqual([]);
    });
  });
});
