import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NudgeTemplate {
  title: string;
  body: string;
}

const NUDGE_TEMPLATES: Record<string, NudgeTemplate> = {
  mealtime_lunch: {
    title: "🍽️ Hungry yet?",
    body: "It's almost lunch time! Skip the wait - reserve now"
  },
  mealtime_dinner: {
    title: "🌙 Dinner plans?",
    body: "Beat the evening rush - book a table"
  },
  reengagement: {
    title: "We miss you!",
    body: "It's been a while. Check out what's new nearby"
  },
  favorite_venue_low_wait: {
    title: "⚡ Quick heads up!",
    body: "{venue_name} has only {wait_time} min wait right now"
  },
  weekend_planning: {
    title: "📅 Planning your weekend?",
    body: "Book your tables ahead and skip the wait"
  },
  after_visit: {
    title: "How was your meal?",
    body: "Rate your experience at {venue_name}"
  },
  first_time_welcome: {
    title: "👋 Welcome!",
    body: "Enable notifications to never miss when your food or table is ready"
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const currentHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    console.log(`Running engagement nudges at ${now.toISOString()}, hour: ${currentHour}, day: ${dayOfWeek}`);

    // Get all users with notification preferences who have FCM tokens
    const { data: eligibleUsers, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        fcm_token,
        patron_notification_preferences!inner(
          mealtime_nudges,
          reengagement_nudges,
          favorite_venue_alerts,
          weekend_planning_nudges,
          quiet_hours_start,
          quiet_hours_end,
          nudge_frequency,
          max_nudges_per_day
        )
      `)
      .not('fcm_token', 'is', null);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    console.log(`Found ${eligibleUsers?.length || 0} users with notification preferences`);

    const results: { userId: string; nudgeType: string; success: boolean }[] = [];

    for (const user of eligibleUsers || []) {
      try {
        const prefs = user.patron_notification_preferences as any;
        
        // Check quiet hours
        const quietStart = prefs.quiet_hours_start ? parseInt(prefs.quiet_hours_start.split(':')[0]) : 22;
        const quietEnd = prefs.quiet_hours_end ? parseInt(prefs.quiet_hours_end.split(':')[0]) : 8;
        
        const isQuietHours = (currentHour >= quietStart || currentHour < quietEnd);
        if (isQuietHours) {
          console.log(`Skipping user ${user.id} - quiet hours`);
          continue;
        }

        // Check daily nudge limit
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { count: todayNudges } = await supabase
          .from('patron_nudge_history')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('sent_at', today.toISOString());

        if ((todayNudges || 0) >= prefs.max_nudges_per_day) {
          console.log(`Skipping user ${user.id} - daily limit reached (${todayNudges}/${prefs.max_nudges_per_day})`);
          continue;
        }

        // Determine which nudge to send based on time and preferences
        let nudgeType: string | null = null;
        let nudgeTemplate: NudgeTemplate | null = null;
        let venueId: string | null = null;
        let customBody: string | null = null;

        // Mealtime nudges (11-12 for lunch, 17-18 for dinner)
        if (prefs.mealtime_nudges) {
          if (currentHour >= 11 && currentHour < 12) {
            // Check if we already sent a lunch nudge today
            const { count: lunchNudges } = await supabase
              .from('patron_nudge_history')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('nudge_type', 'mealtime_lunch')
              .gte('sent_at', today.toISOString());
            
            if (!lunchNudges || lunchNudges === 0) {
              nudgeType = 'mealtime_lunch';
              nudgeTemplate = NUDGE_TEMPLATES.mealtime_lunch;
            }
          } else if (currentHour >= 17 && currentHour < 18) {
            const { count: dinnerNudges } = await supabase
              .from('patron_nudge_history')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('nudge_type', 'mealtime_dinner')
              .gte('sent_at', today.toISOString());
            
            if (!dinnerNudges || dinnerNudges === 0) {
              nudgeType = 'mealtime_dinner';
              nudgeTemplate = NUDGE_TEMPLATES.mealtime_dinner;
            }
          }
        }

        // Weekend planning nudge (Friday afternoon)
        if (!nudgeType && prefs.weekend_planning_nudges && dayOfWeek === 5 && currentHour >= 14 && currentHour < 16) {
          const { count: weekendNudges } = await supabase
            .from('patron_nudge_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('nudge_type', 'weekend_planning')
            .gte('sent_at', today.toISOString());
          
          if (!weekendNudges || weekendNudges === 0) {
            nudgeType = 'weekend_planning';
            nudgeTemplate = NUDGE_TEMPLATES.weekend_planning;
          }
        }

        // Re-engagement nudge (check if inactive for 7+ days)
        if (!nudgeType && prefs.reengagement_nudges) {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          
          // Check last activity (order or waitlist)
          const { data: lastOrder } = await supabase
            .from('orders')
            .select('created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const { data: lastWaitlist } = await supabase
            .from('waitlist_entries')
            .select('created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          const lastActivity = [lastOrder?.created_at, lastWaitlist?.created_at]
            .filter(Boolean)
            .sort()
            .reverse()[0];

          if (!lastActivity || new Date(lastActivity) < sevenDaysAgo) {
            // Check if we sent a reengagement nudge in the last 7 days
            const { count: recentReengagement } = await supabase
              .from('patron_nudge_history')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('nudge_type', 'reengagement')
              .gte('sent_at', sevenDaysAgo.toISOString());

            if (!recentReengagement || recentReengagement === 0) {
              nudgeType = 'reengagement';
              nudgeTemplate = NUDGE_TEMPLATES.reengagement;
            }
          }
        }

        // Favorite venue low wait alert
        if (!nudgeType && prefs.favorite_venue_alerts) {
          // Find user's most visited venue
          const { data: topVenue } = await supabase
            .from('customer_analytics')
            .select('venue_id, total_orders, total_waitlist_joins, venues(name)')
            .eq('user_id', user.id)
            .order('total_orders', { ascending: false })
            .limit(1)
            .single();

          if (topVenue?.venue_id) {
            // Check current wait time at favorite venue
            const { data: currentWaitlist } = await supabase
              .from('waitlist_entries')
              .select('id')
              .eq('venue_id', topVenue.venue_id)
              .eq('status', 'waiting');

            const waitlistLength = currentWaitlist?.length || 0;
            const estimatedWait = waitlistLength * 5; // Rough estimate: 5 min per party

            // Alert if wait is 10 min or less and we haven't alerted recently
            if (estimatedWait <= 10) {
              const oneHourAgo = new Date();
              oneHourAgo.setHours(oneHourAgo.getHours() - 1);

              const { count: recentAlert } = await supabase
                .from('patron_nudge_history')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('venue_id', topVenue.venue_id)
                .eq('nudge_type', 'favorite_venue_low_wait')
                .gte('sent_at', oneHourAgo.toISOString());

              if (!recentAlert || recentAlert === 0) {
                nudgeType = 'favorite_venue_low_wait';
                nudgeTemplate = NUDGE_TEMPLATES.favorite_venue_low_wait;
                venueId = topVenue.venue_id;
                const venueName = (topVenue.venues as any)?.name || 'Your favorite spot';
                customBody = NUDGE_TEMPLATES.favorite_venue_low_wait.body
                  .replace('{venue_name}', venueName)
                  .replace('{wait_time}', estimatedWait.toString());
              }
            }
          }
        }

        // Send the nudge if we have one
        if (nudgeType && nudgeTemplate) {
          const title = nudgeTemplate.title;
          const body = customBody || nudgeTemplate.body;

          console.log(`Sending ${nudgeType} nudge to user ${user.id}: "${title}"`);

          // Record the nudge in history
          await supabase
            .from('patron_nudge_history')
            .insert({
              user_id: user.id,
              nudge_type: nudgeType,
              title,
              body,
              venue_id: venueId,
            });

          // Send push notification via existing function
          try {
            const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                fcmToken: user.fcm_token,
                title,
                body,
                data: {
                  type: 'engagement_nudge',
                  nudge_type: nudgeType,
                  venue_id: venueId,
                }
              }),
            });

            if (!response.ok) {
              console.error(`Failed to send push notification: ${response.status}`);
            }
          } catch (pushError) {
            console.error('Error sending push notification:', pushError);
          }

          results.push({ userId: user.id, nudgeType, success: true });
        }
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError);
        results.push({ userId: user.id, nudgeType: 'error', success: false });
      }
    }

    console.log(`Engagement nudge run complete. Sent ${results.filter(r => r.success).length} nudges.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: eligibleUsers?.length || 0,
        nudgesSent: results.filter(r => r.success).length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in engagement nudge function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
