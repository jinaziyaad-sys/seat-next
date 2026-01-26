import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { year } = await req.json();
    const targetYear = year || new Date().getFullYear();
    const yearStart = `${targetYear}-01-01T00:00:00.000Z`;
    const yearEnd = `${targetYear}-12-31T23:59:59.999Z`;

    // Get patron profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, created_at")
      .eq("id", user.id)
      .single();

    // Get orders for the year
    const { data: orders } = await supabase
      .from("orders")
      .select("id, venue_id, created_at, status")
      .eq("user_id", user.id)
      .gte("created_at", yearStart)
      .lte("created_at", yearEnd)
      .in("status", ["collected", "ready", "in_prep", "placed"]);

    // Get waitlist entries for the year
    const { data: waitlistEntries } = await supabase
      .from("waitlist_entries")
      .select("id, venue_id, created_at, status, reservation_type")
      .eq("user_id", user.id)
      .gte("created_at", yearStart)
      .lte("created_at", yearEnd)
      .in("status", ["seated", "ready", "waiting"]);

    // Get order ratings
    const { data: orderRatings } = await supabase
      .from("order_ratings")
      .select("rating, created_at")
      .eq("user_id", user.id)
      .gte("created_at", yearStart)
      .lte("created_at", yearEnd);

    // Get waitlist ratings
    const { data: waitlistRatings } = await supabase
      .from("waitlist_ratings")
      .select("rating, created_at")
      .eq("user_id", user.id)
      .gte("created_at", yearStart)
      .lte("created_at", yearEnd);

    // Get order analytics for wait times
    const { data: orderAnalytics } = await supabase
      .from("order_analytics")
      .select("actual_prep_time, order_id")
      .in("order_id", (orders || []).map(o => o.id));

    // Get waitlist analytics for wait times
    const { data: waitlistAnalytics } = await supabase
      .from("waitlist_analytics")
      .select("actual_wait_time, entry_id")
      .in("entry_id", (waitlistEntries || []).map(w => w.id));

    // Calculate stats
    const totalOrders = orders?.length || 0;
    const totalWaitlistJoins = waitlistEntries?.filter(w => w.reservation_type === "walk_in").length || 0;
    const totalReservations = waitlistEntries?.filter(w => w.reservation_type === "reservation").length || 0;

    // Calculate favorite venue
    const venueVisits: Record<string, number> = {};
    orders?.forEach(o => {
      venueVisits[o.venue_id] = (venueVisits[o.venue_id] || 0) + 1;
    });
    waitlistEntries?.forEach(w => {
      venueVisits[w.venue_id] = (venueVisits[w.venue_id] || 0) + 1;
    });

    let favoriteVenueId: string | null = null;
    let maxVisits = 0;
    Object.entries(venueVisits).forEach(([venueId, visits]) => {
      if (visits > maxVisits) {
        maxVisits = visits;
        favoriteVenueId = venueId;
      }
    });

    let favoriteVenue = null;
    if (favoriteVenueId) {
      const { data: venue } = await supabase
        .from("venues")
        .select("name")
        .eq("id", favoriteVenueId)
        .single();
      if (venue) {
        favoriteVenue = { name: venue.name, visits: maxVisits };
      }
    }

    // Calculate busiest month
    const monthCounts: Record<number, number> = {};
    [...(orders || []), ...(waitlistEntries || [])].forEach(item => {
      const month = new Date(item.created_at).getMonth();
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });

    let busiestMonth = null;
    let maxMonthCount = 0;
    Object.entries(monthCounts).forEach(([month, count]) => {
      if (count > maxMonthCount) {
        maxMonthCount = count;
        busiestMonth = { month: parseInt(month), month_name: MONTH_NAMES[parseInt(month)], count };
      }
    });

    // Calculate busiest day of week
    const dayCounts: Record<number, number> = {};
    [...(orders || []), ...(waitlistEntries || [])].forEach(item => {
      const day = new Date(item.created_at).getDay();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });

    let busiestDay = null;
    let maxDayCount = 0;
    Object.entries(dayCounts).forEach(([day, count]) => {
      if (count > maxDayCount) {
        maxDayCount = count;
        busiestDay = { day: parseInt(day), day_name: DAY_NAMES[parseInt(day)], count };
      }
    });

    // Calculate average wait times
    const orderWaitTimes = orderAnalytics?.filter(a => a.actual_prep_time).map(a => a.actual_prep_time!) || [];
    const avgOrderWaitMinutes = orderWaitTimes.length > 0
      ? Math.round(orderWaitTimes.reduce((a, b) => a + b, 0) / orderWaitTimes.length)
      : null;

    const tableWaitTimes = waitlistAnalytics?.filter(a => a.actual_wait_time).map(a => a.actual_wait_time!) || [];
    const avgTableWaitMinutes = tableWaitTimes.length > 0
      ? Math.round(tableWaitTimes.reduce((a, b) => a + b, 0) / tableWaitTimes.length)
      : null;

    // Calculate ratings
    const allRatings = [...(orderRatings || []), ...(waitlistRatings || [])];
    const ratingsGiven = allRatings.length;
    const avgRatingGiven = ratingsGiven > 0
      ? Math.round((allRatings.reduce((a, b) => a + b.rating, 0) / ratingsGiven) * 10) / 10
      : null;

    // Count unique venues
    const venuesVisited = Object.keys(venueVisits).length;

    // Check if patron has any activity
    const hasActivity = totalOrders > 0 || totalWaitlistJoins > 0 || totalReservations > 0;

    const response = {
      year: targetYear,
      patron_name: profile?.full_name?.split(" ")[0] || "there",
      member_since: profile?.created_at || null,
      has_activity: hasActivity,
      stats: {
        total_orders: totalOrders,
        total_waitlist_joins: totalWaitlistJoins,
        total_reservations: totalReservations,
        favorite_venue: favoriteVenue,
        busiest_month: busiestMonth,
        busiest_day: busiestDay,
        avg_order_wait_minutes: avgOrderWaitMinutes,
        avg_table_wait_minutes: avgTableWaitMinutes,
        ratings_given: ratingsGiven,
        avg_rating_given: avgRatingGiven,
        venues_visited: venuesVisited,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-patron-yearly-recap:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
