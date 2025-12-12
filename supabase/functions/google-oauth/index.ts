import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Google OAuth Token Exchange
 *
 * Exchanges an OAuth authorization code for access and refresh tokens.
 * Stores tokens in the profiles table for future API access to:
 * - Google Analytics 4 (GA4)
 * - Google Search Console
 *
 * Required environment variables:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, userId, redirectUri } = await req.json();

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'Authorization code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Google OAuth credentials from environment
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('Missing Google credentials - clientId:', !!clientId, 'clientSecret:', !!clientSecret);
      return new Response(
        JSON.stringify({ error: 'Google OAuth not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for tokens
    console.log('Exchanging code for tokens with Google...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri || `${Deno.env.get('FRONTEND_URL') || 'http://localhost:5173'}/google-callback`,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Google token response status:', tokenResponse.status);

    if (tokenData.error) {
      console.error('Google OAuth error:', tokenData.error, tokenData.error_description);
      return new Response(
        JSON.stringify({
          error: tokenData.error_description || tokenData.error,
          details: tokenData.error,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { access_token, refresh_token, expires_in, scope } = tokenData;

    // Calculate token expiration time
    const expiresAt = new Date(Date.now() + (expires_in * 1000));

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userData.email) {
      return new Response(
        JSON.stringify({ error: 'Failed to get Google user info' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse granted scopes
    const grantedScopes = scope ? scope.split(' ') : [];

    // Check which services are authorized
    const hasAnalytics = grantedScopes.some(s =>
      s.includes('analytics.readonly') || s.includes('analytics.edit')
    );
    const hasSearchConsole = grantedScopes.some(s =>
      s.includes('webmasters') || s.includes('webmasters.readonly')
    );

    // If userId provided, save to profile
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          google_access_token: access_token,
          google_refresh_token: refresh_token,
          google_token_expires_at: expiresAt.toISOString(),
          google_email: userData.email,
          google_scopes: grantedScopes,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error saving Google tokens:', updateError);
        // Don't fail - still return the token info
      } else {
        console.log('Successfully saved Google tokens for user:', userId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        scopes: grantedScopes,
        hasAnalytics,
        hasSearchConsole,
        expiresAt: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Google OAuth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
