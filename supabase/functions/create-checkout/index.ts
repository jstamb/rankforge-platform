import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEBSITE_PRICE = 9700; // $97.00 in cents

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET');
    if (!stripeKey) {
      throw new Error('Stripe not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { websiteId, userId, websiteName, returnUrl } = await req.json();

    if (!websiteId || !userId) {
      return new Response(
        JSON.stringify({ error: 'websiteId and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if website exists and belongs to user
    const { data: website, error: websiteError } = await supabase
      .from('websites')
      .select('id, name, payment_status, user_id')
      .eq('id', websiteId)
      .single();

    if (websiteError || !website) {
      return new Response(
        JSON.stringify({ error: 'Website not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (website.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already paid
    if (website.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'Website already paid for', alreadyPaid: true }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', userId)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Get user email from auth
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      const email = authUser?.user?.email || profile?.email;

      const customer = await stripe.customers.create({
        email,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Website Generation: ${websiteName || website.name || 'New Website'}`,
              description: 'One-time payment for AI-powered website generation with unlimited future changes',
            },
            unit_amount: WEBSITE_PRICE,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${returnUrl || 'https://app.rankforge.io'}/websites/${websiteId}/settings?payment=success`,
      cancel_url: `${returnUrl || 'https://app.rankforge.io'}/websites/${websiteId}/settings?payment=cancelled`,
      metadata: {
        website_id: websiteId,
        user_id: userId,
      },
    });

    // Update website with pending payment
    await supabase
      .from('websites')
      .update({
        payment_status: 'pending',
        stripe_checkout_session_id: session.id,
      })
      .eq('id', websiteId);

    return new Response(
      JSON.stringify({
        checkoutUrl: session.url,
        sessionId: session.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create checkout session' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
