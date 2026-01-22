import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { differenceInMinutes, differenceInHours, differenceInDays, differenceInWeeks, isTomorrow as dateFnsIsTomorrow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats time until a target date in a human-friendly way
 * Examples: "1 week to go", "5 days to go", "3 hours to go", "45 min to go"
 */
export function formatTimeUntil(targetDate: Date): string {
  const now = new Date();
  const diffMinutes = differenceInMinutes(targetDate, now);
  const diffHours = differenceInHours(targetDate, now);
  const diffDays = differenceInDays(targetDate, now);
  const diffWeeks = differenceInWeeks(targetDate, now);
  
  // Past time
  if (diffMinutes <= 0) {
    return 'Starting now';
  }
  
  // More than 1 week away
  if (diffWeeks >= 1) {
    return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} to go`;
  }
  
  // 2-7 days away
  if (diffDays >= 2) {
    return `${diffDays} days to go`;
  }
  
  // Tomorrow (1 day away)
  if (dateFnsIsTomorrow(targetDate) || diffDays === 1) {
    return '1 day to go';
  }
  
  // Same day, more than 1 hour
  if (diffHours >= 1) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} to go`;
  }
  
  // Less than 1 hour - show minutes
  return `${diffMinutes} min to go`;
}
