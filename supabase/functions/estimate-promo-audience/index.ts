import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const {
      venue_id,
      location_radius_km,
      location_lat,
      location_lng,
      cuisine_tags,
      target_past_visitors,
      time_slots,
    } = await req.json();

    if (!venue_id) {
      return new Response(JSON.stringify({ error: "venue_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all patron user IDs (profiles that are NOT venue staff)
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id")
      .limit(5000);

    const allPatronIds = new Set((allProfiles || []).map((p: any) => p.id));

    // Filter out venue staff
    const { data: staffRoles } = await supabase
      .from("user_roles")
      .select("user_id");
    const staffIds = new Set((staffRoles || []).map((r: any) => r.user_id));
    for (const sid of staffIds) allPatronIds.delete(sid);

    const breakdown: Record<string, number> = {};
    let matchedPatrons = new Set(allPatronIds);

    // 1. Location filter: patrons with check-ins at venues within radius
    if (location_radius_km && location_lat && location_lng) {
      // Get all venues within radius using Haversine approximation
      const { data: venues } = await supabase.from("venues").select("id, latitude, longitude");
      const nearbyVenueIds: string[] = [];
      for (const v of venues || []) {
        if (!v.latitude || !v.longitude) continue;
        const dist = haversineKm(location_lat, location_lng, v.latitude, v.longitude);
        if (dist <= location_radius_km) nearbyVenueIds.push(v.id);
      }

      if (nearbyVenueIds.length > 0) {
        // Patrons who have checked in, ordered, or joined waitlist at nearby venues
        const { data: checkins } = await supabase
          .from("patron_checkins")
          .select("user_id")
          .in("venue_id", nearbyVenueIds);
        const { data: orders } = await supabase
          .from("orders")
          .select("user_id")
          .in("venue_id", nearbyVenueIds)
          .not("user_id", "is", null);
        const { data: waitlist } = await supabase
          .from("waitlist_entries")
          .select("user_id")
          .in("venue_id", nearbyVenueIds)
          .not("user_id", "is", null);

        const locationPatrons = new Set<string>();
        for (const c of checkins || []) locationPatrons.add(c.user_id);
        for (const o of orders || []) if (o.user_id) locationPatrons.add(o.user_id);
        for (const w of waitlist || []) if (w.user_id) locationPatrons.add(w.user_id);

        matchedPatrons = intersect(matchedPatrons, locationPatrons);
        breakdown.location = locationPatrons.size;
      } else {
        matchedPatrons = new Set();
        breakdown.location = 0;
      }
    }

    // 2. Cuisine filter: patrons whose dining preferences match
    if (cuisine_tags && cuisine_tags.length > 0) {
      const { data: prefs } = await supabase
        .from("patron_dining_preferences")
        .select("user_id, cuisine_preferences");

      const cuisinePatrons = new Set<string>();
      for (const p of prefs || []) {
        const patronCuisines: string[] = p.cuisine_preferences || [];
        if (patronCuisines.some((c: string) => cuisine_tags.includes(c.toLowerCase()))) {
          cuisinePatrons.add(p.user_id);
        }
      }
      matchedPatrons = intersect(matchedPatrons, cuisinePatrons);
      breakdown.cuisine = cuisinePatrons.size;
    }

    // 3. Past visitors filter
    if (target_past_visitors) {
      const { data: pastOrders } = await supabase
        .from("orders")
        .select("user_id")
        .eq("venue_id", venue_id)
        .not("user_id", "is", null);
      const { data: pastWaitlist } = await supabase
        .from("waitlist_entries")
        .select("user_id")
        .eq("venue_id", venue_id)
        .not("user_id", "is", null);

      const pastVisitors = new Set<string>();
      for (const o of pastOrders || []) if (o.user_id) pastVisitors.add(o.user_id);
      for (const w of pastWaitlist || []) if (w.user_id) pastVisitors.add(w.user_id);

      matchedPatrons = intersect(matchedPatrons, pastVisitors);
      breakdown.past_visitors = pastVisitors.size;
    }

    // 4. Time-based: count patrons active during specified time slots
    if (time_slots && time_slots.length > 0) {
      // Get patron activity hours from order_analytics
      const { data: orderActivity } = await supabase
        .from("order_analytics")
        .select("venue_id, hour_of_day, day_of_week")
        .limit(2000);

      // Match patrons who have been active during the specified time slots
      // For now, time slots just affect the display scheduling, not audience filtering
      breakdown.time_based = matchedPatrons.size;
    }

    return new Response(
      JSON.stringify({
        estimated_reach: matchedPatrons.size,
        total_patrons: allPatronIds.size,
        breakdown,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function intersect(a: Set<string>, b: Set<string>): Set<string> {
  const result = new Set<string>();
  for (const id of a) {
    if (b.has(id)) result.add(id);
  }
  return result;
}