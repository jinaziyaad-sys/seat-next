import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get active alert rules
    const { data: rules, error: rulesError } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('is_active', true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: 'No active alert rules' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date();
    const triggeredAlerts: string[] = [];

    for (const rule of rules) {
      // Check cooldown
      if (rule.last_triggered_at) {
        const lastTriggered = new Date(rule.last_triggered_at);
        const cooldownMs = (rule.cooldown_minutes || 60) * 60 * 1000;
        if (now.getTime() - lastTriggered.getTime() < cooldownMs) continue;
      }

      let currentValue: number | null = null;

      // Evaluate metric
      switch (rule.metric) {
        case 'error_count_1h': {
          const { count } = await supabase
            .from('platform_errors')
            .select('*', { count: 'exact', head: true })
            .gte('last_seen_at', new Date(now.getTime() - 3600000).toISOString())
            .eq('status', 'new');
          currentValue = count ?? 0;
          break;
        }
        case 'active_venues': {
          const { count } = await supabase
            .from('venues')
            .select('*', { count: 'exact', head: true });
          currentValue = count ?? 0;
          break;
        }
        case 'pending_orders': {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .in('status', ['placed', 'in_prep']);
          currentValue = count ?? 0;
          break;
        }
        case 'pending_data_requests': {
          const { count } = await supabase
            .from('data_deletion_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
          currentValue = count ?? 0;
          break;
        }
        case 'waitlist_length': {
          const { count } = await supabase
            .from('waitlist_entries')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'waiting');
          currentValue = count ?? 0;
          break;
        }
        default:
          console.log(`Unknown metric: ${rule.metric}`);
          continue;
      }

      if (currentValue === null) continue;

      // Evaluate comparison
      let triggered = false;
      switch (rule.comparison) {
        case 'greater_than':
          triggered = currentValue > rule.threshold;
          break;
        case 'less_than':
          triggered = currentValue < rule.threshold;
          break;
        case 'equals':
          triggered = currentValue === rule.threshold;
          break;
      }

      if (triggered) {
        triggeredAlerts.push(`Alert: ${rule.metric} is ${currentValue} (threshold: ${rule.comparison} ${rule.threshold})`);

        // Update last_triggered_at
        await supabase
          .from('alert_rules')
          .update({ last_triggered_at: now.toISOString() })
          .eq('id', rule.id);

        // Log to audit
        await supabase.rpc('log_audit_event', {
          p_action: 'alert_triggered',
          p_entity_type: 'alert_rule',
          p_entity_id: rule.id,
          p_details: { metric: rule.metric, value: currentValue, threshold: rule.threshold, comparison: rule.comparison }
        });
      }
    }

    return new Response(
      JSON.stringify({ checked: rules.length, triggered: triggeredAlerts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Alert check error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
