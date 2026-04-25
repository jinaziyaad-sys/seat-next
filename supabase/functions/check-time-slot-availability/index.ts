import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

interface TableConfig {
  id: string;
  capacity: number;
  name: string;
}

// Find if tables can accommodate a party (single table or combination)
function canFitParty(
  partySize: number,
  availableTables: TableConfig[]
): boolean {
  if (availableTables.length === 0) return false;
  
  // Check if any single table fits
  if (availableTables.some(t => t.capacity >= partySize)) {
    return true;
  }
  
  // Check if combination of tables can fit
  const validCombinations: TableConfig[][] = [];
  
  function generateCombinations(
    index: number, 
    current: TableConfig[], 
    currentCapacity: number
  ) {
    if (currentCapacity >= partySize && current.length > 0) {
      validCombinations.push([...current]);
      return; // Found one valid combination, that's enough
    }
    
    for (let i = index; i < availableTables.length; i++) {
      current.push(availableTables[i]);
      generateCombinations(i + 1, current, currentCapacity + availableTables[i].capacity);
      current.pop();
      
      // Early exit if we found a valid combination
      if (validCombinations.length > 0) return;
    }
  }
  
  generateCombinations(0, [], 0);
  return validCombinations.length > 0;
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

    const { venue_id, date, party_size, time_slots } = await req.json();

    if (!venue_id || !date || !party_size || !time_slots || !Array.isArray(time_slots)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: venue_id, date, party_size, time_slots' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking availability for:', { venue_id, date, party_size, slotsCount: time_slots.length });

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
      // No tables configured - all slots unavailable
      const results: Record<string, { available: boolean; reason?: string }> = {};
      for (const time of time_slots) {
        results[time] = { available: false, reason: 'No tables configured' };
      }
      return new Response(
        JSON.stringify(results),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check each time slot
    const results: Record<string, { available: boolean; reason?: string }> = {};

    for (const slot of time_slots) {
      try {
        // Handle both old format (string) and new format ({time, iso})
        // This ensures backward compatibility while fixing the timezone issue
        const timeKey = typeof slot === 'string' ? slot : slot.time;
        const reservationTime = typeof slot === 'string' 
          ? new Date(`${date}T${slot}:00`).toISOString()  // Fallback for old format
          : slot.iso;  // Use correct ISO timestamp from frontend

        // Get occupied tables for this slot (±30 min buffer)
        const { data: occupiedTables, error: occupiedError } = await supabaseClient
          .rpc('get_occupied_tables', {
            p_venue_id: venue_id,
            p_time_slot: reservationTime,
            p_buffer_minutes: 30
          });

        if (occupiedError) {
          console.error('Error fetching occupied tables for', timeKey, ':', occupiedError);
          results[timeKey] = { available: true }; // Default to available on error
          continue;
        }

        const occupiedTableIds = new Set((occupiedTables || []).map((t: any) => t.table_id));
        
        // Get available tables (not occupied)
        const availableTables = tableConfiguration.filter(t => !occupiedTableIds.has(t.id));
        
        // Check if party can be accommodated
        const canFit = canFitParty(party_size, availableTables);

        results[timeKey] = {
          available: canFit,
          reason: canFit ? undefined : 'Fully booked'
        };
      } catch (err) {
        console.error('Error processing time slot', slot, ':', err);
        const timeKey = typeof slot === 'string' ? slot : slot.time;
        results[timeKey] = { available: true }; // Default to available on error
      }
    }

    console.log('Availability results:', results);

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-time-slot-availability:', error);
    return new Response(
      JSON.stringify({ error: (error instanceof Error ? error.message : String(error)) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
