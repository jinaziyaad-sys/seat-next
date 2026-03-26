import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, limit } = await req.json();
    const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 5);

    if (!address || typeof address !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Validating address:', address);

    // Call Nominatim API with enhanced parameters for better precision
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=${safeLimit}&addressdetails=1&extratags=1&accept_language=en`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'VenueManagementApp/1.0', // Nominatim requires a User-Agent
      },
    });

    if (!response.ok) {
      console.error('Nominatim API error:', response.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to validate address' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Nominatim response:', data);

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          suggestions: [],
          error: 'Address not found. Please check and try again.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rank results by precision/specificity
    const rankedResults = data.map((result: any) => {
      let precisionScore = 0;
      let precisionLevel = 'area';
      
      // Check for house number in address
      if (result.address?.house_number) {
        precisionScore += 100;
        precisionLevel = 'exact';
      }
      
      // Check for street
      if (result.address?.road || result.address?.street) {
        precisionScore += 50;
        if (precisionLevel === 'area') precisionLevel = 'street';
      }
      
      // Prefer more specific place types
      if (result.type === 'house' || result.type === 'building') {
        precisionScore += 30;
      } else if (result.type === 'road' || result.type === 'street') {
        precisionScore += 20;
      }
      
      // Check importance score from Nominatim
      if (result.importance) {
        precisionScore += result.importance * 10;
      }
      
      return {
        ...result,
        precisionScore,
        precisionLevel,
      };
    });

    // Sort by precision score (highest first)
    rankedResults.sort((a: any, b: any) => b.precisionScore - a.precisionScore);
    
    const bestResult = rankedResults[0];
    const suggestions = rankedResults.slice(0, safeLimit).map((result: any) => ({
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
      formatted_address: result.display_name,
      precision: result.precisionLevel,
      address_components: result.address,
    }));
    
    console.log('Best result:', {
      display_name: bestResult.display_name,
      precision: bestResult.precisionLevel,
      score: bestResult.precisionScore,
      address: bestResult.address,
    });
    
    return new Response(
      JSON.stringify({
        valid: true,
        latitude: parseFloat(bestResult.lat),
        longitude: parseFloat(bestResult.lon),
        formatted_address: bestResult.display_name,
        precision: bestResult.precisionLevel,
        address_components: bestResult.address,
          suggestions,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error validating address:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
