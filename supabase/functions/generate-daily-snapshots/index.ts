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

    console.log('Starting daily snapshot generation...');

    // Get all venues
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('id');

    if (venuesError) {
      console.error('Error fetching venues:', venuesError);
      throw venuesError;
    }

    console.log(`Processing ${venues?.length || 0} venues`);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const snapshots = [];

    for (const venue of venues || []) {
      console.log(`Processing venue ${venue.id}...`);

      // Get orders for yesterday
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, status, user_id')
        .eq('venue_id', venue.id)
        .gte('created_at', startOfYesterday.toISOString())
        .lte('created_at', endOfYesterday.toISOString());

      if (ordersError) {
        console.error(`Error fetching orders for venue ${venue.id}:`, ordersError);
        continue;
      }

      const totalOrders = orders?.length || 0;
      const completedOrders = orders?.filter(o => o.status === 'collected').length || 0;
      const uniqueCustomers = new Set(orders?.map(o => o.user_id).filter(Boolean));

      // Get waitlist entries for yesterday
      const { data: waitlist, error: waitlistError } = await supabase
        .from('waitlist_entries')
        .select('id, user_id')
        .eq('venue_id', venue.id)
        .gte('created_at', startOfYesterday.toISOString())
        .lte('created_at', endOfYesterday.toISOString());

      if (waitlistError) {
        console.error(`Error fetching waitlist for venue ${venue.id}:`, waitlistError);
      }

      const totalWaitlistJoins = waitlist?.length || 0;
      waitlist?.forEach(w => {
        if (w.user_id) uniqueCustomers.add(w.user_id);
      });

      const totalCustomers = uniqueCustomers.size;

      // Get customer analytics to determine new vs returning
      const { data: customerAnalytics, error: analyticsError } = await supabase
        .from('customer_analytics')
        .select('user_id, first_order_date, first_waitlist_date')
        .eq('venue_id', venue.id)
        .in('user_id', Array.from(uniqueCustomers));

      if (analyticsError) {
        console.error(`Error fetching analytics for venue ${venue.id}:`, analyticsError);
      }

      let newCustomers = 0;
      customerAnalytics?.forEach(c => {
        const firstDate = c.first_order_date || c.first_waitlist_date;
        if (firstDate) {
          const firstDateObj = new Date(firstDate);
          if (firstDateObj >= startOfYesterday && firstDateObj <= endOfYesterday) {
            newCustomers++;
          }
        }
      });

      const returningCustomers = totalCustomers - newCustomers;

      // Get ratings for yesterday
      const { data: ratings, error: ratingsError } = await supabase
        .from('order_ratings')
        .select('rating')
        .eq('venue_id', venue.id)
        .gte('created_at', startOfYesterday.toISOString())
        .lte('created_at', endOfYesterday.toISOString());

      if (ratingsError) {
        console.error(`Error fetching ratings for venue ${venue.id}:`, ratingsError);
      }

      const avgRating = ratings && ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : null;

      // Get order analytics for yesterday
      const { data: orderAnalytics, error: orderAnalyticsError } = await supabase
        .from('order_analytics')
        .select('actual_prep_time, quoted_prep_time')
        .eq('venue_id', venue.id)
        .gte('placed_at', startOfYesterday.toISOString())
        .lte('placed_at', endOfYesterday.toISOString())
        .not('actual_prep_time', 'is', null);

      if (orderAnalyticsError) {
        console.error(`Error fetching order analytics for venue ${venue.id}:`, orderAnalyticsError);
      }

      const avgPrepTime = orderAnalytics && orderAnalytics.length > 0
        ? orderAnalytics.reduce((sum, o) => sum + (o.actual_prep_time || 0), 0) / orderAnalytics.length
        : null;

      const onTimeOrders = orderAnalytics?.filter(o => 
        o.actual_prep_time && o.quoted_prep_time && o.actual_prep_time <= o.quoted_prep_time
      ).length || 0;

      const onTimePercentage = orderAnalytics && orderAnalytics.length > 0
        ? (onTimeOrders / orderAnalytics.length) * 100
        : null;

      // Get waitlist analytics for yesterday
      const { data: waitlistAnalytics, error: waitlistAnalyticsError } = await supabase
        .from('waitlist_analytics')
        .select('actual_wait_time')
        .eq('venue_id', venue.id)
        .gte('joined_at', startOfYesterday.toISOString())
        .lte('joined_at', endOfYesterday.toISOString())
        .not('actual_wait_time', 'is', null);

      if (waitlistAnalyticsError) {
        console.error(`Error fetching waitlist analytics for venue ${venue.id}:`, waitlistAnalyticsError);
      }

      const avgWaitTime = waitlistAnalytics && waitlistAnalytics.length > 0
        ? waitlistAnalytics.reduce((sum, w) => sum + (w.actual_wait_time || 0), 0) / waitlistAnalytics.length
        : null;

      // Create snapshot
      snapshots.push({
        venue_id: venue.id,
        snapshot_date: yesterdayStr,
        total_orders: totalOrders,
        completed_orders: completedOrders,
        total_customers: totalCustomers,
        new_customers: newCustomers,
        returning_customers: returningCustomers,
        avg_rating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
        avg_prep_time_minutes: avgPrepTime ? parseFloat(avgPrepTime.toFixed(1)) : null,
        on_time_percentage: onTimePercentage ? parseFloat(onTimePercentage.toFixed(1)) : null,
        total_waitlist_joins: totalWaitlistJoins,
        avg_wait_time_minutes: avgWaitTime ? parseFloat(avgWaitTime.toFixed(1)) : null,
      });
    }

    // Insert snapshots
    if (snapshots.length > 0) {
      const { error: insertError } = await supabase
        .from('daily_venue_snapshots')
        .insert(snapshots);

      if (insertError) {
        console.error('Error inserting snapshots:', insertError);
        throw insertError;
      }

      console.log(`Successfully created ${snapshots.length} daily snapshots`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshots_created: snapshots.length,
        date: yesterdayStr,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in generate-daily-snapshots:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
