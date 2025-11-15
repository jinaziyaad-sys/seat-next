import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('Starting auto-cancel check for expired waitlist entries...');

    // Call the database function to cancel expired entries
    const { error: functionError } = await supabaseAdmin.rpc('cancel_expired_ready_entries');

    if (functionError) {
      console.error('Error calling cancel_expired_ready_entries:', functionError);
      throw functionError;
    }

    // Query to see how many were cancelled
    const { data: cancelledEntries, error: queryError } = await supabaseAdmin
      .from('waitlist_entries')
      .select('id, customer_name, venue_id')
      .eq('status', 'no_show')
      .eq('cancellation_reason', 'Automatic cancellation - patron did not arrive within time limit')
      .gte('updated_at', new Date(Date.now() - 5000).toISOString()); // Updated in last 5 seconds

    if (queryError) {
      console.error('Error querying cancelled entries:', queryError);
    } else {
      console.log(`Auto-cancelled ${cancelledEntries?.length || 0} expired waitlist entries`);
      if (cancelledEntries && cancelledEntries.length > 0) {
        console.log('Cancelled entries:', cancelledEntries);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cancelled_count: cancelledEntries?.length || 0,
        message: 'Auto-cancel check completed',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in auto-cancel-expired-waitlist:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
