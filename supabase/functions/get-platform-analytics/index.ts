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

    // Parse date range from request body
    const body = await req.json().catch(() => ({}));
    const now = new Date();
    
    let startDate: Date;
    let endDate: Date;

    if (body.start_date && body.end_date) {
      startDate = new Date(body.start_date);
      endDate = new Date(body.end_date);
    } else {
      // Default to last 30 days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      endDate = now;
    }

    console.log(`Fetching platform analytics from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get summary statistics
    const { data: venues } = await supabase.from('venues').select('id, name, created_at');
    const totalVenues = venues?.length || 0;

    const { data: profiles } = await supabase.from('profiles').select('id, created_at');
    const totalPatrons = profiles?.length || 0;

    // Get active users in period
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('user_id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('user_id', 'is', null);

    const { data: activeWaitlist } = await supabase
      .from('waitlist_entries')
      .select('user_id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .not('user_id', 'is', null);

    const activeUserIds = new Set([
      ...(activeOrders?.map(o => o.user_id) || []),
      ...(activeWaitlist?.map(w => w.user_id) || [])
    ]);
    const activeUsers30d = activeUserIds.size;

    // Get new signups in period
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: newSignups7d } = await supabase
      .from('profiles')
      .select('id')
      .gte('created_at', sevenDaysAgo.toISOString());

    const { data: newSignupsInPeriod } = await supabase
      .from('profiles')
      .select('id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Get platform average rating in period
    const { data: ratings } = await supabase
      .from('order_ratings')
      .select('rating')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    const avgRating = ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

    // Get order statistics in period
    const { data: periodOrders } = await supabase
      .from('orders')
      .select('status, created_at, user_id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const totalOrders = periodOrders?.length || 0;

    const ordersByStatus = periodOrders?.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const orderStatusBreakdown = Object.entries(ordersByStatus).map(([status, count]) => ({
      status,
      count
    }));

    const completedCount = ordersByStatus['collected'] || 0;
    const cancelledCount = ordersByStatus['cancelled'] || 0;
    const rejectedCount = ordersByStatus['rejected'] || 0;
    const orderConversionRate = totalOrders > 0 ? Math.round((completedCount / totalOrders) * 100) : 0;

    // Get prep time accuracy
    const { data: orderAnalytics } = await supabase
      .from('order_analytics')
      .select('quoted_prep_time, actual_prep_time')
      .not('actual_prep_time', 'is', null)
      .gte('placed_at', startDate.toISOString())
      .lte('placed_at', endDate.toISOString());

    const accurateOrders = orderAnalytics?.filter(o => 
      Math.abs((o.actual_prep_time || 0) - o.quoted_prep_time) <= 5
    ).length || 0;
    const avgPrepAccuracy = orderAnalytics && orderAnalytics.length > 0
      ? Math.round((accurateOrders / orderAnalytics.length) * 100)
      : 0;

    // Get waitlist statistics in period
    const { data: periodWaitlist } = await supabase
      .from('waitlist_entries')
      .select('status, created_at, user_id')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const totalWaitlistEntries = periodWaitlist?.length || 0;
    const seatedCount = periodWaitlist?.filter(w => w.status === 'seated').length || 0;
    const waitlistCancelledCount = periodWaitlist?.filter(w => w.status === 'cancelled').length || 0;
    const waitlistConversionRate = totalWaitlistEntries > 0 
      ? Math.round((seatedCount / totalWaitlistEntries) * 100) 
      : 0;

    // Get wait time accuracy
    const { data: waitlistAnalytics } = await supabase
      .from('waitlist_analytics')
      .select('quoted_wait_time, actual_wait_time, was_no_show')
      .not('actual_wait_time', 'is', null)
      .gte('joined_at', startDate.toISOString())
      .lte('joined_at', endDate.toISOString());

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

    // Get top venues by orders in period
    const { data: venueOrders } = await supabase
      .from('orders')
      .select('venue_id, venues(name)')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

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

    // Get active venue IDs in period
    const activeVenueIds = new Set(Object.keys(venueOrderCounts));

    // Get top venues by rating in period
    const { data: venueRatings } = await supabase
      .from('order_ratings')
      .select('venue_id, rating, venues(name)')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

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
      .filter(v => v.rating_count >= 3)
      .sort((a, b) => b.avg_rating - a.avg_rating)
      .slice(0, 5);

    // Get most active venues (last 7 days)
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

    // Get daily signup trends in period
    const dailySignups: { date: string, count: number }[] = [];
    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = profiles?.filter(p => {
        const created = new Date(p.created_at);
        return created >= date && created < nextDate;
      }).length || 0;

      dailySignups.push({
        date: date.toISOString().split('T')[0],
        count
      });
    }

    // Get daily order trends in period
    const dailyOrders: { date: string, count: number }[] = [];
    
    for (let i = dayCount - 1; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = periodOrders?.filter(o => {
        const created = new Date(o.created_at);
        return created >= date && created < nextDate;
      }).length || 0;

      dailyOrders.push({
        date: date.toISOString().split('T')[0],
        count
      });
    }

    // Calculate active venue percentage
    const activeVenueCount = activeVenueIds.size;
    const activeVenuePct = totalVenues > 0 ? Math.round((activeVenueCount / totalVenues) * 100) : 0;

    // Get inactive venues
    const inactiveVenues = venues
      ?.filter(v => !activeVenueIds.has(v.id))
      .map(v => ({
        venue_id: v.id,
        name: v.name,
        last_activity: v.created_at
      })) || [];

    // Customer retention calculation
    const allCustomerIds = new Set([
      ...(periodOrders?.map(o => o.user_id).filter(Boolean) || []),
      ...(periodWaitlist?.map(w => w.user_id).filter(Boolean) || [])
    ]);

    // Get customer analytics for returning vs new
    const { data: customerAnalytics } = await supabase
      .from('customer_analytics')
      .select('user_id, first_order_date, first_waitlist_date')
      .in('user_id', Array.from(allCustomerIds));

    let returningCustomers = 0;
    let newCustomers = 0;

    allCustomerIds.forEach(userId => {
      const customer = customerAnalytics?.find(c => c.user_id === userId);
      if (customer) {
        const firstActivity = new Date(customer.first_order_date || customer.first_waitlist_date);
        if (firstActivity < startDate) {
          returningCustomers++;
        } else {
          newCustomers++;
        }
      } else {
        newCustomers++;
      }
    });

    const retentionRate = allCustomerIds.size > 0 
      ? Math.round((returningCustomers / allCustomerIds.size) * 100) 
      : 0;

    console.log('Platform analytics generated:', {
      total_venues: totalVenues,
      total_patrons: totalPatrons,
      active_users: activeUsers30d,
      period_orders: totalOrders,
      period_waitlist: totalWaitlistEntries
    });

    return new Response(
      JSON.stringify({
        summary: {
          total_venues: totalVenues,
          total_patrons: totalPatrons,
          active_users_30d: activeUsers30d,
          new_signups_7d: newSignups7d?.length || 0,
          new_signups_30d: newSignupsInPeriod?.length || 0,
          platform_avg_rating: Math.round(avgRating * 10) / 10
        },
        orders: {
          total_orders: totalOrders,
          orders_by_status: orderStatusBreakdown,
          avg_prep_accuracy_pct: avgPrepAccuracy,
          total_this_month: totalOrders,
          cancelled_count: cancelledCount,
          rejected_count: rejectedCount,
          completed_count: completedCount,
          conversion_rate: orderConversionRate
        },
        waitlist: {
          total_entries: totalWaitlistEntries,
          avg_wait_accuracy_pct: avgWaitAccuracy,
          no_show_rate_pct: noShowRate,
          seated_count: seatedCount,
          cancelled_count: waitlistCancelledCount,
          conversion_rate: waitlistConversionRate
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
          active_venue_count: activeVenueCount,
          inactive_venues: inactiveVenues.slice(0, 20)
        },
        customer_retention: {
          returning_customers: returningCustomers,
          new_customers: newCustomers,
          retention_rate: retentionRate
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
