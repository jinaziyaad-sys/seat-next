import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

interface TableConfig {
  id: string;
  capacity: number;
  name: string;
}

// Find the optimal combination of tables to accommodate a party
// Uses an exhaustive search to minimize wasted seats, then minimize table count
function findTableCombination(
  partySize: number,
  allTables: TableConfig[],
  occupiedTableIds: Set<string>
): TableConfig[] {
  const availableTables = allTables.filter(t => !occupiedTableIds.has(t.id));
  
  if (availableTables.length === 0) return [];
  
  const validCombinations: TableConfig[][] = [];
  
  // Generate all possible combinations recursively
  function generateCombinations(
    index: number, 
    current: TableConfig[], 
    currentCapacity: number
  ) {
    // If we have enough capacity, this is a valid combination
    if (currentCapacity >= partySize && current.length > 0) {
      validCombinations.push([...current]);
    }
    
    // Try adding more tables
    for (let i = index; i < availableTables.length; i++) {
      current.push(availableTables[i]);
      generateCombinations(i + 1, current, currentCapacity + availableTables[i].capacity);
      current.pop();
    }
  }
  
  generateCombinations(0, [], 0);
  
  if (validCombinations.length === 0) return [];
  
  // Sort by: 1) Minimum wasted seats (primary), 2) Fewest tables (secondary)
  validCombinations.sort((a, b) => {
    const wasteA = a.reduce((sum, t) => sum + t.capacity, 0) - partySize;
    const wasteB = b.reduce((sum, t) => sum + t.capacity, 0) - partySize;
    
    // Prefer combination with less wasted seats
    if (wasteA !== wasteB) return wasteA - wasteB;
    
    // If same waste, prefer fewer tables
    return a.length - b.length;
  });
  
  return validCombinations[0];
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

    // Get occupied tables in this time slot (±30 min buffer) - MUST happen before multi-table check
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

    // STEP 1: Try to find a single table that can fit the party
    const availableSingleTables = tableConfiguration
      .filter(table => !occupiedTableIds.has(table.id) && table.capacity >= party_size)
      .sort((a, b) => a.capacity - b.capacity); // Sort by capacity (smallest first)

    if (availableSingleTables.length > 0) {
      const matchedTable = availableSingleTables[0];
      const utilization = Math.round((party_size / matchedTable.capacity) * 100);
      console.log('✅ Found single table:', matchedTable);
      
      return new Response(
        JSON.stringify({ 
          available: true,
          matched_table: matchedTable,
          requires_multiple_tables: false,
          utilization_percent: utilization,
          available_tables_count: availableSingleTables.length,
          total_tables: tableConfiguration.length,
          warning: utilization < 50 ? `Using ${matchedTable.capacity}-seat table for party of ${party_size}` : null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 2: No single table fits, try to find optimal combination
    console.log('🔍 No single table fits, searching for multi-table combination...');
    const tableCombination = findTableCombination(party_size, tableConfiguration, occupiedTableIds);
    
    if (tableCombination.length > 0) {
      const totalCapacity = tableCombination.reduce((sum, t) => sum + t.capacity, 0);
      console.log('✅ Found multi-table combination:', {
        tables: tableCombination,
        totalCapacity,
        partySize: party_size,
        wastedSeats: totalCapacity - party_size
      });
      
      return new Response(
        JSON.stringify({ 
          available: true,
          requires_multiple_tables: true,
          tables_needed: tableCombination,
          total_tables: tableCombination.length,
          total_capacity: totalCapacity,
          party_size: party_size,
          message: `Your party of ${party_size} requires ${tableCombination.length} tables`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // STEP 3: No tables or combinations available, find next available slot
    console.log('❌ No tables or combinations available');
    if (false) { // Skip next slot logic for now
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
    
    // If we got here, no tables available at all
    return new Response(
      JSON.stringify({ 
        available: false,
        reason: `No tables available for party of ${party_size}`,
        total_tables: tableConfiguration.length,
        occupied_tables: occupiedTableIds.size
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
