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

    const { venue_id, time_range = '30days' } = await req.json();

    if (!venue_id) {
      return new Response(
        JSON.stringify({ error: 'venue_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching efficiency analytics for venue ${venue_id}, range: ${time_range}`);

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
      case '90days':
        startDate.setDate(now.getDate() - 90);
        break;
    }

    // Fetch order analytics (exclude rejected orders)
    const { data: orderAnalytics, error: orderError } = await supabase
      .from('order_analytics')
      .select(`
        *,
        orders!inner(status)
      `)
      .eq('venue_id', venue_id)
      .neq('orders.status', 'rejected')
      .gte('placed_at', startDate.toISOString());

    if (orderError) {
      console.error('Error fetching order analytics:', orderError);
      throw orderError;
    }

    // Fetch waitlist analytics
    const { data: waitlistAnalytics, error: waitlistError } = await supabase
      .from('waitlist_analytics')
      .select('*')
      .eq('venue_id', venue_id)
      .gte('joined_at', startDate.toISOString());

    if (waitlistError) {
      console.error('Error fetching waitlist analytics:', waitlistError);
      throw waitlistError;
    }

    // Calculate average prep time
    const completedOrders = orderAnalytics?.filter(o => o.actual_prep_time) || [];
    const avgPrepTime = completedOrders.length > 0
      ? completedOrders.reduce((sum, o) => sum + o.actual_prep_time, 0) / completedOrders.length
      : 0;

    // Calculate on-time performance
    const ordersWithETA = orderAnalytics?.filter(o => o.actual_prep_time && o.quoted_prep_time) || [];
    const onTimeOrders = ordersWithETA.filter(o => o.actual_prep_time <= o.quoted_prep_time).length;
    const onTimeRate = ordersWithETA.length > 0 ? (onTimeOrders / ordersWithETA.length) * 100 : 0;

    // Peak hours analysis (order volume by hour)
    const hourlyOrderVolume: Record<number, number> = {};
    orderAnalytics?.forEach(o => {
      const hour = o.hour_of_day;
      hourlyOrderVolume[hour] = (hourlyOrderVolume[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourlyOrderVolume)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // On-time performance by hour
    const onTimeByHour: Record<number, { total: number; on_time: number }> = {};
    ordersWithETA.forEach(o => {
      const hour = o.hour_of_day;
      if (!onTimeByHour[hour]) {
        onTimeByHour[hour] = { total: 0, on_time: 0 };
      }
      onTimeByHour[hour].total++;
      if (o.actual_prep_time <= o.quoted_prep_time) {
        onTimeByHour[hour].on_time++;
      }
    });

    const onTimePerformanceByHour = Object.entries(onTimeByHour)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        on_time_rate: (data.on_time / data.total) * 100,
        total_orders: data.total,
      }))
      .sort((a, b) => a.hour - b.hour);

    // Prep time trend (daily average)
    const dailyPrepTime: Record<string, { total: number; count: number }> = {};
    completedOrders.forEach(o => {
      const dateKey = new Date(o.placed_at).toISOString().split('T')[0];
      if (!dailyPrepTime[dateKey]) {
        dailyPrepTime[dateKey] = { total: 0, count: 0 };
      }
      dailyPrepTime[dateKey].total += o.actual_prep_time;
      dailyPrepTime[dateKey].count++;
    });

    const prepTimeTrend = Object.entries(dailyPrepTime)
      .map(([date, data]) => ({
        date,
        avg_prep_time: data.total / data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Average wait time for waitlist
    const completedWaitlist = waitlistAnalytics?.filter(w => w.actual_wait_time) || [];
    const avgWaitTime = completedWaitlist.length > 0
      ? completedWaitlist.reduce((sum, w) => sum + w.actual_wait_time, 0) / completedWaitlist.length
      : 0;

    // Table turnover (time from ready to seated)
    const { data: waitlistEntries, error: entriesError } = await supabase
      .from('waitlist_entries')
      .select('status, created_at, updated_at')
      .eq('venue_id', venue_id)
      .eq('status', 'seated')
      .gte('created_at', startDate.toISOString());

    if (entriesError) {
      console.error('Error fetching waitlist entries:', entriesError);
    }

    // Staff performance (if staff attribution exists)
    const { data: ordersWithStaff, error: staffError } = await supabase
      .from('orders')
      .select('marked_ready_by_staff_id')
      .eq('venue_id', venue_id)
      .not('marked_ready_by_staff_id', 'is', null)
      .gte('created_at', startDate.toISOString());

    const staffPerformance: Record<string, number> = {};
    ordersWithStaff?.forEach(o => {
      if (o.marked_ready_by_staff_id) {
        staffPerformance[o.marked_ready_by_staff_id] = (staffPerformance[o.marked_ready_by_staff_id] || 0) + 1;
      }
    });

    const topStaff = Object.entries(staffPerformance)
      .map(([staff_id, count]) => ({ staff_id, orders_completed: count }))
      .sort((a, b) => b.orders_completed - a.orders_completed)
      .slice(0, 5);

    // Get staff names
    const staffIds = topStaff.map(s => s.staff_id);
    const { data: staffProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', staffIds);

    const staffMap = new Map(staffProfiles?.map(p => [p.id, p.full_name]) || []);

    const staffLeaderboard = topStaff.map(s => ({
      ...s,
      name: staffMap.get(s.staff_id) || 'Unknown',
    }));

    // Busiest days of week
    const dayVolume: Record<number, number> = {};
    orderAnalytics?.forEach(o => {
      const day = o.day_of_week;
      dayVolume[day] = (dayVolume[day] || 0) + 1;
    });

    const busiestDays = Object.entries(dayVolume)
      .map(([day, count]) => ({
        day: parseInt(day),
        day_name: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseInt(day)],
        count,
      }))
      .sort((a, b) => b.count - a.count);

    console.log('Successfully calculated efficiency analytics');

    return new Response(
      JSON.stringify({
        summary: {
          avg_prep_time: parseFloat(avgPrepTime.toFixed(2)),
          on_time_rate: parseFloat(onTimeRate.toFixed(2)),
          avg_wait_time: parseFloat(avgWaitTime.toFixed(2)),
          total_orders: orderAnalytics?.length || 0,
          total_waitlist: waitlistAnalytics?.length || 0,
        },
        peak_hours: peakHours,
        busiest_days: busiestDays,
        on_time_by_hour: onTimePerformanceByHour,
        prep_time_trend: prepTimeTrend,
        staff_leaderboard: staffLeaderboard,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-venue-efficiency-analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});