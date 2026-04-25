import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getVenueLocalHour, getVenueLocalDayOfWeek, DEFAULT_TIMEZONE } from "../_shared/timezone.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { venue_id, party_size, preferences } = await req.json();

    if (!venue_id || !party_size) {
      throw new Error('venue_id and party_size are required');
    }

    // Fetch venue timezone
    const { data: venue } = await supabase
      .from('venues')
      .select('timezone')
      .eq('id', venue_id)
      .single();

    const venueTimezone = venue?.timezone || DEFAULT_TIMEZONE;

    const now = new Date();
    const dayOfWeek = getVenueLocalDayOfWeek(now, venueTimezone);
    const hourOfDay = getVenueLocalHour(now, venueTimezone);

    // Get current waitlist length
    const { count: waitlistLength } = await supabase
      .from('waitlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', venue_id)
      .eq('status', 'waiting');

    // Count imminent reservations arriving within next 30 minutes
    const thirtyMinFromNow = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    const { count: imminentReservations } = await supabase
      .from('waitlist_entries')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', venue_id)
      .eq('reservation_type', 'reservation')
      .eq('status', 'waiting')
      .gte('reservation_time', now.toISOString())
      .lte('reservation_time', thirtyMinFromNow);

    // Call database function to get dynamic wait time
    const { data: waitTimeData, error: waitError } = await supabase
      .rpc('calculate_dynamic_wait_time', {
        p_venue_id: venue_id,
        p_party_size: party_size,
        p_hour: hourOfDay,
        p_day_of_week: dayOfWeek,
        p_current_waitlist_length: (waitlistLength || 0) + (imminentReservations || 0)
      });

    if (waitError) {
      console.error('Error calculating wait time:', waitError);
      throw waitError;
    }

    const result = waitTimeData[0];

    // Get venue capacity status
    const { data: capacityData } = await supabase
      .rpc('get_venue_capacity_status', {
        p_venue_id: venue_id
      });

    const capacity = capacityData?.[0];
    let capacityFactor = 0;

    // Add buffer time if near capacity
    if (capacity?.is_busy) {
      capacityFactor = Math.ceil(result.estimated_minutes * 0.15);
    }

    const finalMinutes = result.estimated_minutes + capacityFactor;

    // Determine confidence level
    let confidenceLevel = 'low';
    if (result.confidence_score >= 85) {
      confidenceLevel = 'high';
    } else if (result.confidence_score >= 60) {
      confidenceLevel = 'medium';
    }

    const position = (waitlistLength || 0) + 1;

    console.log('Waitlist ETA calculated:', {
      venue_id,
      party_size,
      current_waitlist: waitlistLength,
      imminent_reservations: imminentReservations,
      position,
      base_minutes: result.estimated_minutes,
      final_minutes: finalMinutes,
      confidence: confidenceLevel,
      data_points: result.data_points,
      is_busy: capacity?.is_busy,
      timezone: venueTimezone,
      local_hour: hourOfDay,
      local_day: dayOfWeek
    });

    return new Response(
      JSON.stringify({
        eta_minutes: finalMinutes,
        position,
        confidence: confidenceLevel,
        confidence_score: result.confidence_score,
        breakdown: {
          historical_average: Math.round(result.base_time),
          position_factor: Math.round(result.position_multiplier),
          capacity_factor: capacityFactor,
          party_size_factor: result.party_size_factor,
          data_points: result.data_points,
          imminent_reservations: imminentReservations || 0
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-waitlist-eta:', error);
    return new Response(
      JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
