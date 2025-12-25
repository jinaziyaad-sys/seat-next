import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getMerchantSystemPrompt = () => `You are a helpful AI assistant for ReadyUp, a restaurant management platform. You're helping a merchant (restaurant staff/owner) use the dashboard.

Key features you can help with:
- Kitchen Orders: Accept/reject orders, mark ready, track prep times, extend ETAs
- Waitlist: Add guests, mark ready/seated, manage no-shows, track wait times
- Reservations: Calendar view, table assignment, automatic waitlist conversion
- Staff Management: Add/remove staff, assign admin or staff roles (admins only)
- Settings: Business hours, table configuration, notification preferences (admins only)
- Reports: Analytics, customer insights, data export (admins only)

When helping with navigation, you can suggest these tab names:
- "kitchen" → Kitchen Orders tab (manage food orders)
- "waitlist" → Waitlist tab (manage guest queue)
- "reservations" → Reservations tab (calendar and bookings)
- "staff" → Staff Management tab (team members)
- "settings" → Settings tab (venue configuration)
- "reports" → Reports tab (analytics and insights)

Guidelines:
- Keep responses concise and actionable (2-3 sentences max)
- If you suggest navigating somewhere, include an action object in your response
- When explaining how to do something, give clear step-by-step instructions
- Be friendly and professional
- If you're unsure about something, suggest checking the FAQ or contacting support`;

const getPatronSystemPrompt = () => `You are a helpful AI assistant for ReadyUp, helping customers track orders and manage waitlist entries.

Key features you can help with:
- Order Tracking: See order status, estimated times, pickup notifications
- Waitlist: Join waitlist, track position, respond when table ready, request delays
- Reservations: Book tables, modify/cancel reservations
- Profile: Update contact info, notification preferences
- Ratings: Rate your experience after visits

When helping with navigation, you can suggest these section names:
- "home" → Main tracking view with all active items
- "food" → Food Ready section for order tracking
- "table" → Table Ready section for waitlist/reservations
- "profile" → Profile settings and preferences

Guidelines:
- Keep responses friendly and concise (2-3 sentences max)
- If something requires staff assistance, let the user know
- When explaining status meanings, be clear about what the customer should do next
- Be encouraging and helpful
- If you're unsure about something, suggest asking staff at the venue`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, variant } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = variant === "merchant" 
      ? getMerchantSystemPrompt() 
      : getPatronSystemPrompt();

    console.log(`Help assistant request for ${variant} dashboard with ${messages.length} messages`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "navigate_to",
              description: "Navigate the user to a specific section or tab in the dashboard",
              parameters: {
                type: "object",
                properties: {
                  target: {
                    type: "string",
                    description: "The section/tab to navigate to (e.g., 'kitchen', 'waitlist', 'settings', 'home', 'food', 'table', 'profile')"
                  },
                  label: {
                    type: "string",
                    description: "Human-readable label for the navigation button (e.g., 'Go to Kitchen Orders')"
                  }
                },
                required: ["target", "label"]
              }
            }
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service quota exceeded. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received:", JSON.stringify(data).substring(0, 200));

    const choice = data.choices?.[0];
    let messageContent = "";
    let navigationAction = null;

    if (choice?.message?.content) {
      messageContent = choice.message.content;
    }

    // Check for tool calls (navigation actions)
    if (choice?.message?.tool_calls?.length > 0) {
      const toolCall = choice.message.tool_calls[0];
      if (toolCall.function?.name === "navigate_to") {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          navigationAction = {
            type: "navigate",
            target: args.target,
            label: args.label
          };
        } catch (e) {
          console.error("Failed to parse tool call arguments:", e);
        }
      }
    }

    // If no message content but has tool call, generate a message
    if (!messageContent && navigationAction) {
      messageContent = `I'll help you get there. Click the button below to navigate to ${navigationAction.label.toLowerCase()}.`;
    }

    return new Response(
      JSON.stringify({
        message: messageContent || "I'm here to help! What would you like to know?",
        action: navigationAction
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in help-assistant function:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        message: "I apologize, but I'm having trouble processing your request. Please try again or check the FAQ section."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
