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

    const { venue_id, items, order_number } = await req.json();

    if (!venue_id) {
      throw new Error('venue_id is required');
    }

    // Fetch venue settings including timezone
    const { data: venue, error: venueError } = await supabase
      .from('venues')
      .select('settings, timezone')
      .eq('id', venue_id)
      .single();

    if (venueError) {
      console.error('Error fetching venue:', venueError);
      throw venueError;
    }

    const venueSettings = venue?.settings as any || {};
    const prepTimeMode = venueSettings.prep_time_mode || 'analytics';
    const fixedPrepTime = venueSettings.default_prep_time || 15;
    const venueTimezone = venue?.timezone || DEFAULT_TIMEZONE;

    // If fixed mode, return the configured prep time directly
    if (prepTimeMode === 'fixed') {
      console.log('Order ETA (fixed mode):', {
        order_number,
        venue_id,
        prep_time: fixedPrepTime,
        mode: 'fixed',
        timezone: venueTimezone
      });

      return new Response(
        JSON.stringify({
          eta_minutes: fixedPrepTime,
          confidence: 'high', // Fixed mode = high confidence (predictable)
          confidence_score: 100,
          breakdown: {
            base_time: fixedPrepTime,
            load_factor: 1.0,
            complexity_factor: 1.0,
            data_points: 0,
            mode: 'fixed'
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analytics mode - use dynamic calculation with venue timezone
    const now = new Date();
    const dayOfWeek = getVenueLocalDayOfWeek(now, venueTimezone);
    const hourOfDay = getVenueLocalHour(now, venueTimezone);

    // Get current kitchen load
    const { count: currentLoad } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', venue_id)
      .in('status', ['placed', 'in_prep']);

    // Calculate items count for complexity
    const itemsCount = Array.isArray(items) ? items.length : 0;

    // Call database function to get dynamic prep time
    const { data: prepTimeData, error: prepError } = await supabase
      .rpc('calculate_dynamic_prep_time', {
        p_venue_id: venue_id,
        p_hour: hourOfDay,
        p_day_of_week: dayOfWeek,
        p_current_load: currentLoad || 0
      });

    if (prepError) {
      console.error('Error calculating prep time:', prepError);
      throw prepError;
    }

    const result = prepTimeData[0];
    
    // Apply complexity multiplier based on items count
    let complexityFactor = 1.0;
    if (itemsCount > 5) {
      complexityFactor = 1.2;
    } else if (itemsCount > 3) {
      complexityFactor = 1.1;
    }

    const finalMinutes = Math.ceil(result.estimated_minutes * complexityFactor);

    // Determine confidence level
    let confidenceLevel = 'low';
    if (result.confidence_score >= 85) {
      confidenceLevel = 'high';
    } else if (result.confidence_score >= 60) {
      confidenceLevel = 'medium';
    }

    console.log('Order ETA (analytics mode):', {
      order_number,
      venue_id,
      items_count: itemsCount,
      current_load: currentLoad,
      base_minutes: result.estimated_minutes,
      final_minutes: finalMinutes,
      confidence: confidenceLevel,
      data_points: result.data_points,
      mode: 'analytics',
      timezone: venueTimezone,
      local_hour: hourOfDay,
      local_day: dayOfWeek
    });

    return new Response(
      JSON.stringify({
        eta_minutes: finalMinutes,
        confidence: confidenceLevel,
        confidence_score: result.confidence_score,
        breakdown: {
          base_time: Math.round(result.base_time),
          load_factor: result.load_multiplier,
          complexity_factor: complexityFactor,
          data_points: result.data_points,
          mode: 'analytics'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-order-eta:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});