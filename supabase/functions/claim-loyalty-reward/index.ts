import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { venue_id } = await req.json();
    if (!venue_id) {
      return new Response(JSON.stringify({ error: 'venue_id required' }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get patron's loyalty record
    const { data: loyalty } = await admin
      .from('patron_loyalty')
      .select('*')
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)
      .single();

    if (!loyalty) {
      return new Response(JSON.stringify({ error: 'No loyalty record found' }), { status: 404, headers: corsHeaders });
    }

    // Get the program
    const { data: program } = await admin
      .from('loyalty_programs')
      .select('*')
      .eq('id', loyalty.program_id)
      .single();

    if (!program || !program.is_active) {
      return new Response(JSON.stringify({ error: 'Program not active' }), { status: 400, headers: corsHeaders });
    }

    // Check if already has an active code
    const { data: existingCodes } = await admin
      .from('discount_codes')
      .select('id')
      .eq('user_id', user.id)
      .eq('venue_id', venue_id)
      .eq('status', 'active');

    if (existingCodes && existingCodes.length > 0) {
      return new Response(JSON.stringify({ error: 'You already have an active reward code' }), { status: 400, headers: corsHeaders });
    }

    // Check threshold
    let eligible = false;
    if (program.type === 'stamp_card') {
      eligible = loyalty.stamps_count >= (program.stamp_threshold || 10);
    } else {
      // For points, check if any reward is claimable
      const { data: reward } = await admin
        .from('loyalty_rewards')
        .select('*')
        .eq('program_id', program.id)
        .eq('is_active', true)
        .lte('points_required', loyalty.points_balance)
        .order('points_required', { ascending: false })
        .limit(1)
        .single();

      if (reward) eligible = true;
    }

    if (!eligible) {
      return new Response(JSON.stringify({ error: 'Not enough stamps/points yet' }), { status: 400, headers: corsHeaders });
    }

    // Get the reward
    const rewardQuery = admin
      .from('loyalty_rewards')
      .select('*')
      .eq('program_id', program.id)
      .eq('is_active', true);

    if (program.type === 'stamp_card') {
      rewardQuery.order('stamps_required', { ascending: true, nullsFirst: true });
    } else {
      rewardQuery.lte('points_required', loyalty.points_balance).order('points_required', { ascending: false });
    }

    const { data: reward } = await rewardQuery.limit(1).single();

    if (!reward) {
      return new Response(JSON.stringify({ error: 'No reward configured' }), { status: 400, headers: corsHeaders });
    }

    // Generate code
    const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
      .slice(0, 8);

    // Calculate expiry date from voucher_validity_days
    const validityDays = reward.voucher_validity_days || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    // Insert discount code
    await admin.from('discount_codes').insert({
      venue_id,
      user_id: user.id,
      code,
      reward_id: reward.id,
      reward_name: reward.name,
      expires_at: expiresAt.toISOString(),
    });

    // Reset balance
    if (program.type === 'stamp_card') {
      await admin.from('patron_loyalty').update({ stamps_count: 0, updated_at: new Date().toISOString() })
        .eq('user_id', user.id).eq('venue_id', venue_id);
    } else {
      await admin.from('patron_loyalty').update({
        points_balance: loyalty.points_balance - (reward.points_required || 0),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id).eq('venue_id', venue_id);
    }

    // Log transaction
    await admin.from('loyalty_transactions').insert({
      user_id: user.id,
      venue_id,
      program_id: program.id,
      type: program.type === 'stamp_card' ? 'stamps_reset' : 'reward_redeemed',
      stamps_delta: program.type === 'stamp_card' ? -loyalty.stamps_count : 0,
      points_delta: program.type !== 'stamp_card' ? -(reward.points_required || 0) : 0,
      source_type: 'reward',
    });

    return new Response(JSON.stringify({ code, reward_name: reward.name }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
