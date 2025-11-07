import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Checking for upcoming reservations...');

    // Find reservations within 30 minutes that are still in waiting status
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60000);
    
    const { data: upcomingReservations, error } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('reservation_type', 'reservation')
      .eq('status', 'waiting')
      .lte('reservation_time', thirtyMinutesFromNow.toISOString())
      .gte('reservation_time', new Date().toISOString());

    if (error) {
      console.error('Error fetching reservations:', error);
      throw error;
    }

    console.log(`Found ${upcomingReservations?.length || 0} upcoming reservations`);

    // These reservations are ready to be highlighted - they'll show in the "ARRIVING SOON" section
    // No status change needed, the UI will handle highlighting based on time

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: upcomingReservations?.length || 0,
        message: 'Upcoming reservations checked successfully',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in activate-upcoming-reservations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});