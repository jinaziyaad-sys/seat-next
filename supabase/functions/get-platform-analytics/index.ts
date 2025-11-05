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

    // Verify super admin role
    const authHeader = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user is super admin
    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });
    if (!isSuperAdmin) {
      throw new Error('Insufficient permissions');
    }

    // Get summary statistics
    const { data: venues } = await supabase.from('venues').select('id', { count: 'exact' });
    const totalVenues = venues?.length || 0;

    const { data: profiles } = await supabase.from('profiles').select('id', { count: 'exact' });
    const totalPatrons = profiles?.length || 0;

    // Get active users (activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activeOrders } = await supabase
      .from('orders')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('user_id', 'is', null);

    const { data: activeWaitlist } = await supabase
      .from('waitlist_entries')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('user_id', 'is', null);

    const activeUserIds = new Set([
      ...(activeOrders?.map(o => o.user_id) || []),
      ...(activeWaitlist?.map(w => w.user_id) || [])
    ]);
    const activeUsers30d = activeUserIds.size;

    // Get new signups
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: newSignups7d } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { data: newSignups30d } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .gte('created_at', thirtyDaysAgo.toISOString());

    // Get platform average rating
    const { data: ratings } = await supabase.from('order_ratings').select('rating');
    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    // Get order statistics
    const { data: allOrders } = await supabase.from('orders').select('status, created_at');
    const totalOrders = allOrders?.length || 0;

    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    const ordersThisMonth = allOrders?.filter(o => new Date(o.created_at) >= firstDayOfMonth).length || 0;

    const ordersByStatus = allOrders?.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const orderStatusBreakdown = Object.entries(ordersByStatus).map(([status, count]) => ({
      status,
      count
    }));

    // Get prep time accuracy
    const { data: orderAnalytics } = await supabase
      .from('order_analytics')
      .select('quoted_prep_time, actual_prep_time')
      .not('actual_prep_time', 'is', null)
      .gte('placed_at', thirtyDaysAgo.toISOString());

    const accurateOrders = orderAnalytics?.filter(o => 
      Math.abs((o.actual_prep_time || 0) - o.quoted_prep_time) <= 5
    ).length || 0;
    const avgPrepAccuracy = orderAnalytics && orderAnalytics.length > 0
      ? Math.round((accurateOrders / orderAnalytics.length) * 100)
      : 0;

    // Get waitlist statistics
    const { data: allWaitlist } = await supabase.from('waitlist_entries').select('id', { count: 'exact' });
    const totalWaitlistEntries = allWaitlist?.length || 0;

    // Get wait time accuracy
    const { data: waitlistAnalytics } = await supabase
      .from('waitlist_analytics')
      .select('quoted_wait_time, actual_wait_time, was_no_show')
      .not('actual_wait_time', 'is', null)
      .gte('joined_at', thirtyDaysAgo.toISOString());

    const accurateWaitlist = waitlistAnalytics?.filter(w => 
      Math.abs((w.actual_wait_time || 0) - w.quoted_wait_time) <= 5
    ).length || 0;
    const avgWaitAccuracy = waitlistAnalytics && waitlistAnalytics.length > 0
      ? Math.round((accurateWaitlist / waitlistAnalytics.length) * 100)
      : 0;

    const noShows = waitlistAnalytics?.filter(w => w.was_no_show).length || 0;
    const noShowRate = waitlistAnalytics && waitlistAnalytics.length > 0
      ? Math.round((noShows / waitlistAnalytics.length) * 100)
      : 0;

    // Get top venues by orders
    const { data: venueOrders } = await supabase
      .from('orders')
      .select('venue_id, venues(name)')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const venueOrderCounts = venueOrders?.reduce((acc, order) => {
      const venueId = order.venue_id;
      if (!acc[venueId]) {
        acc[venueId] = { venue_id: venueId, name: (order.venues as any)?.name || 'Unknown', count: 0 };
      }
      acc[venueId].count++;
      return acc;
    }, {} as Record<string, { venue_id: string, name: string, count: number }>) || {};

    const topVenuesByOrders = Object.values(venueOrderCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get top venues by rating
    const { data: venueRatings } = await supabase
      .from('order_ratings')
      .select('venue_id, rating, venues(name)');

    const venueRatingData = venueRatings?.reduce((acc, rating) => {
      const venueId = rating.venue_id;
      if (!acc[venueId]) {
        acc[venueId] = {
          venue_id: venueId,
          name: (rating.venues as any)?.name || 'Unknown',
          total: 0,
          count: 0
        };
      }
      acc[venueId].total += rating.rating;
      acc[venueId].count++;
      return acc;
    }, {} as Record<string, { venue_id: string, name: string, total: number, count: number }>) || {};

    const topVenuesByRating = Object.values(venueRatingData)
      .map(v => ({
        venue_id: v.venue_id,
        name: v.name,
        avg_rating: Math.round((v.total / v.count) * 10) / 10,
        rating_count: v.count
      }))
      .filter(v => v.rating_count >= 5) // Only include venues with at least 5 ratings
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 5);

    // Get most active venues (recent activity)
    const { data: recentActivity } = await supabase
      .from('orders')
      .select('venue_id, venues(name)')
      .gte('created_at', sevenDaysAgo.toISOString());

    const venueActivityCounts = recentActivity?.reduce((acc, order) => {
      const venueId = order.venue_id;
      if (!acc[venueId]) {
        acc[venueId] = { venue_id: venueId, name: (order.venues as any)?.name || 'Unknown', count: 0 };
      }
      acc[venueId].count++;
      return acc;
    }, {} as Record<string, { venue_id: string, name: string, count: number }>) || {};

    const mostActiveVenues = Object.values(venueActivityCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Get daily signup trends (last 30 days)
    const dailySignups: { date: string, count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { data: signups } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      dailySignups.push({
        date: date.toISOString().split('T')[0],
        count: signups?.length || 0
      });
    }

    // Get daily order trends (last 30 days)
    const dailyOrders: { date: string, count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { data: orders } = await supabase
        .from('orders')
        .select('id', { count: 'exact' })
        .gte('created_at', date.toISOString())
        .lt('created_at', nextDate.toISOString());

      dailyOrders.push({
        date: date.toISOString().split('T')[0],
        count: orders?.length || 0
      });
    }

    // Calculate active venue percentage
    const activeVenueCount = Object.keys(venueActivityCounts).length;
    const activeVenuePct = totalVenues > 0 ? Math.round((activeVenueCount / totalVenues) * 100) : 0;

    console.log('Platform analytics generated:', {
      total_venues: totalVenues,
      total_patrons: totalPatrons,
      active_users_30d: activeUsers30d,
      platform_avg_rating: avgRating
    });

    return new Response(
      JSON.stringify({
        summary: {
          total_venues: totalVenues,
          total_patrons: totalPatrons,
          active_users_30d: activeUsers30d,
          new_signups_7d: newSignups7d?.length || 0,
          new_signups_30d: newSignups30d?.length || 0,
          platform_avg_rating: Math.round(avgRating * 10) / 10
        },
        orders: {
          total_orders: totalOrders,
          orders_by_status: orderStatusBreakdown,
          avg_prep_accuracy_pct: avgPrepAccuracy,
          total_this_month: ordersThisMonth
        },
        waitlist: {
          total_entries: totalWaitlistEntries,
          avg_wait_accuracy_pct: avgWaitAccuracy,
          no_show_rate_pct: noShowRate
        },
        top_venues: {
          by_orders: topVenuesByOrders,
          by_rating: topVenuesByRating,
          most_active: mostActiveVenues
        },
        growth: {
          daily_signups: dailySignups,
          daily_orders: dailyOrders
        },
        health: {
          active_venue_pct: activeVenuePct,
          active_venue_count: activeVenueCount
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-platform-analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});