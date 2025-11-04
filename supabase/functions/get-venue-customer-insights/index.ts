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

    console.log(`Fetching customer insights for venue ${venue_id}, range: ${time_range}`);

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

    // Fetch customer analytics for this venue
    const { data: customers, error: customersError } = await supabase
      .from('customer_analytics')
      .select('*')
      .eq('venue_id', venue_id);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    console.log(`Found ${customers?.length || 0} customers`);

    // Get orders for the time range
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select('user_id, created_at, status')
      .eq('venue_id', venue_id)
      .gte('created_at', startDate.toISOString())
      .not('user_id', 'is', null);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    // Get waitlist for the time range
    const { data: recentWaitlist, error: waitlistError } = await supabase
      .from('waitlist_entries')
      .select('user_id, created_at')
      .eq('venue_id', venue_id)
      .gte('created_at', startDate.toISOString())
      .not('user_id', 'is', null);

    if (waitlistError) {
      console.error('Error fetching waitlist:', waitlistError);
      throw waitlistError;
    }

    // Calculate metrics
    const totalCustomers = customers?.length || 0;

    // New customers (first activity in this period)
    const newCustomerIds = new Set<string>();
    customers?.forEach(c => {
      if (c.first_order_date && new Date(c.first_order_date) >= startDate) {
        newCustomerIds.add(c.user_id);
      } else if (c.first_waitlist_date && new Date(c.first_waitlist_date) >= startDate) {
        newCustomerIds.add(c.user_id);
      }
    });
    const newCustomers = newCustomerIds.size;

    // Active customers in this period
    const activeCustomerIds = new Set<string>();
    recentOrders?.forEach(o => activeCustomerIds.add(o.user_id));
    recentWaitlist?.forEach(w => activeCustomerIds.add(w.user_id));
    const activeCustomers = activeCustomerIds.size;

    // Returning customers (had activity before AND during this period)
    const returningCustomers = Array.from(activeCustomerIds).filter(userId => {
      const customer = customers?.find(c => c.user_id === userId);
      if (!customer) return false;
      
      const firstActivityDate = customer.first_order_date || customer.first_waitlist_date;
      return firstActivityDate && new Date(firstActivityDate) < startDate;
    }).length;

    // Return rate
    const returnRate = totalCustomers > 0 ? (returningCustomers / activeCustomers) * 100 : 0;

    // Customer segments
    const segments = {
      new: 0,
      active: 0,
      regular: 0,
      at_risk: 0,
      inactive: 0,
    };

    customers?.forEach(c => {
      const segment = c.customer_segment || 'inactive';
      if (segment in segments) {
        segments[segment as keyof typeof segments]++;
      }
    });

    // Top loyal customers (by total activity)
    const loyalCustomers = customers
      ?.map(c => ({
        user_id: c.user_id,
        total_orders: c.total_orders,
        total_waitlist_joins: c.total_waitlist_joins,
        total_activity: c.total_orders + c.total_waitlist_joins,
        last_visit: c.last_order_date || c.last_waitlist_date,
        days_since_last_visit: c.days_since_last_visit,
      }))
      .sort((a, b) => b.total_activity - a.total_activity)
      .slice(0, 10) || [];

    // Get profile names for top customers
    const loyalCustomerIds = loyalCustomers.map(c => c.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', loyalCustomerIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

    const topLoyalCustomers = loyalCustomers.map(c => ({
      ...c,
      name: profileMap.get(c.user_id) || 'Unknown',
    }));

    // Average visit frequency
    const customersWithFrequency = customers?.filter(c => c.visit_frequency_days) || [];
    const avgVisitFrequency = customersWithFrequency.length > 0
      ? customersWithFrequency.reduce((sum, c) => sum + (c.visit_frequency_days || 0), 0) / customersWithFrequency.length
      : 0;

    // Daily new customer trend
    const dailyNewCustomers: Record<string, number> = {};
    customers?.forEach(c => {
      const firstDate = c.first_order_date || c.first_waitlist_date;
      if (firstDate && new Date(firstDate) >= startDate) {
        const dateKey = new Date(firstDate).toISOString().split('T')[0];
        dailyNewCustomers[dateKey] = (dailyNewCustomers[dateKey] || 0) + 1;
      }
    });

    const activityTrend = Object.entries(dailyNewCustomers)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    console.log('Successfully calculated customer insights');

    return new Response(
      JSON.stringify({
        summary: {
          total_customers: totalCustomers,
          new_customers: newCustomers,
          active_customers: activeCustomers,
          returning_customers: returningCustomers,
          return_rate: parseFloat(returnRate.toFixed(2)),
          avg_visit_frequency_days: parseFloat(avgVisitFrequency.toFixed(1)),
        },
        segments,
        top_loyal_customers: topLoyalCustomers,
        activity_trend: activityTrend,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-venue-customer-insights:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});