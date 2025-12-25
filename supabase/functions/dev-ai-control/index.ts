import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIControlRequest {
  command: string;
  context?: {
    currentConfigs?: Record<string, any>;
  };
}

interface ConfigAction {
  action: 'update_config' | 'create_announcement' | 'clear_announcement' | 'info';
  key?: string;
  value?: any;
  description?: string;
  confirmationMessage: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const { command, context } = await req.json() as AIControlRequest;

    if (!command) {
      return new Response(
        JSON.stringify({ error: 'Command is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing AI control command:', command);

    const systemPrompt = `You are a developer assistant for a restaurant/venue management platform. Your job is to interpret natural language commands and translate them into configuration changes.

Available configuration keys:
- feature.food_ordering_enabled (boolean): Enable/disable food ordering
- feature.waitlist_enabled (boolean): Enable/disable waitlist functionality
- feature.reservations_enabled (boolean): Enable/disable reservations
- feature.ratings_enabled (boolean): Enable/disable ratings
- feature.kitchen_board_enabled (boolean): Enable/disable kitchen board
- feature.analytics_enabled (boolean): Enable/disable analytics
- global.default_prep_time_minutes (number): Default prep time in minutes
- global.default_wait_time_minutes (number): Default wait time in minutes
- global.max_party_size (number): Maximum party size
- global.ready_deadline_minutes (number): Minutes before ready order expires
- announcement.active (object or null): Global announcement {message, type: 'info'|'warning'|'error'|'maintenance', dismissible}

Current configuration context: ${JSON.stringify(context?.currentConfigs || {})}

Respond with a JSON object containing an array of actions:
{
  "actions": [
    {
      "action": "update_config" | "create_announcement" | "clear_announcement" | "info",
      "key": "config key (for update_config)",
      "value": "new value",
      "description": "what this change does",
      "confirmationMessage": "human-readable message to show user"
    }
  ],
  "summary": "brief summary of what will happen"
}

For announcements, use:
{
  "action": "create_announcement",
  "value": {"message": "...", "type": "info|warning|error|maintenance", "dismissible": true/false},
  "confirmationMessage": "..."
}

If the command is unclear or you can't help, use action: "info" with a helpful message.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: command }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('AI response:', content);

    const parsedResponse = JSON.parse(content);

    return new Response(
      JSON.stringify(parsedResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in dev-ai-control:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        actions: [{
          action: 'info',
          confirmationMessage: 'Sorry, I encountered an error processing your request. Please try again.'
        }]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
