import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VenueHealthMetrics {
  venue_id: string;
  venue_name: string;
  total_orders: number;
  completed_orders: number;
  total_waitlist: number;
  seated_waitlist: number;
  avg_prep_time: number;
  quoted_prep_time: number;
  prep_accuracy_pct: number;
  avg_wait_time: number;
  quoted_wait_time: number;
  wait_accuracy_pct: number;
  avg_order_rating: number;
  avg_waitlist_rating: number;
  combined_rating: number;
  total_ratings: number;
  no_show_count: number;
  no_show_rate_pct: number;
  cancelled_orders: number;
  rejected_orders: number;
  health_score: number;
  last_activity: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { start_date, end_date } = await req.json();

    const now = new Date();
    const startDate = start_date ? new Date(start_date) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = end_date ? new Date(end_date) : now;

    console.log(`Fetching venue health report: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch all venues
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('id, name, created_at')
      .order('name');

    if (venuesError) throw venuesError;

    const venueHealthData: VenueHealthMetrics[] = [];

    for (const venue of venues || []) {
      // Fetch order analytics
      const { data: orderAnalytics } = await supabase
        .from('order_analytics')
        .select(`
          actual_prep_time,
          quoted_prep_time,
          orders!inner(status)
        `)
        .eq('venue_id', venue.id)
        .neq('orders.status', 'rejected')
        .gte('placed_at', startDate.toISOString())
        .lte('placed_at', endDate.toISOString());

      // Fetch waitlist analytics
      const { data: waitlistAnalytics } = await supabase
        .from('waitlist_analytics')
        .select('actual_wait_time, quoted_wait_time, was_no_show')
        .eq('venue_id', venue.id)
        .gte('joined_at', startDate.toISOString())
        .lte('joined_at', endDate.toISOString());

      // Fetch order ratings
      const { data: orderRatings } = await supabase
        .from('order_ratings')
        .select('rating')
        .eq('venue_id', venue.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Fetch waitlist ratings
      const { data: waitlistRatings } = await supabase
        .from('waitlist_ratings')
        .select('rating')
        .eq('venue_id', venue.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Fetch cancelled/rejected orders
      const { data: cancelledOrders } = await supabase
        .from('orders')
        .select('status')
        .eq('venue_id', venue.id)
        .in('status', ['cancelled', 'rejected'])
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Fetch last activity
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('created_at')
        .eq('venue_id', venue.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: lastWaitlist } = await supabase
        .from('waitlist_entries')
        .select('created_at')
        .eq('venue_id', venue.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Calculate metrics
      const completedOrders = orderAnalytics?.filter(o => o.actual_prep_time !== null) || [];
      const seatedWaitlist = waitlistAnalytics?.filter(w => w.actual_wait_time !== null) || [];

      const totalOrders = orderAnalytics?.length || 0;
      const totalWaitlist = waitlistAnalytics?.length || 0;

      // Prep time accuracy
      const avgPrepTime = completedOrders.length > 0
        ? completedOrders.reduce((sum, o) => sum + (o.actual_prep_time || 0), 0) / completedOrders.length
        : 0;
      const avgQuotedPrepTime = completedOrders.length > 0
        ? completedOrders.reduce((sum, o) => sum + (o.quoted_prep_time || 0), 0) / completedOrders.length
        : 0;
      const onTimePrepOrders = completedOrders.filter(o => 
        Math.abs((o.actual_prep_time || 0) - o.quoted_prep_time) <= 5
      ).length;
      const prepAccuracy = completedOrders.length > 0
        ? (onTimePrepOrders / completedOrders.length) * 100
        : 0;

      // Wait time accuracy
      const avgWaitTime = seatedWaitlist.length > 0
        ? seatedWaitlist.reduce((sum, w) => sum + (w.actual_wait_time || 0), 0) / seatedWaitlist.length
        : 0;
      const avgQuotedWaitTime = seatedWaitlist.length > 0
        ? seatedWaitlist.reduce((sum, w) => sum + (w.quoted_wait_time || 0), 0) / seatedWaitlist.length
        : 0;
      const onTimeWaitlist = seatedWaitlist.filter(w => 
        Math.abs((w.actual_wait_time || 0) - w.quoted_wait_time) <= 5
      ).length;
      const waitAccuracy = seatedWaitlist.length > 0
        ? (onTimeWaitlist / seatedWaitlist.length) * 100
        : 0;

      // Ratings
      const orderRatingValues = orderRatings?.map(r => r.rating) || [];
      const waitlistRatingValues = waitlistRatings?.map(r => r.rating) || [];
      const allRatings = [...orderRatingValues, ...waitlistRatingValues];

      const avgOrderRating = orderRatingValues.length > 0
        ? orderRatingValues.reduce((a, b) => a + b, 0) / orderRatingValues.length
        : 0;
      const avgWaitlistRating = waitlistRatingValues.length > 0
        ? waitlistRatingValues.reduce((a, b) => a + b, 0) / waitlistRatingValues.length
        : 0;
      const combinedRating = allRatings.length > 0
        ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length
        : 0;

      // No-shows
      const noShowCount = waitlistAnalytics?.filter(w => w.was_no_show).length || 0;
      const noShowRate = totalWaitlist > 0 ? (noShowCount / totalWaitlist) * 100 : 0;

      // Cancelled/Rejected
      const cancelled = cancelledOrders?.filter(o => o.status === 'cancelled').length || 0;
      const rejected = cancelledOrders?.filter(o => o.status === 'rejected').length || 0;

      // Last activity
      const lastOrderDate = lastOrder?.created_at ? new Date(lastOrder.created_at) : null;
      const lastWaitlistDate = lastWaitlist?.created_at ? new Date(lastWaitlist.created_at) : null;
      let lastActivity: Date | null = null;
      if (lastOrderDate && lastWaitlistDate) {
        lastActivity = lastOrderDate > lastWaitlistDate ? lastOrderDate : lastWaitlistDate;
      } else {
        lastActivity = lastOrderDate || lastWaitlistDate;
      }

      // Calculate health score (0-100)
      let healthScore = 0;
      let scoreFactors = 0;

      if (completedOrders.length > 0) {
        healthScore += prepAccuracy * 0.25;
        scoreFactors += 0.25;
      }
      if (seatedWaitlist.length > 0) {
        healthScore += waitAccuracy * 0.25;
        scoreFactors += 0.25;
      }
      if (allRatings.length > 0) {
        healthScore += (combinedRating / 5) * 100 * 0.3;
        scoreFactors += 0.3;
      }
      if (totalWaitlist > 0) {
        healthScore += Math.max(0, 100 - noShowRate * 2) * 0.2;
        scoreFactors += 0.2;
      }

      // Normalize if we have any data
      if (scoreFactors > 0) {
        healthScore = healthScore / scoreFactors;
      } else {
        healthScore = 0; // No data
      }

      venueHealthData.push({
        venue_id: venue.id,
        venue_name: venue.name,
        total_orders: totalOrders,
        completed_orders: completedOrders.length,
        total_waitlist: totalWaitlist,
        seated_waitlist: seatedWaitlist.length,
        avg_prep_time: parseFloat(avgPrepTime.toFixed(1)),
        quoted_prep_time: parseFloat(avgQuotedPrepTime.toFixed(1)),
        prep_accuracy_pct: parseFloat(prepAccuracy.toFixed(1)),
        avg_wait_time: parseFloat(avgWaitTime.toFixed(1)),
        quoted_wait_time: parseFloat(avgQuotedWaitTime.toFixed(1)),
        wait_accuracy_pct: parseFloat(waitAccuracy.toFixed(1)),
        avg_order_rating: parseFloat(avgOrderRating.toFixed(2)),
        avg_waitlist_rating: parseFloat(avgWaitlistRating.toFixed(2)),
        combined_rating: parseFloat(combinedRating.toFixed(2)),
        total_ratings: allRatings.length,
        no_show_count: noShowCount,
        no_show_rate_pct: parseFloat(noShowRate.toFixed(1)),
        cancelled_orders: cancelled,
        rejected_orders: rejected,
        health_score: parseFloat(healthScore.toFixed(1)),
        last_activity: lastActivity?.toISOString() || null,
      });
    }

    console.log(`Generated health report for ${venueHealthData.length} venues`);

    return new Response(
      JSON.stringify({ venues: venueHealthData }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-venue-health-report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
