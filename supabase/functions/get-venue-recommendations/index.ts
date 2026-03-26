import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VenueAttributes {
  cuisine_types?: string[];
  dietary_certifications?: {
    halaal?: boolean;
    vegetarian_friendly?: boolean;
    vegan_options?: boolean;
    kosher?: boolean;
    gluten_free_options?: boolean;
  };
  price_range?: string;
  ambiance?: string[];
  features?: string[];
}

interface PatronPreferences {
  dietary_requirements: string[];
  cuisine_preferences: string[];
  avoid_ingredients: string[];
  max_wait_minutes: number;
}

interface VenueData {
  id: string;
  name: string;
  address: string | null;
  display_address: string | null;
  latitude: number | null;
  longitude: number | null;
  settings: { venue_attributes?: VenueAttributes } | null;
  waitlist_count: number;
  avg_rating: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { user_id, location, filters, radius_km } = await req.json();

    // 1. Fetch patron preferences if user is logged in
    let patronPreferences: PatronPreferences | null = null;
    if (user_id) {
      const { data: prefData } = await supabase
        .from("patron_dining_preferences")
        .select("*")
        .eq("user_id", user_id)
        .maybeSingle();

      if (prefData) {
        patronPreferences = prefData as PatronPreferences;
      }
    }

    // 2. Fetch all venues with their attributes
    const { data: venues, error: venuesError } = await supabase
      .from("venues")
      .select("id, name, address, display_address, latitude, longitude, settings");

    if (venuesError) {
      throw new Error(`Failed to fetch venues: ${venuesError.message}`);
    }

    if (!venues || venues.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get current waitlist counts for busyness
    const { data: waitlistCounts } = await supabase
      .from("waitlist_entries")
      .select("venue_id")
      .eq("status", "waiting");

    const venueWaitlistMap: Record<string, number> = {};
    waitlistCounts?.forEach((entry) => {
      venueWaitlistMap[entry.venue_id] = (venueWaitlistMap[entry.venue_id] || 0) + 1;
    });

    // 4. Get average ratings per venue
    const { data: orderRatings } = await supabase
      .from("order_ratings")
      .select("venue_id, rating");

    const { data: waitlistRatings } = await supabase
      .from("waitlist_ratings")
      .select("venue_id, rating");

    const venueRatings: Record<string, { sum: number; count: number }> = {};
    [...(orderRatings || []), ...(waitlistRatings || [])].forEach((r) => {
      if (!venueRatings[r.venue_id]) {
        venueRatings[r.venue_id] = { sum: 0, count: 0 };
      }
      venueRatings[r.venue_id].sum += r.rating;
      venueRatings[r.venue_id].count += 1;
    });

    // 5. Build venue data with computed fields
    const venueDataList: VenueData[] = venues.map((venue) => {
      const waitlistCount = venueWaitlistMap[venue.id] || 0;
      const ratingData = venueRatings[venue.id];
      const avgRating = ratingData ? ratingData.sum / ratingData.count : 0;

      return {
        id: venue.id,
        name: venue.name,
        address: venue.display_address || venue.address,
        display_address: venue.display_address,
        latitude: venue.latitude,
        longitude: venue.longitude,
        settings: venue.settings as { venue_attributes?: VenueAttributes } | null,
        waitlist_count: waitlistCount,
        avg_rating: avgRating,
      };
    });

    // 6. Calculate distance if user location is provided
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Earth's radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    // 6b. Filter by radius if location and radius_km are provided
    const maxRadius = radius_km && location?.lat && location?.lng ? radius_km : null;
    const filteredByRadius = maxRadius
      ? venueDataList.filter((venue) => {
          if (!venue.latitude || !venue.longitude) return false;
          const dist = calculateDistance(location.lat, location.lng, venue.latitude, venue.longitude);
          return dist <= maxRadius;
        })
      : venueDataList;

    // 7. Score and rank venues
    const scoredVenues = filteredByRadius.map((venue) => {
      const attributes = venue.settings?.venue_attributes;
      let score = 50; // Base score

      // Distance factor (if available)
      let distance: number | null = null;
      if (location?.lat && location?.lng && venue.latitude && venue.longitude) {
        distance = calculateDistance(location.lat, location.lng, venue.latitude, venue.longitude);
        // Closer is better: within 2km = +20, within 5km = +10, within 10km = +5
        if (distance < 2) score += 20;
        else if (distance < 5) score += 10;
        else if (distance < 10) score += 5;
      }

      // Rating factor
      if (venue.avg_rating >= 4.5) score += 15;
      else if (venue.avg_rating >= 4) score += 10;
      else if (venue.avg_rating >= 3.5) score += 5;

      // Busyness factor (prefer quieter venues)
      if (venue.waitlist_count === 0) score += 15;
      else if (venue.waitlist_count <= 3) score += 10;
      else if (venue.waitlist_count <= 5) score += 5;

      // Preference matching (if user has preferences)
      if (patronPreferences) {
        // Dietary match
        const dietaryCerts = attributes?.dietary_certifications || {};
        patronPreferences.dietary_requirements.forEach((req) => {
          if (req === "halaal" && dietaryCerts.halaal) score += 15;
          if (req === "vegetarian" && dietaryCerts.vegetarian_friendly) score += 15;
          if (req === "vegan" && dietaryCerts.vegan_options) score += 15;
          if (req === "kosher" && dietaryCerts.kosher) score += 15;
          if (req === "gluten_free" && dietaryCerts.gluten_free_options) score += 15;
        });

        // Cuisine match
        const cuisines = attributes?.cuisine_types || [];
        patronPreferences.cuisine_preferences.forEach((pref) => {
          if (cuisines.includes(pref)) score += 10;
        });

        // Wait time preference
        const estimatedWait = venue.waitlist_count * 5; // rough estimate
        if (estimatedWait <= patronPreferences.max_wait_minutes) score += 10;
      }

      // Determine busyness level
      let busyness: "quiet" | "moderate" | "busy" | "very_busy" = "quiet";
      if (venue.waitlist_count > 10) busyness = "very_busy";
      else if (venue.waitlist_count > 5) busyness = "busy";
      else if (venue.waitlist_count > 2) busyness = "moderate";

      // Estimate wait time
      const waitMinutes = venue.waitlist_count * 5;
      const waitEstimate = waitMinutes === 0 ? "No wait" : `~${waitMinutes} min`;

      return {
        venue_id: venue.id,
        name: venue.name,
        match_score: Math.min(100, Math.max(0, score)),
        busyness,
        avg_rating: Math.round(venue.avg_rating * 10) / 10,
        wait_estimate: waitEstimate,
        distance_km: distance ? Math.round(distance * 10) / 10 : null,
        ai_reason: "", // Will be filled by AI
        cuisine_types: attributes?.cuisine_types || [],
        dietary_certifications: attributes?.dietary_certifications || {},
        address: venue.address,
      };
    });

    // Sort by score
    scoredVenues.sort((a, b) => b.match_score - a.match_score);

    // Take top 10
    const topVenues = scoredVenues.slice(0, 10);

    // 8. Generate AI reasons if API key is available
    if (LOVABLE_API_KEY && topVenues.length > 0) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are a helpful restaurant recommendation assistant. Generate brief, personalized 1-sentence reasons why each venue would be a good match for a diner. Be specific about dietary options, cuisine, wait times, or ratings. Keep each reason under 15 words.`,
              },
              {
                role: "user",
                content: `Generate personalized recommendation reasons for these venues:

${topVenues
  .map(
    (v, i) =>
      `${i + 1}. ${v.name}: ${v.cuisine_types.join(", ") || "Various"} cuisine, ${
        v.dietary_certifications.halaal ? "Halaal certified, " : ""
      }${v.dietary_certifications.vegetarian_friendly ? "Vegetarian-friendly, " : ""}Rating: ${
        v.avg_rating || "N/A"
      }, Wait: ${v.wait_estimate}, Match: ${v.match_score}%`
  )
  .join("\n")}

${
  patronPreferences
    ? `User preferences: ${patronPreferences.dietary_requirements.join(", ") || "None"} dietary, ${
        patronPreferences.cuisine_preferences.join(", ") || "Any"
      } cuisines preferred, max ${patronPreferences.max_wait_minutes} min wait.`
    : "User has no saved preferences."
}

Return ONLY a JSON array with objects containing venue_id and reason. Example:
[{"venue_id": "abc", "reason": "Perfect halaal option with short wait"}]`,
              },
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          
          // Parse JSON from response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            try {
              const reasons = JSON.parse(jsonMatch[0]);
              reasons.forEach((r: { venue_id: string; reason: string }) => {
                const venue = topVenues.find((v) => v.venue_id === r.venue_id || v.name.includes(r.venue_id));
                if (venue) {
                  venue.ai_reason = r.reason;
                }
              });
            } catch (parseError) {
              console.error("Failed to parse AI reasons:", parseError);
            }
          }
        }
      } catch (aiError) {
        console.error("AI recommendation error:", aiError);
        // Continue without AI reasons
      }
    }

    // Generate fallback reasons for venues without AI reason
    topVenues.forEach((venue) => {
      if (!venue.ai_reason) {
        const parts: string[] = [];
        if (venue.dietary_certifications?.halaal) parts.push("Halaal certified");
        if (venue.dietary_certifications?.vegetarian_friendly) parts.push("Vegetarian options");
        if (venue.avg_rating >= 4.5) parts.push("Highly rated");
        if (venue.busyness === "quiet") parts.push("No wait right now");
        
        venue.ai_reason = parts.length > 0 
          ? parts.slice(0, 2).join(" • ") 
          : "Discover something new";
      }
    });

    return new Response(
      JSON.stringify({ recommendations: topVenues }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in get-venue-recommendations:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
