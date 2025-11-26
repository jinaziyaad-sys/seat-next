import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log('Starting cancelled waitlist entries cleanup...');

    // Get all venues with their COB settings
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('id, name, settings');

    if (venuesError) throw venuesError;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    let totalDeleted = 0;

    for (const venue of venues || []) {
      const settings = venue.settings as any || {};
      const cobTime = settings.cob_time || '23:00';
      const autoCleanup = settings.auto_cleanup_cancelled_waitlist !== false; // Default true

      if (!autoCleanup) {
        console.log(`Skipping ${venue.name} - auto-cleanup disabled`);
        continue;
      }

      // Check if current time matches COB time (within 5 minute window)
      const [cobHour, cobMinute] = cobTime.split(':').map(Number);
      const [currentHour, currentMinute] = currentTime.split(':').map(Number);
      
      const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (cobHour * 60 + cobMinute));
      
      if (timeDiff <= 5) { // Within 5 minutes of COB
        console.log(`Cleaning up cancelled waitlist entries for ${venue.name} at COB ${cobTime}`);
        
        // Delete cancelled/no-show entries older than 2 hours
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        
        const { data: deletedEntries, error: deleteError } = await supabase
          .from('waitlist_entries')
          .delete()
          .eq('venue_id', venue.id)
          .in('status', ['cancelled', 'no_show'])
          .lt('updated_at', twoHoursAgo.toISOString())
          .select('id');

        if (deleteError) {
          console.error(`Error deleting waitlist entries for ${venue.name}:`, deleteError);
          continue;
        }

        const deletedCount = deletedEntries?.length || 0;
        totalDeleted += deletedCount;
        
        console.log(`Deleted ${deletedCount} cancelled/no-show waitlist entries for ${venue.name}`);

        // Also delete their analytics records
        if (deletedCount > 0) {
          const entryIds = deletedEntries.map(e => e.id);
          const { error: analyticsError } = await supabase
            .from('waitlist_analytics')
            .delete()
            .in('entry_id', entryIds);

          if (analyticsError) {
            console.error(`Error deleting waitlist analytics for ${venue.name}:`, analyticsError);
          }
        }
      }
    }

    console.log(`Cleanup complete. Total deleted: ${totalDeleted} cancelled/no-show entries`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: totalDeleted,
        message: `Cleaned up ${totalDeleted} cancelled/no-show waitlist entries`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
