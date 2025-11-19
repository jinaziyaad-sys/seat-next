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

    // Update expired entries directly to include cancelled_by field
    const { error: updateError } = await supabaseAdmin
      .from('waitlist_entries')
      .update({
        status: 'no_show',
        cancellation_reason: 'Automatic cancellation - patron did not arrive within time limit',
        cancelled_by: 'system',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'ready')
      .not('ready_deadline', 'is', null)
      .lt('ready_deadline', new Date().toISOString());

    if (updateError) {
      console.error('Error updating expired entries:', updateError);
      throw updateError;
    }

    // Query to see how many were cancelled and send notifications
    const { data: cancelledEntries, error: queryError } = await supabaseAdmin
      .from('waitlist_entries')
      .select('id, customer_name, venue_id, user_id')
      .eq('status', 'no_show')
      .eq('cancellation_reason', 'Automatic cancellation - patron did not arrive within time limit')
      .gte('updated_at', new Date(Date.now() - 5000).toISOString()); // Updated in last 5 seconds

    if (queryError) {
      console.error('Error querying cancelled entries:', queryError);
    } else {
      console.log(`Auto-cancelled ${cancelledEntries?.length || 0} expired waitlist entries`);
      if (cancelledEntries && cancelledEntries.length > 0) {
        console.log('Cancelled entries:', cancelledEntries);
        
        // Send push notifications to affected patrons
        for (const entry of cancelledEntries) {
          if (entry.user_id) {
            try {
              const { data: profile } = await supabaseAdmin
                .from('profiles')
                .select('fcm_token')
                .eq('id', entry.user_id)
                .single();

              if (profile?.fcm_token) {
                await supabaseAdmin.functions.invoke('send-push-notification', {
                  body: {
                    fcmToken: profile.fcm_token,
                    title: 'Table Released',
                    body: 'Your table was released due to time expiration. Please join the waitlist again if needed.',
                    data: {
                      type: 'waitlist_cancelled',
                      entry_id: entry.id
                    }
                  }
                });
                console.log(`Sent cancellation notification to user ${entry.user_id}`);
              }
            } catch (notificationError) {
              console.error(`Failed to send notification for entry ${entry.id}:`, notificationError);
            }
          }
        }
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
