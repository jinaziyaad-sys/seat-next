import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsQueryRequest {
  question: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const request: AnalyticsQueryRequest = await req.json();
    console.log('Processing analytics question:', request.question);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Available tables schema for AI context
    const schemaContext = `
Available tables in the database:

1. venues - Restaurant/venue information
   - id (uuid), name (text), address (text), phone (text), service_types (text[])
   
2. orders - Customer orders
   - id (uuid), venue_id (uuid), order_number (text), status (enum: awaiting_verification, placed, in_prep, ready, collected, no_show, rejected, cancelled)
   - customer_name (text), customer_phone (text), created_at (timestamp), eta (timestamp)
   
3. waitlist_entries - Waitlist queue entries
   - id (uuid), venue_id (uuid), customer_name (text), party_size (int), status (enum: waiting, ready, seated, cancelled, no_show)
   - reservation_type (text: walk_in, reservation), created_at (timestamp)
   
4. order_analytics - Order performance metrics
   - id (uuid), venue_id (uuid), order_id (uuid), placed_at (timestamp), quoted_prep_time (int), actual_prep_time (int)
   - day_of_week (int 0-6), hour_of_day (int 0-23)
   
5. waitlist_analytics - Waitlist performance metrics
   - id (uuid), venue_id (uuid), entry_id (uuid), joined_at (timestamp), quoted_wait_time (int), actual_wait_time (int)
   - party_size (int), day_of_week (int), hour_of_day (int)
   
6. order_ratings - Customer ratings for orders
   - id (uuid), venue_id (uuid), order_id (uuid), rating (int 1-5), feedback_text (text), created_at (timestamp)
   
7. waitlist_ratings - Customer ratings for waitlist experience
   - id (uuid), venue_id (uuid), waitlist_entry_id (uuid), rating (int 1-5), feedback_text (text)
   
8. daily_venue_snapshots - Daily aggregated metrics per venue
   - id (uuid), venue_id (uuid), snapshot_date (date), total_orders (int), completed_orders (int)
   - avg_prep_time_minutes (numeric), avg_wait_time_minutes (numeric), avg_rating (numeric)
   
9. customer_analytics - Customer behavior tracking
   - id (uuid), venue_id (uuid), user_id (uuid), total_orders (int), total_waitlist_joins (int)
   - customer_segment (text: new, active, regular, at_risk, inactive)
   
10. profiles - User profiles
    - id (uuid), full_name (text), email (text), phone (text)
    
11. platform_errors - Captured runtime errors
    - id (uuid), error_type (text), error_message (text), status (text), created_at (timestamp)
    
12. feature_requests - User feature requests
    - id (uuid), title (text), description (text), category (text), priority (text), status (text)`;

    const systemPrompt = `You are a SQL expert for a PostgreSQL database powering a restaurant management platform.

${schemaContext}

Your job is to:
1. Translate natural language questions into safe, read-only SQL queries (SELECT only)
2. Execute the query and return results
3. Provide a human-readable explanation of the results

CRITICAL RULES:
- ONLY generate SELECT statements - never INSERT, UPDATE, DELETE, DROP, etc.
- Always use proper table/column names from the schema
- Include appropriate JOINs when needed
- Limit results to 100 rows max
- Handle NULL values appropriately
- Use aggregate functions (COUNT, SUM, AVG, etc.) when appropriate

Return a JSON object with this structure:
{
  "sql": "YOUR SELECT QUERY HERE",
  "explanation": "Brief explanation of what this query does"
}`;

    // First, get the SQL query from AI
    const queryResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Generate a SQL query to answer: ${request.question}` }
        ],
      }),
    });

    if (!queryResponse.ok) {
      if (queryResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (queryResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${queryResponse.status}`);
    }

    const queryData = await queryResponse.json();
    let aiResponseText = queryData.choices?.[0]?.message?.content || '';
    
    // Clean up the response - remove markdown code blocks if present
    aiResponseText = aiResponseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let parsedQuery;
    try {
      parsedQuery = JSON.parse(aiResponseText);
    } catch {
      console.error('Failed to parse AI response:', aiResponseText);
      throw new Error('Failed to parse AI query response');
    }

    const { sql, explanation } = parsedQuery;

    // Validate it's a SELECT query
    const normalizedSql = sql.trim().toUpperCase();
    if (!normalizedSql.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed');
    }

    // Check for dangerous keywords - use word boundaries to avoid false positives like "created_at"
    const dangerousPatterns = [
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+\w+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bDROP\s+(TABLE|DATABASE|INDEX|VIEW|SCHEMA)\b/i,
      /\bTRUNCATE\b/i,
      /\bALTER\s+(TABLE|DATABASE)\b/i,
      /\bCREATE\s+(TABLE|DATABASE|INDEX|VIEW|FUNCTION|TRIGGER)\b/i,
      /\bGRANT\b/i,
      /\bREVOKE\b/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(sql)) {
        throw new Error(`Dangerous operation detected in query`);
      }
    }

    console.log('Executing SQL:', sql);

    let results: any[] = [];
    let queryExecutionError = null;

    try {
      // Use the secure RPC function to execute the query
      const { data, error } = await supabase.rpc('execute_readonly_query', {
        query_text: sql
      });

      if (error) {
        console.error('Query execution error:', error);
        queryExecutionError = error.message;
      } else {
        results = Array.isArray(data) ? data : [];
        console.log('Query returned', results.length, 'results');
      }
    } catch (e) {
      console.error('Query execution exception:', e);
      queryExecutionError = e instanceof Error ? e.message : 'Query execution failed';
    }

    const tokensUsed = queryData.usage?.total_tokens || 0;
    const durationMs = Date.now() - startTime;

    // Log the operation
    await fetch(`${SUPABASE_URL}/rest/v1/ai_operations_log`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        action_type: 'analytics_query',
        input_data: { question: request.question },
        output_data: { sql, results_count: results.length },
        tokens_used: tokensUsed,
        duration_ms: durationMs,
      }),
    });

    console.log('Analytics query complete, results:', results.length);

    return new Response(JSON.stringify({
      question: request.question,
      sql,
      explanation,
      results,
      error: queryExecutionError,
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-analytics-query:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
