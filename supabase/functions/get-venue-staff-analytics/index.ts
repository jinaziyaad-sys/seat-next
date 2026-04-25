import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { venueId, startDate, endDate } = await req.json();
    if (!venueId || !startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'Missing venueId, startDate, or endDate' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is venue staff
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('venue_id', venueId)
      .maybeSingle();

    const { data: isSuperAdmin } = await supabase.rpc('is_super_admin', { _user_id: user.id });

    if (!role && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch orders with staff attribution in date range
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, prepared_by_staff_id, marked_ready_by_staff_id, status, created_at')
      .eq('venue_id', venueId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('status', 'eq', 'rejected');

    if (ordersError) throw ordersError;

    // Fetch order analytics for prep times
    const orderIds = (orders || []).map(o => o.id);
    let analyticsMap: Record<string, { actual_prep_time: number | null; quoted_prep_time: number }> = {};

    if (orderIds.length > 0) {
      // Batch in chunks of 200
      for (let i = 0; i < orderIds.length; i += 200) {
        const chunk = orderIds.slice(i, i + 200);
        const { data: analytics } = await supabase
          .from('order_analytics')
          .select('order_id, actual_prep_time, quoted_prep_time')
          .in('order_id', chunk);

        if (analytics) {
          for (const a of analytics) {
            analyticsMap[a.order_id] = {
              actual_prep_time: a.actual_prep_time,
              quoted_prep_time: a.quoted_prep_time,
            };
          }
        }
      }
    }

    // Collect unique staff IDs
    const staffIds = new Set<string>();
    for (const o of orders || []) {
      if (o.prepared_by_staff_id) staffIds.add(o.prepared_by_staff_id);
      if (o.marked_ready_by_staff_id) staffIds.add(o.marked_ready_by_staff_id);
    }

    // Fetch staff names
    const staffNames: Record<string, string> = {};
    if (staffIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(staffIds));

      if (profiles) {
        for (const p of profiles) {
          staffNames[p.id] = p.full_name || 'Unknown';
        }
      }
    }

    // Aggregate per-staff metrics
    const staffMetrics: Record<string, {
      ordersHandled: number;
      ordersMarkedReady: number;
      totalPrepTime: number;
      prepTimeCount: number;
      onTimeCount: number;
      timedOrderCount: number;
    }> = {};

    const totalOrders = (orders || []).length;
    let unattributedCount = 0;

    for (const o of orders || []) {
      const staffId = o.prepared_by_staff_id || o.marked_ready_by_staff_id;
      if (!staffId) {
        unattributedCount++;
        continue;
      }

      if (!staffMetrics[staffId]) {
        staffMetrics[staffId] = {
          ordersHandled: 0,
          ordersMarkedReady: 0,
          totalPrepTime: 0,
          prepTimeCount: 0,
          onTimeCount: 0,
          timedOrderCount: 0,
        };
      }

      if (o.prepared_by_staff_id === staffId) {
        staffMetrics[staffId].ordersHandled++;
      }
      if (o.marked_ready_by_staff_id === staffId) {
        staffMetrics[staffId].ordersMarkedReady++;
      }

      const analytics = analyticsMap[o.id];
      if (analytics && analytics.actual_prep_time !== null) {
        staffMetrics[staffId].totalPrepTime += analytics.actual_prep_time;
        staffMetrics[staffId].prepTimeCount++;

        if (analytics.actual_prep_time <= analytics.quoted_prep_time) {
          staffMetrics[staffId].onTimeCount++;
        }
        staffMetrics[staffId].timedOrderCount++;
      }
    }

    // Build response
    const staff = Object.entries(staffMetrics).map(([id, m]) => ({
      id,
      name: staffNames[id] || 'Unknown',
      ordersHandled: m.ordersHandled + m.ordersMarkedReady,
      avgPrepTime: m.prepTimeCount > 0 ? Math.round((m.totalPrepTime / m.prepTimeCount) * 10) / 10 : null,
      onTimeRate: m.timedOrderCount > 0 ? Math.round((m.onTimeCount / m.timedOrderCount) * 1000) / 10 : null,
      ordersPrepared: m.ordersHandled,
      ordersMarkedReady: m.ordersMarkedReady,
    }));

    // Sort by orders handled descending
    staff.sort((a, b) => b.ordersHandled - a.ordersHandled);

    return new Response(JSON.stringify({
      staff,
      totalOrders,
      unattributedCount,
      unattributedPercentage: totalOrders > 0 ? Math.round((unattributedCount / totalOrders) * 100) : 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Staff analytics error:', error);
    return new Response(JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
