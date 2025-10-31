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

    const { venue_id, time_range = 'today' } = await req.json();

    if (!venue_id) {
      throw new Error('venue_id is required');
    }

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (time_range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case '7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(now.getDate() - 30);
        break;
    }

    // Get order analytics
    const { data: orderAnalytics, error: orderError } = await supabase
      .from('order_analytics')
      .select('*')
      .eq('venue_id', venue_id)
      .gte('placed_at', startDate.toISOString())
      .order('placed_at', { ascending: false });

    if (orderError) throw orderError;

    // Get waitlist analytics
    const { data: waitlistAnalytics, error: waitlistError } = await supabase
      .from('waitlist_analytics')
      .select('*')
      .eq('venue_id', venue_id)
      .gte('joined_at', startDate.toISOString())
      .order('joined_at', { ascending: false });

    if (waitlistError) throw waitlistError;

    // Calculate order metrics
    const completedOrders = orderAnalytics?.filter(o => o.actual_prep_time !== null) || [];
    const totalOrders = orderAnalytics?.length || 0;
    
    const avgPrepTime = completedOrders.length > 0
      ? Math.round(completedOrders.reduce((sum, o) => sum + (o.actual_prep_time || 0), 0) / completedOrders.length)
      : 0;

    const prepTimeAccuracy = completedOrders.length > 0
      ? Math.round((completedOrders.filter(o => 
          Math.abs((o.actual_prep_time || 0) - o.quoted_prep_time) <= 5
        ).length / completedOrders.length) * 100)
      : 0;

    // Group by hour for hourly data
    const hourlyOrders = Array(24).fill(0);
    orderAnalytics?.forEach(o => {
      hourlyOrders[o.hour_of_day] = (hourlyOrders[o.hour_of_day] || 0) + 1;
    });

    // Calculate waitlist metrics
    const completedWaitlist = waitlistAnalytics?.filter(w => w.actual_wait_time !== null) || [];
    const totalWaitlist = waitlistAnalytics?.length || 0;
    
    const avgWaitTime = completedWaitlist.length > 0
      ? Math.round(completedWaitlist.reduce((sum, w) => sum + (w.actual_wait_time || 0), 0) / completedWaitlist.length)
      : 0;

    const waitTimeAccuracy = completedWaitlist.length > 0
      ? Math.round((completedWaitlist.filter(w => 
          Math.abs((w.actual_wait_time || 0) - w.quoted_wait_time) <= 5
        ).length / completedWaitlist.length) * 100)
      : 0;

    const noShowRate = totalWaitlist > 0
      ? Math.round((waitlistAnalytics?.filter(w => w.was_no_show).length || 0) / totalWaitlist * 100)
      : 0;

    // Group by hour for waitlist
    const hourlyWaitlist = Array(24).fill(0);
    waitlistAnalytics?.forEach(w => {
      hourlyWaitlist[w.hour_of_day] = (hourlyWaitlist[w.hour_of_day] || 0) + 1;
    });

    // Find peak hours
    const peakOrderHour = hourlyOrders.indexOf(Math.max(...hourlyOrders));
    const peakWaitlistHour = hourlyWaitlist.indexOf(Math.max(...hourlyWaitlist));

    // Generate insights
    const insights = [];
    
    if (prepTimeAccuracy < 70) {
      insights.push({
        type: 'warning',
        category: 'orders',
        message: `Order prep time accuracy is ${prepTimeAccuracy}%. Consider reviewing kitchen capacity settings.`,
        action: 'Review kitchen settings'
      });
    }

    if (waitTimeAccuracy < 70) {
      insights.push({
        type: 'warning',
        category: 'waitlist',
        message: `Waitlist time accuracy is ${waitTimeAccuracy}%. Review seating capacity and turnover estimates.`,
        action: 'Adjust capacity settings'
      });
    }

    if (noShowRate > 20) {
      insights.push({
        type: 'warning',
        category: 'waitlist',
        message: `No-show rate is ${noShowRate}%. Consider implementing confirmation reminders.`,
        action: 'Enable notifications'
      });
    }

    if (completedOrders.length < 30) {
      insights.push({
        type: 'info',
        category: 'system',
        message: `Collecting data... ${completedOrders.length} orders tracked. Need 30+ for high confidence predictions.`,
        action: 'Keep using system'
      });
    }

    console.log('Analytics generated for venue:', venue_id, {
      time_range,
      total_orders: totalOrders,
      total_waitlist: totalWaitlist,
      prep_accuracy: prepTimeAccuracy,
      wait_accuracy: waitTimeAccuracy
    });

    return new Response(
      JSON.stringify({
        time_range,
        order_metrics: {
          total: totalOrders,
          completed: completedOrders.length,
          avg_prep_time: avgPrepTime,
          accuracy: prepTimeAccuracy,
          hourly_distribution: hourlyOrders,
          peak_hour: peakOrderHour
        },
        waitlist_metrics: {
          total: totalWaitlist,
          completed: completedWaitlist.length,
          avg_wait_time: avgWaitTime,
          accuracy: waitTimeAccuracy,
          no_show_rate: noShowRate,
          hourly_distribution: hourlyWaitlist,
          peak_hour: peakWaitlistHour
        },
        insights,
        data_quality: {
          has_enough_order_data: completedOrders.length >= 30,
          has_enough_waitlist_data: completedWaitlist.length >= 30,
          order_data_points: completedOrders.length,
          waitlist_data_points: completedWaitlist.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-venue-analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});