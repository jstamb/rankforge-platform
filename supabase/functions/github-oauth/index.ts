import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get GitHub OAuth credentials from environment
    const clientId = Deno.env.get('GITHUB_CLIENT_ID');
    const clientSecret = Deno.env.get('GITHUB_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.error('Missing GitHub credentials - clientId:', !!clientId, 'clientSecret:', !!clientSecret);
      return new Response(
        JSON.stringify({ error: 'GitHub OAuth not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Exchange code for access token
    const tokenRequestBody: Record<string, string> = {
      client_id: clientId,
      client_secret: clientSecret,
      code,
    };

    // Include redirect_uri if provided (required by GitHub for some OAuth flows)
    if (redirectUri) {
      tokenRequestBody.redirect_uri = redirectUri;
    }

    console.log('Exchanging code for token with GitHub...');
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tokenRequestBody),
    });

    const tokenData = await tokenResponse.json();
    console.log('GitHub token response:', JSON.stringify(tokenData));

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error, tokenData.error_description);
      return new Response(
        JSON.stringify({
          error: tokenData.error_description || tokenData.error,
          details: tokenData.error,
          error_uri: tokenData.error_uri
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = tokenData.access_token;

    // Get user info from GitHub
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    if (!userData.login) {
      return new Response(
        JSON.stringify({ error: 'Failed to get GitHub user info' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If userId provided, save to profile
    if (userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          github_access_token: accessToken,
          github_username: userData.login,
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Error saving GitHub token:', updateError);
        // Don't fail - still return the token
      }
    }

    return new Response(
      JSON.stringify({
        access_token: accessToken,
        username: userData.login,
        avatar_url: userData.avatar_url,
        name: userData.name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
