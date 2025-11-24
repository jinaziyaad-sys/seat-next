import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

interface TableConfig {
  id: string;
  capacity: number;
  name: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { venue_id, reservation_time, party_size } = await req.json();

    if (!venue_id || !reservation_time || !party_size) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Finding table for:', { venue_id, reservation_time, party_size });

    // Get venue settings with table configuration
    const { data: venue, error: venueError } = await supabaseClient
      .from('venues')
      .select('settings')
      .eq('id', venue_id)
      .single();

    if (venueError || !venue) {
      console.error('Venue fetch error:', venueError);
      return new Response(
        JSON.stringify({ error: 'Venue not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tableConfiguration = (venue.settings as any)?.table_configuration as TableConfig[] || [];

    if (tableConfiguration.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No table configuration found. Please configure tables in settings.',
          available: false 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if party size exceeds maximum table capacity
    const maxCapacity = Math.max(...tableConfiguration.map(t => t.capacity));
    if (party_size > maxCapacity) {
      return new Response(
        JSON.stringify({ 
          available: false,
          reason: `Party size (${party_size}) exceeds maximum table capacity (${maxCapacity})`,
          max_capacity: maxCapacity
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get occupied tables in this time slot (±30 min buffer)
    const { data: occupiedTables, error: occupiedError } = await supabaseClient
      .rpc('get_occupied_tables', {
        p_venue_id: venue_id,
        p_time_slot: reservation_time,
        p_buffer_minutes: 30
      });

    if (occupiedError) {
      console.error('Error fetching occupied tables:', occupiedError);
      return new Response(
        JSON.stringify({ error: 'Failed to check table availability' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const occupiedTableIds = new Set((occupiedTables || []).map((t: any) => t.table_id));

    console.log('Occupied tables:', Array.from(occupiedTableIds));

    // Find available tables that fit the party size
    const availableTables = tableConfiguration
      .filter(table => !occupiedTableIds.has(table.id) && table.capacity >= party_size)
      .sort((a, b) => a.capacity - b.capacity); // Sort by capacity (smallest first for optimal assignment)

    if (availableTables.length === 0) {
      // Try to find next available slot
      const nextSlots = [15, 30, 45, 60, 90, 120]; // Check slots in 15-min increments
      let nextAvailableSlot = null;

      for (const minutesAhead of nextSlots) {
        const testTime = new Date(new Date(reservation_time).getTime() + minutesAhead * 60000).toISOString();
        
        const { data: futureOccupied } = await supabaseClient
          .rpc('get_occupied_tables', {
            p_venue_id: venue_id,
            p_time_slot: testTime,
            p_buffer_minutes: 30
          });

        const futureOccupiedIds = new Set((futureOccupied || []).map((t: any) => t.table_id));
        const futureAvailable = tableConfiguration.filter(
          table => !futureOccupiedIds.has(table.id) && table.capacity >= party_size
        );

        if (futureAvailable.length > 0) {
          nextAvailableSlot = testTime;
          break;
        }
      }

      return new Response(
        JSON.stringify({ 
          available: false,
          reason: `No tables available for party of ${party_size}`,
          next_available_slot: nextAvailableSlot,
          total_tables: tableConfiguration.length,
          occupied_tables: occupiedTableIds.size
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the best matching table (smallest that fits)
    const matchedTable = availableTables[0];
    const utilization = Math.round((party_size / matchedTable.capacity) * 100);

    return new Response(
      JSON.stringify({ 
        available: true,
        matched_table: matchedTable,
        utilization_percent: utilization,
        available_tables_count: availableTables.length,
        total_tables: tableConfiguration.length,
        warning: utilization < 50 ? `Using ${matchedTable.capacity}-seat table for party of ${party_size}` : null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in find-available-table:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
