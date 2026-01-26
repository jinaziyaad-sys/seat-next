import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface YearlyRecapStats {
  total_orders: number;
  total_waitlist_joins: number;
  total_reservations: number;
  favorite_venue: { name: string; visits: number } | null;
  busiest_month: { month: number; month_name: string; count: number } | null;
  busiest_day: { day: number; day_name: string; count: number } | null;
  avg_order_wait_minutes: number | null;
  avg_table_wait_minutes: number | null;
  ratings_given: number;
  avg_rating_given: number | null;
  venues_visited: number;
}

export interface YearlyRecapData {
  year: number;
  patron_name: string;
  member_since: string | null;
  has_activity: boolean;
  stats: YearlyRecapStats;
}

const RECAP_SEEN_KEY = "yearly_recap_seen";

export function useYearlyRecap() {
  const [data, setData] = useState<YearlyRecapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecap = useCallback(async (year?: number) => {
    setLoading(true);
    setError(null);

    try {
      const { data: responseData, error: fnError } = await supabase.functions.invoke(
        "get-patron-yearly-recap",
        { body: { year: year || new Date().getFullYear() } }
      );

      if (fnError) {
        throw new Error(fnError.message);
      }

      setData(responseData as YearlyRecapData);
      return responseData as YearlyRecapData;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch recap";
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const hasSeenRecap = useCallback((year: number): boolean => {
    try {
      const seen = localStorage.getItem(RECAP_SEEN_KEY);
      if (!seen) return false;
      const seenYears: number[] = JSON.parse(seen);
      return seenYears.includes(year);
    } catch {
      return false;
    }
  }, []);

  const markRecapSeen = useCallback((year: number) => {
    try {
      const seen = localStorage.getItem(RECAP_SEEN_KEY);
      const seenYears: number[] = seen ? JSON.parse(seen) : [];
      if (!seenYears.includes(year)) {
        seenYears.push(year);
        localStorage.setItem(RECAP_SEEN_KEY, JSON.stringify(seenYears));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const shouldShowRecapAutomatically = useCallback((): { show: boolean; year: number } => {
    const now = new Date();
    const month = now.getMonth(); // 0-11
    const day = now.getDate();

    // Show between Dec 26 (month=11, day>=26) and Jan 7 (month=0, day<=7)
    const isRecapSeason =
      (month === 11 && day >= 26) || // Dec 26-31
      (month === 0 && day <= 7);     // Jan 1-7

    if (!isRecapSeason) {
      return { show: false, year: now.getFullYear() };
    }

    // Determine which year's recap to show
    // In December, show current year. In January, show previous year.
    const recapYear = month === 0 ? now.getFullYear() - 1 : now.getFullYear();

    // Check if already seen
    if (hasSeenRecap(recapYear)) {
      return { show: false, year: recapYear };
    }

    return { show: true, year: recapYear };
  }, [hasSeenRecap]);

  const clearRecapData = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    fetchRecap,
    hasSeenRecap,
    markRecapSeen,
    shouldShowRecapAutomatically,
    clearRecapData,
  };
}
