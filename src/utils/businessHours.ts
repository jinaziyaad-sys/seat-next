export interface BusinessHours {
  [key: string]: {
    open: string;
    close: string;
    is_closed: boolean;
    breaks?: Array<{ start: string; end: string; reason: string }>;
  };
}

export interface HolidayClosure {
  date: string;
  is_closed: boolean;
  reason: string;
  special_hours?: { open: string; close: string };
  breaks?: Array<{ start: string; end: string; reason: string }>;
}

export interface VenueStatus {
  is_open: boolean;
  is_on_break: boolean;
  current_break_reason?: string;
  break_ends_at?: string;
  closes_at?: string;
  opens_at?: string;
  next_opening?: { day: string; time: string };
  message: string;
}

export function checkVenueStatus(
  businessHours: BusinessHours,
  holidayClosures: HolidayClosure[],
  gracePeriods: { last_reservation: number; last_order: number; last_waitlist_join: number },
  checkType: 'reservation' | 'order' | 'waitlist' = 'waitlist',
  targetDateTime?: Date
): VenueStatus {
  const now = targetDateTime || new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  // Use local date to match how holidays are stored (avoiding UTC timezone shifts)
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  // Check for holiday closure first
  const holidayClosure = holidayClosures.find(h => h.date === currentDate);
  
  if (holidayClosure) {
    if (holidayClosure.is_closed) {
      const nextOpening = findNextOpening(now, businessHours, holidayClosures);
      return {
        is_open: false,
        is_on_break: false,
        opens_at: nextOpening.time,
        next_opening: nextOpening,
        message: `Closed for ${holidayClosure.reason}. Opens ${nextOpening.day} at ${nextOpening.time}`
      };
    }
    
    // Special hours for this holiday
    if (holidayClosure.special_hours) {
      const specialHours = holidayClosure.special_hours;
      const isWithinSpecialHours = isTimeInRange(currentTime, specialHours.open, specialHours.close);
      
      if (!isWithinSpecialHours) {
        return {
          is_open: false,
          is_on_break: false,
          opens_at: specialHours.open,
          closes_at: specialHours.close,
          message: `Special hours today: ${specialHours.open} - ${specialHours.close}`
        };
      }
      
      // Check for breaks during special hours
      const activeBreak = (holidayClosure.breaks || []).find(b => 
        isTimeInRange(currentTime, b.start, b.end)
      );
      
      if (activeBreak) {
        return {
          is_open: false,
          is_on_break: true,
          current_break_reason: activeBreak.reason,
          break_ends_at: activeBreak.end,
          message: `Currently on break: ${activeBreak.reason}. Resumes at ${activeBreak.end}`
        };
      }
      
      // Apply grace period
      const gracePeriod = getGracePeriod(checkType, gracePeriods);
      const closingSoon = isApproachingTime(currentTime, specialHours.close, gracePeriod);
      
      return {
        is_open: !closingSoon,
        is_on_break: false,
        closes_at: specialHours.close,
        message: closingSoon ? `Closing soon at ${specialHours.close}` : `Open until ${specialHours.close}`
      };
    }
  }
  
  // Regular day-of-week hours
  const todayHours = businessHours[currentDay];
  
  if (!todayHours || todayHours.is_closed) {
    const nextOpening = findNextOpening(now, businessHours, holidayClosures);
    return {
      is_open: false,
      is_on_break: false,
      opens_at: nextOpening.time,
      next_opening: nextOpening,
      message: `Closed today. Opens ${nextOpening.day} at ${nextOpening.time}`
    };
  }
  
  const isWithinHours = isTimeInRange(currentTime, todayHours.open, todayHours.close);
  
  if (!isWithinHours) {
    if (currentTime < todayHours.open) {
      return {
        is_open: false,
        is_on_break: false,
        opens_at: todayHours.open,
        message: `Opens today at ${todayHours.open}`
      };
    } else {
      const nextOpening = findNextOpening(now, businessHours, holidayClosures);
      return {
        is_open: false,
        is_on_break: false,
        opens_at: nextOpening.time,
        next_opening: nextOpening,
        message: `Closed. Opens ${nextOpening.day} at ${nextOpening.time}`
      };
    }
  }
  
  // Check for active breaks
  const activeBreak = (todayHours.breaks || []).find(b => 
    isTimeInRange(currentTime, b.start, b.end)
  );
  
  if (activeBreak) {
    return {
      is_open: false,
      is_on_break: true,
      current_break_reason: activeBreak.reason,
      break_ends_at: activeBreak.end,
      closes_at: todayHours.close,
      message: `Currently on break: ${activeBreak.reason}. Resumes at ${activeBreak.end}`
    };
  }
  
  // Apply grace period
  const gracePeriod = getGracePeriod(checkType, gracePeriods);
  const closingSoon = isApproachingTime(currentTime, todayHours.close, gracePeriod);
  
  return {
    is_open: !closingSoon,
    is_on_break: false,
    closes_at: todayHours.close,
    message: closingSoon ? `Closing soon at ${todayHours.close}` : `Open until ${todayHours.close}`
  };
}

function isTimeInRange(time: string, start: string, end: string): boolean {
  // Handle overnight hours (e.g., 22:00 to 02:00)
  if (start > end) {
    return time >= start || time <= end;
  }
  return time >= start && time <= end;
}

function isApproachingTime(current: string, target: string, minutesBefore: number): boolean {
  const [currH, currM] = current.split(':').map(Number);
  const [targH, targM] = target.split(':').map(Number);
  
  const currMinutes = currH * 60 + currM;
  const targMinutes = targH * 60 + targM;
  const diff = targMinutes - currMinutes;
  
  return diff <= minutesBefore && diff >= 0;
}

function getGracePeriod(checkType: string, gracePeriods: any): number {
  switch (checkType) {
    case 'reservation': return gracePeriods.last_reservation || 0;
    case 'order': return gracePeriods.last_order || 15;
    case 'waitlist': return gracePeriods.last_waitlist_join || 30;
    default: return 0;
  }
}

function findNextOpening(
  from: Date,
  businessHours: BusinessHours,
  holidayClosures: HolidayClosure[]
): { day: string; time: string } {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(from);
    checkDate.setDate(checkDate.getDate() + i);
    const checkDayIndex = checkDate.getDay();
    const checkDayKey = dayKeys[checkDayIndex];
    // Use local date to match how holidays are stored
    const checkDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    
    // Check if it's a holiday
    const holiday = holidayClosures.find(h => h.date === checkDateStr);
    if (holiday) {
      if (holiday.is_closed) continue;
      if (holiday.special_hours) {
        return {
          day: i === 1 ? 'tomorrow' : dayNames[checkDayIndex],
          time: holiday.special_hours.open
        };
      }
    }
    
    // Check regular hours
    const dayHours = businessHours[checkDayKey];
    if (dayHours && !dayHours.is_closed) {
      return {
        day: i === 1 ? 'tomorrow' : dayNames[checkDayIndex],
        time: dayHours.open
      };
    }
  }
  
  return { day: 'soon', time: '09:00' };
}

export function getAvailableReservationTimes(
  date: Date,
  businessHours: BusinessHours,
  holidayClosures: HolidayClosure[],
  intervalMinutes: number = 15
): string[] {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayNames[date.getDay()];
  // Use local date to match how holidays are stored
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  
  // Check holiday first
  const holiday = holidayClosures.find(h => h.date === dateStr);
  let open: string, close: string, breaks: any[] = [];
  
  if (holiday) {
    if (holiday.is_closed) return [];
    if (holiday.special_hours) {
      open = holiday.special_hours.open;
      close = holiday.special_hours.close;
      breaks = holiday.breaks || [];
    } else {
      const dayHours = businessHours[dayKey];
      if (!dayHours || dayHours.is_closed) return [];
      open = dayHours.open;
      close = dayHours.close;
      breaks = dayHours.breaks || [];
    }
  } else {
    const dayHours = businessHours[dayKey];
    if (!dayHours || dayHours.is_closed) return [];
    open = dayHours.open;
    close = dayHours.close;
    breaks = dayHours.breaks || [];
  }
  
  // Generate time slots
  const slots: string[] = [];
  const [openH, openM] = open.split(':').map(Number);
  const [closeH, closeM] = close.split(':').map(Number);
  
  let currentMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM + (closeH < openH ? 1440 : 0); // Handle overnight
  
  while (currentMinutes < closeMinutes - 30) { // End 30 mins before close
    const hours = Math.floor(currentMinutes / 60) % 24;
    const minutes = currentMinutes % 60;
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    // Check if time falls during a break
    const isDuringBreak = breaks.some(b => 
      isTimeInRange(timeStr, b.start, b.end)
    );
    
    if (!isDuringBreak) {
      slots.push(timeStr);
    }
    
    currentMinutes += intervalMinutes;
  }
  
  return slots;
}

export function calculateMinutesDiff(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  
  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;
  
  return Math.abs(minutes2 - minutes1);
}

export function isWithinOperatingHours(timestamp: string, settings: any): boolean {
  const date = new Date(timestamp);
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayNames[date.getDay()];
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const dateStr = date.toISOString().split('T')[0];
  
  const businessHours = settings.business_hours || {};
  const holidayClosures = settings.holiday_closures || [];
  
  // Check holiday
  const holiday = holidayClosures.find((h: HolidayClosure) => h.date === dateStr);
  if (holiday) {
    if (holiday.is_closed) return false;
    if (holiday.special_hours) {
      return isTimeInRange(time, holiday.special_hours.open, holiday.special_hours.close);
    }
  }
  
  // Check regular hours
  const dayHours = businessHours[dayKey];
  if (!dayHours || dayHours.is_closed) return false;
  
  return isTimeInRange(time, dayHours.open, dayHours.close);
}
