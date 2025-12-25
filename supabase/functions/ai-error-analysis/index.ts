import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ErrorAnalysisRequest {
  error_id: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  component?: string;
  route?: string;
  occurrence_count?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const request: ErrorAnalysisRequest = await req.json();
    console.log('Analyzing error:', request.error_id, request.error_type);

    const systemPrompt = `You are an expert frontend developer debugging a React/TypeScript web application built with Vite, Tailwind CSS, and Supabase. 

Your job is to analyze runtime errors and provide:
1. A root cause analysis explaining what likely caused this error
2. Suggested fixes that a developer could implement
3. A formatted bug report that can be shared with a development team

Be concise but thorough. Focus on actionable insights.`;

    const userPrompt = `Analyze this runtime error:

**Error Type:** ${request.error_type}
**Error Message:** ${request.error_message}
${request.stack_trace ? `**Stack Trace:**\n\`\`\`\n${request.stack_trace}\n\`\`\`` : ''}
${request.component ? `**Component:** ${request.component}` : ''}
${request.route ? `**Route:** ${request.route}` : ''}
${request.occurrence_count ? `**Occurrences:** ${request.occurrence_count} times` : ''}

Please provide:
1. **Root Cause Analysis**: What likely caused this error?
2. **Suggested Fixes**: What should be done to fix it?
3. **Bug Report**: A formatted report I can share with the development team.`;

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
          { role: 'user', content: userPrompt }
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
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || 'Unable to analyze error';
    const tokensUsed = data.usage?.total_tokens || 0;
    const durationMs = Date.now() - startTime;

    // Log the operation
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseKey) {
      await fetch(`${supabaseUrl}/rest/v1/ai_operations_log`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          action_type: 'error_analysis',
          input_data: { error_id: request.error_id, error_type: request.error_type },
          output_data: { analysis_length: analysis.length },
          tokens_used: tokensUsed,
          duration_ms: durationMs,
        }),
      });
    }

    console.log('Analysis complete for error:', request.error_id);

    return new Response(JSON.stringify({
      analysis,
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in ai-error-analysis:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
