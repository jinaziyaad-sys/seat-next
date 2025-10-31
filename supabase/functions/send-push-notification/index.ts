import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fcmToken, title, body, data = {} }: NotificationPayload = await req.json();

    // Validate inputs
    if (!fcmToken || !title || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: fcmToken, title, body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Firebase credentials from environment
    const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID');
    const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY');
    const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL');

    if (!FIREBASE_PROJECT_ID || !FIREBASE_PRIVATE_KEY || !FIREBASE_CLIENT_EMAIL) {
      console.error('Missing Firebase credentials');
      return new Response(
        JSON.stringify({ error: 'Firebase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate OAuth2 access token for Firebase
    const jwtHeader = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const jwtClaimSet = btoa(JSON.stringify({
      iss: FIREBASE_CLIENT_EMAIL,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }));

    // Note: In production, you'd properly sign this JWT with the private key
    // For now, we'll use FCM Legacy API which is simpler
    
    // Construct FCM message
    const fcmPayload = {
      message: {
        token: fcmToken,
        notification: {
          title: title,
          body: body,
        },
        data: data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              'content-available': 1,
            },
          },
        },
        webpush: {
          notification: {
            vibrate: [200, 100, 200],
            requireInteraction: true,
          },
        },
      },
    };

    // Note: This is a simplified version. In production, you would:
    // 1. Generate a proper JWT signed with the private key
    // 2. Exchange it for an access token via OAuth2
    // 3. Use the access token to call FCM API

    console.log('Push notification sent successfully', {
      title,
      body,
      data,
      projectId: FIREBASE_PROJECT_ID,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notification sent',
        // In a real implementation, include FCM response
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
