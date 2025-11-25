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

    // Get order analytics (exclude rejected orders)
    const { data: orderAnalytics, error: orderError } = await supabase
      .from('order_analytics')
      .select(`
        *,
        orders!inner(status)
      `)
      .eq('venue_id', venue_id)
      .neq('orders.status', 'rejected')
      .gte('placed_at', startDate.toISOString())
      .order('placed_at', { ascending: false });

    // Get count of rejected orders in time range
    const { count: rejectedCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('venue_id', venue_id)
      .eq('status', 'rejected')
      .gte('created_at', startDate.toISOString());

    // Get cancelled orders with details (for reporting)
    const { data: cancelledOrders } = await supabase
      .from('orders')
      .select('id, order_number, cancellation_type, notes, created_at, cancelled_by')
      .eq('venue_id', venue_id)
      .eq('status', 'cancelled')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

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
    const completedOrders = orderAnalytics?.filter(o => o.actual_prep_time !== null && o.orders.status !== 'cancelled') || [];
    const totalOrders = orderAnalytics?.length || 0;
    
    // Extract cancellation reasons
    const cancelledOrderDetails = (cancelledOrders || []).map(order => {
      // Extract reason from notes (format: "Cancelled: [reason]")
      const reasonMatch = order.notes?.match(/^Cancelled:\s*(.+)$/i);
      const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';
      
      return {
        order_number: order.order_number,
        cancellation_type: order.cancellation_type || 'unknown',
        reason: reason,
        cancelled_at: order.created_at,
        cancelled_by: order.cancelled_by || 'unknown'
      };
    });
    
    const avgPrepTime = completedOrders.length > 0
      ? Math.round(completedOrders.reduce((sum, o) => sum + (o.actual_prep_time || 0), 0) / completedOrders.length)
      : 0;

    // Calculate performance brackets
    const earlyOrders = completedOrders.filter(o => 
      (o.actual_prep_time || 0) < o.quoted_prep_time - 5
    );
    const onTimeOrders = completedOrders.filter(o => 
      Math.abs((o.actual_prep_time || 0) - o.quoted_prep_time) <= 5
    );
    const lateOrders = completedOrders.filter(o => 
      (o.actual_prep_time || 0) > o.quoted_prep_time + 5
    );

    const earlyRate = completedOrders.length > 0
      ? Math.round((earlyOrders.length / completedOrders.length) * 100)
      : 0;
    const onTimeRate = completedOrders.length > 0
      ? Math.round((onTimeOrders.length / completedOrders.length) * 100)
      : 0;
    const lateRate = completedOrders.length > 0
      ? Math.round((lateOrders.length / completedOrders.length) * 100)
      : 0;

    // Calculate average delay/advance for insights
    const avgDelay = lateOrders.length > 0
      ? Math.round(lateOrders.reduce((sum, o) => 
          sum + ((o.actual_prep_time || 0) - o.quoted_prep_time), 0
        ) / lateOrders.length)
      : 0;

    const avgAdvance = earlyOrders.length > 0
      ? Math.round(earlyOrders.reduce((sum, o) => 
          sum + (o.quoted_prep_time - (o.actual_prep_time || 0)), 0
        ) / earlyOrders.length)
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

    // Calculate waitlist performance brackets
    const earlyWaitlist = completedWaitlist.filter(w => 
      (w.actual_wait_time || 0) < w.quoted_wait_time - 5
    );
    const onTimeWaitlist = completedWaitlist.filter(w => 
      Math.abs((w.actual_wait_time || 0) - w.quoted_wait_time) <= 5
    );
    const lateWaitlist = completedWaitlist.filter(w => 
      (w.actual_wait_time || 0) > w.quoted_wait_time + 5
    );

    const waitEarlyRate = completedWaitlist.length > 0
      ? Math.round((earlyWaitlist.length / completedWaitlist.length) * 100)
      : 0;
    const waitOnTimeRate = completedWaitlist.length > 0
      ? Math.round((onTimeWaitlist.length / completedWaitlist.length) * 100)
      : 0;
    const waitLateRate = completedWaitlist.length > 0
      ? Math.round((lateWaitlist.length / completedWaitlist.length) * 100)
      : 0;

    const waitAvgDelay = lateWaitlist.length > 0
      ? Math.round(lateWaitlist.reduce((sum, w) => 
          sum + ((w.actual_wait_time || 0) - w.quoted_wait_time), 0
        ) / lateWaitlist.length)
      : 0;

    const waitAvgAdvance = earlyWaitlist.length > 0
      ? Math.round(earlyWaitlist.reduce((sum, w) => 
          sum + (w.quoted_wait_time - (w.actual_wait_time || 0)), 0
        ) / earlyWaitlist.length)
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
    
    // Order insights
    if (lateRate > 30) {
      insights.push({
        type: 'warning',
        category: 'Orders',
        message: `${lateRate}% of orders are running late by ~${avgDelay} minutes. Consider increasing your default prep time in settings.`,
        action: 'Increase prep time estimate'
      });
    }

    if (earlyRate > 50) {
      insights.push({
        type: 'info',
        category: 'Orders',
        message: `${earlyRate}% of orders are ready early by ~${avgAdvance} minutes. You may be overestimating prep time.`,
        action: 'Reduce prep time estimate'
      });
    }

    if (onTimeRate > 70 && completedOrders.length >= 30) {
      insights.push({
        type: 'success',
        category: 'Orders',
        message: `Excellent! ${onTimeRate}% of orders are delivered on time. Keep it up!`,
        action: null
      });
    }

    // Waitlist insights
    if (waitLateRate > 30) {
      insights.push({
        type: 'warning',
        category: 'Waitlist',
        message: `${waitLateRate}% of tables are running late by ~${waitAvgDelay} minutes. Review seating capacity settings.`,
        action: 'Adjust capacity settings'
      });
    }

    if (waitEarlyRate > 50) {
      insights.push({
        type: 'info',
        category: 'Waitlist',
        message: `${waitEarlyRate}% of tables are ready early by ~${waitAvgAdvance} minutes. You may be overestimating wait time.`,
        action: 'Reduce wait time estimate'
      });
    }

    if (waitOnTimeRate > 70 && completedWaitlist.length >= 30) {
      insights.push({
        type: 'success',
        category: 'Waitlist',
        message: `Excellent! ${waitOnTimeRate}% of tables are ready on time. Keep it up!`,
        action: null
      });
    }

    if (noShowRate > 20) {
      insights.push({
        type: 'warning',
        category: 'Waitlist',
        message: `No-show rate is ${noShowRate}%. Consider implementing confirmation reminders.`,
        action: 'Enable notifications'
      });
    }

    if (completedOrders.length < 30) {
      insights.push({
        type: 'info',
        category: 'System',
        message: `Collecting data... ${completedOrders.length} orders tracked. Need 30+ for high confidence predictions.`,
        action: 'Keep using system'
      });
    }

    console.log('Analytics generated for venue:', venue_id, {
      time_range,
      total_orders: totalOrders,
      total_waitlist: totalWaitlist,
      order_on_time_rate: onTimeRate,
      order_late_rate: lateRate,
      waitlist_on_time_rate: waitOnTimeRate,
      waitlist_late_rate: waitLateRate
    });

    return new Response(
      JSON.stringify({
        time_range,
        order_metrics: {
          total: totalOrders,
          completed: completedOrders.length,
          avg_prep_time: avgPrepTime,
          rejected_count: rejectedCount || 0,
          cancelled_count: cancelledOrders?.length || 0,
          cancelled_orders: cancelledOrderDetails,
          performance: {
            early_rate: earlyRate,
            early_count: earlyOrders.length,
            avg_advance: avgAdvance,
            on_time_rate: onTimeRate,
            on_time_count: onTimeOrders.length,
            late_rate: lateRate,
            late_count: lateOrders.length,
            avg_delay: avgDelay
          },
          hourly_distribution: hourlyOrders,
          peak_hour: peakOrderHour
        },
        waitlist_metrics: {
          total: totalWaitlist,
          completed: completedWaitlist.length,
          avg_wait_time: avgWaitTime,
          performance: {
            early_rate: waitEarlyRate,
            early_count: earlyWaitlist.length,
            avg_advance: waitAvgAdvance,
            on_time_rate: waitOnTimeRate,
            on_time_count: onTimeWaitlist.length,
            late_rate: waitLateRate,
            late_count: lateWaitlist.length,
            avg_delay: waitAvgDelay
          },
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