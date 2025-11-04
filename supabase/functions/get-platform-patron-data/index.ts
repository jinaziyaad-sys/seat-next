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

    // Verify user is super_admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is super_admin
    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { 
      _user_id: userData.user.id 
    });

    if (!isSuperAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - super_admin required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching platform patron data...');

    // Fetch all patrons with their activity
    const { data: patrons, error: patronsError } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        email_verified,
        phone_verified,
        fcm_token,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (patronsError) {
      console.error('Error fetching patrons:', patronsError);
      throw patronsError;
    }

    console.log(`Found ${patrons.length} patrons`);

    // Get order counts per patron
    const { data: orderCounts, error: ordersError } = await supabase
      .from('orders')
      .select('user_id, venue_id')
      .not('user_id', 'is', null);

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      throw ordersError;
    }

    // Get waitlist counts per patron
    const { data: waitlistCounts, error: waitlistError } = await supabase
      .from('waitlist_entries')
      .select('user_id, venue_id')
      .not('user_id', 'is', null);

    if (waitlistError) {
      console.error('Error fetching waitlist:', waitlistError);
      throw waitlistError;
    }

    // Get last activity dates
    const { data: lastOrders, error: lastOrdersError } = await supabase
      .from('orders')
      .select('user_id, created_at')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false });

    const { data: lastWaitlists, error: lastWaitlistsError } = await supabase
      .from('waitlist_entries')
      .select('user_id, created_at')
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false });

    // Get venue names
    const { data: venues, error: venuesError } = await supabase
      .from('venues')
      .select('id, name');

    if (venuesError) {
      console.error('Error fetching venues:', venuesError);
      throw venuesError;
    }

    const venueMap = new Map(venues.map(v => [v.id, v.name]));

    // Process patron data
    const patronData = patrons.map(patron => {
      const patronOrders = orderCounts?.filter(o => o.user_id === patron.id) || [];
      const patronWaitlists = waitlistCounts?.filter(w => w.user_id === patron.id) || [];
      
      // Find preferred venue (most orders)
      const venueOrderCounts = new Map<string, number>();
      patronOrders.forEach(order => {
        const count = venueOrderCounts.get(order.venue_id) || 0;
        venueOrderCounts.set(order.venue_id, count + 1);
      });
      
      let preferredVenueId = null;
      let maxOrders = 0;
      venueOrderCounts.forEach((count, venueId) => {
        if (count > maxOrders) {
          maxOrders = count;
          preferredVenueId = venueId;
        }
      });

      // Get last activity
      const lastOrder = lastOrders?.find(o => o.user_id === patron.id);
      const lastWaitlist = lastWaitlists?.find(w => w.user_id === patron.id);
      
      let lastActivityDate = null;
      if (lastOrder && lastWaitlist) {
        lastActivityDate = new Date(lastOrder.created_at) > new Date(lastWaitlist.created_at) 
          ? lastOrder.created_at 
          : lastWaitlist.created_at;
      } else if (lastOrder) {
        lastActivityDate = lastOrder.created_at;
      } else if (lastWaitlist) {
        lastActivityDate = lastWaitlist.created_at;
      }

      const daysSinceSignup = Math.floor(
        (new Date().getTime() - new Date(patron.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      const daysSinceLastActivity = lastActivityDate 
        ? Math.floor((new Date().getTime() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const isActive = daysSinceLastActivity !== null && daysSinceLastActivity <= 30;

      return {
        id: patron.id,
        full_name: patron.full_name,
        email: patron.email,
        phone: patron.phone,
        email_verified: patron.email_verified,
        phone_verified: patron.phone_verified,
        has_push_enabled: !!patron.fcm_token,
        created_at: patron.created_at,
        days_since_signup: daysSinceSignup,
        last_activity_date: lastActivityDate,
        days_since_last_activity: daysSinceLastActivity,
        total_orders: patronOrders.length,
        total_waitlist_joins: patronWaitlists.length,
        preferred_venue_id: preferredVenueId,
        preferred_venue_name: preferredVenueId ? venueMap.get(preferredVenueId) : null,
        account_status: isActive ? 'active' : 'inactive',
      };
    });

    // Calculate summary stats
    const totalPatrons = patronData.length;
    const activePatrons = patronData.filter(p => p.account_status === 'active').length;
    const inactivePatrons = totalPatrons - activePatrons;
    const totalOrders = patronData.reduce((sum, p) => sum + p.total_orders, 0);
    const totalWaitlistJoins = patronData.reduce((sum, p) => sum + p.total_waitlist_joins, 0);
    const avgOrdersPerPatron = totalPatrons > 0 ? (totalOrders / totalPatrons).toFixed(2) : '0.00';

    console.log('Successfully processed patron data');

    return new Response(
      JSON.stringify({
        summary: {
          total_patrons: totalPatrons,
          active_patrons: activePatrons,
          inactive_patrons: inactivePatrons,
          total_orders: totalOrders,
          total_waitlist_joins: totalWaitlistJoins,
          avg_orders_per_patron: parseFloat(avgOrdersPerPatron),
        },
        patrons: patronData,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-platform-patron-data:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});