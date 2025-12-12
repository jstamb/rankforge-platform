import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Google OAuth Token Refresh
 *
 * Refreshes an expired Google access token using the stored refresh token.
 * Called automatically when the access token is about to expire.
 *
 * Request body:
 * - userId: The user ID to refresh tokens for
 *
 * Returns:
 * - New access token and expiration time
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Google OAuth not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's refresh token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('google_refresh_token, google_token_expires_at')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile.google_refresh_token) {
      return new Response(
        JSON.stringify({ error: 'No Google refresh token found. User must re-authenticate.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is still valid (with 5 minute buffer)
    const expiresAt = new Date(profile.google_token_expires_at);
    const now = new Date();
    const bufferMs = 5 * 60 * 1000; // 5 minutes

    if (expiresAt.getTime() > now.getTime() + bufferMs) {
      // Token is still valid, no need to refresh
      return new Response(
        JSON.stringify({
          refreshed: false,
          message: 'Token is still valid',
          expiresAt: profile.google_token_expires_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh the token
    console.log('Refreshing Google token for user:', userId);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: profile.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Google token refresh error:', tokenData.error);

      // If refresh token is invalid, clear tokens and require re-auth
      if (tokenData.error === 'invalid_grant') {
        await supabase
          .from('profiles')
          .update({
            google_access_token: null,
            google_refresh_token: null,
            google_token_expires_at: null,
          })
          .eq('id', userId);
      }

      return new Response(
        JSON.stringify({
          error: tokenData.error_description || 'Failed to refresh token',
          requiresReauth: tokenData.error === 'invalid_grant',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    // Update profile with new token
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        google_access_token: tokenData.access_token,
        google_token_expires_at: newExpiresAt.toISOString(),
        // Note: refresh_token is not returned on refresh, keep existing
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
    }

    console.log('Successfully refreshed Google token for user:', userId);

    return new Response(
      JSON.stringify({
        refreshed: true,
        expiresAt: newExpiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Token refresh error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
