import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeatureRequestInput {
  title: string;
  description: string;
  source: 'merchant' | 'patron' | 'dev';
  submitter_id?: string;
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

    const request: FeatureRequestInput = await req.json();
    console.log('Processing feature request:', request.title);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch existing feature requests for duplicate detection
    const { data: existingRequests } = await supabase
      .from('feature_requests')
      .select('id, title, description, category')
      .limit(50)
      .order('created_at', { ascending: false });

    const existingContext = existingRequests?.map(r => 
      `- "${r.title}": ${r.description.substring(0, 100)}...`
    ).join('\n') || 'No existing requests';

    const systemPrompt = `You are an AI product manager for a restaurant management platform. Your job is to:
1. Categorize feature requests into appropriate categories
2. Assign priority based on impact and effort
3. Summarize the request concisely
4. Detect if this is similar to existing requests

Available categories:
- UI/UX: Interface improvements, design changes
- Performance: Speed, efficiency improvements
- Features: New functionality
- Integration: Third-party integrations
- Mobile: Mobile-specific improvements
- Analytics: Reporting, metrics, insights
- Operations: Kitchen/waitlist/order management
- Security: Authentication, access control
- Other: Doesn't fit other categories

Priority levels:
- critical: Blocking issue or major business impact
- high: Significant improvement, high user demand
- medium: Nice to have, moderate impact
- low: Minor improvement, low urgency

Existing feature requests:
${existingContext}

Return a JSON object with this structure:
{
  "category": "category name",
  "priority": "low|medium|high|critical",
  "summary": "A concise 1-2 sentence summary",
  "similar_ids": ["uuid1", "uuid2"] or [] if none similar,
  "reasoning": "Brief explanation of category/priority choices"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this feature request:\n\nTitle: ${request.title}\nDescription: ${request.description}\nSource: ${request.source}` }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let aiResponseText = data.choices?.[0]?.message?.content || '';
    
    // Clean up the response
    aiResponseText = aiResponseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    let analysis;
    try {
      analysis = JSON.parse(aiResponseText);
    } catch {
      console.error('Failed to parse AI response:', aiResponseText);
      // Fallback to defaults
      analysis = {
        category: 'Other',
        priority: 'medium',
        summary: request.description.substring(0, 200),
        similar_ids: [],
        reasoning: 'AI parsing failed - using defaults'
      };
    }

    // Insert the feature request
    const { data: newRequest, error: insertError } = await supabase
      .from('feature_requests')
      .insert({
        title: request.title,
        description: request.description,
        category: analysis.category,
        priority: analysis.priority,
        source: request.source,
        submitter_id: request.submitter_id || null,
        ai_summary: analysis.summary,
        similar_request_ids: analysis.similar_ids.length > 0 ? analysis.similar_ids : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert feature request:', insertError);
      throw new Error('Failed to save feature request');
    }

    const tokensUsed = data.usage?.total_tokens || 0;
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
        action_type: 'feature_request_analysis',
        input_data: { title: request.title },
        output_data: { category: analysis.category, priority: analysis.priority },
        tokens_used: tokensUsed,
        duration_ms: durationMs,
      }),
    });

    console.log('Feature request processed:', newRequest.id);

    return new Response(JSON.stringify({
      request: newRequest,
      analysis: {
        category: analysis.category,
        priority: analysis.priority,
        summary: analysis.summary,
        similar_ids: analysis.similar_ids,
        reasoning: analysis.reasoning,
      },
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-feature-request:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
