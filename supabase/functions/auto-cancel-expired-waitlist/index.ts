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

    const now = new Date();
    console.log('Starting auto-cancel check...', now.toISOString());

    // ========================================
    // STEP 1: Cancel expired "ready" walk-in entries
    // ========================================
    console.log('Step 1: Checking for expired ready entries with ready_deadline...');

    const { error: updateError } = await supabaseAdmin
      .from('waitlist_entries')
      .update({
        status: 'no_show',
        cancellation_reason: 'Automatic cancellation - patron did not arrive within time limit',
        cancelled_by: 'system',
        updated_at: now.toISOString()
      })
      .eq('status', 'ready')
      .not('ready_deadline', 'is', null)
      .lt('ready_deadline', now.toISOString());

    if (updateError) {
      console.error('Error updating expired ready entries:', updateError);
      throw updateError;
    }

    // Query to see how many were cancelled and send notifications
    const { data: cancelledReadyEntries, error: queryError } = await supabaseAdmin
      .from('waitlist_entries')
      .select('id, customer_name, venue_id, user_id')
      .eq('status', 'no_show')
      .eq('cancellation_reason', 'Automatic cancellation - patron did not arrive within time limit')
      .gte('updated_at', new Date(Date.now() - 5000).toISOString());

    if (queryError) {
      console.error('Error querying cancelled ready entries:', queryError);
    } else {
      console.log(`Step 1: Auto-cancelled ${cancelledReadyEntries?.length || 0} expired ready entries`);
      
      // Send push notifications to affected patrons
      for (const entry of cancelledReadyEntries || []) {
        if (entry.user_id) {
          await sendPatronNotification(supabaseAdmin, entry.user_id, entry.id, 'Table Released', 
            'Your table was released due to time expiration. Please join the waitlist again if needed.');
        }
      }
    }

    // ========================================
    // STEP 2: Cancel overdue reservations
    // ========================================
    console.log('Step 2: Checking for overdue reservations...');

    // Get all venues with their settings
    const { data: venues, error: venuesError } = await supabaseAdmin
      .from('venues')
      .select('id, name, settings');

    if (venuesError) {
      console.error('Error fetching venues:', venuesError);
      throw venuesError;
    }

    let totalReservationsCancelled = 0;
    const cancelledReservationEntries: Array<{ id: string; customer_name: string; venue_id: string; user_id: string | null }> = [];

    // Process each venue with its own auto_no_show_time setting
    for (const venue of venues || []) {
      // Default to 15 minutes if not set
      const autoNoShowMinutes = (venue.settings as any)?.auto_no_show_time || 15;
      const cutoffTime = new Date(now.getTime() - autoNoShowMinutes * 60000);
      
      console.log(`Venue "${venue.name}": auto_no_show_time=${autoNoShowMinutes}min, cutoff=${cutoffTime.toISOString()}`);

      // Update overdue reservations for this venue
      const { error: reservationUpdateError } = await supabaseAdmin
        .from('waitlist_entries')
        .update({
          status: 'no_show',
          cancellation_reason: `No-show - patron did not arrive within ${autoNoShowMinutes} minutes of reservation time`,
          cancelled_by: 'system',
          updated_at: now.toISOString()
        })
        .eq('venue_id', venue.id)
        .eq('reservation_type', 'reservation')
        .eq('status', 'waiting')
        .not('reservation_time', 'is', null)
        .lt('reservation_time', cutoffTime.toISOString());

      if (reservationUpdateError) {
        console.error(`Error updating overdue reservations for venue ${venue.id}:`, reservationUpdateError);
        continue;
      }

      // Query recently cancelled reservations for this venue
      const { data: venueCancelled, error: venueQueryError } = await supabaseAdmin
        .from('waitlist_entries')
        .select('id, customer_name, venue_id, user_id')
        .eq('venue_id', venue.id)
        .eq('status', 'no_show')
        .eq('cancelled_by', 'system')
        .like('cancellation_reason', 'No-show - patron did not arrive within%')
        .gte('updated_at', new Date(Date.now() - 5000).toISOString());

      if (!venueQueryError && venueCancelled) {
        totalReservationsCancelled += venueCancelled.length;
        cancelledReservationEntries.push(...venueCancelled);
        
        if (venueCancelled.length > 0) {
          console.log(`Venue "${venue.name}": cancelled ${venueCancelled.length} overdue reservations`);
        }
      }
    }

    console.log(`Step 2: Total overdue reservations cancelled: ${totalReservationsCancelled}`);

    // Send push notifications for cancelled reservations
    for (const entry of cancelledReservationEntries) {
      if (entry.user_id) {
        await sendPatronNotification(supabaseAdmin, entry.user_id, entry.id, 'Reservation Released',
          "Your reservation was released because you didn't arrive within the grace period. Please make a new reservation if you still wish to dine.");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ready_entries_cancelled: cancelledReadyEntries?.length || 0,
        reservations_cancelled: totalReservationsCancelled,
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

// Helper function to send push notification to patron
async function sendPatronNotification(
  supabaseAdmin: any, 
  userId: string, 
  entryId: string, 
  title: string, 
  body: string
) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('fcm_token')
      .eq('id', userId)
      .single();

    if (profile?.fcm_token) {
      await supabaseAdmin.functions.invoke('send-push-notification', {
        body: {
          fcmToken: profile.fcm_token,
          title,
          body,
          data: {
            type: 'waitlist_cancelled',
            entry_id: entryId
          }
        }
      });
      console.log(`Sent cancellation notification to user ${userId}`);
    }
  } catch (notificationError) {
    console.error(`Failed to send notification for entry ${entryId}:`, notificationError);
  }
}
