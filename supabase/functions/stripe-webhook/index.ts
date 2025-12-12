import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeKey) {
      throw new Error('Stripe not configured');
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return new Response(
          JSON.stringify({ error: 'Invalid signature' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // For development without webhook secret
      event = JSON.parse(body);
      console.warn('Webhook signature not verified - STRIPE_WEBHOOK_SECRET not set');
    }

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Processing Stripe event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const websiteId = session.metadata?.website_id;
        const userId = session.metadata?.user_id;

        if (!websiteId) {
          console.error('No website_id in session metadata');
          break;
        }

        console.log(`Payment completed for website ${websiteId}`);

        // Update website payment status
        const { error: updateError } = await supabase
          .from('websites')
          .update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent,
          })
          .eq('id', websiteId);

        if (updateError) {
          console.error('Error updating website payment status:', updateError);
          throw updateError;
        }

        // Automatically queue the generation job now that payment is complete
        const { data: website } = await supabase
          .from('websites')
          .select('*, businesses(*)')
          .eq('id', websiteId)
          .single();

        if (website && website.status === 'draft') {
          // Create generation job
          const { error: jobError } = await supabase
            .from('generation_jobs')
            .insert({
              website_id: websiteId,
              user_id: userId,
              job_type: 'seo_research',
              status: 'pending',
              priority: 1,
              input_data: {
                websiteId,
                businessId: website.business_id,
              },
            });

          if (jobError) {
            console.error('Error creating generation job:', jobError);
          } else {
            // Update website status to generating
            await supabase
              .from('websites')
              .update({ status: 'generating' })
              .eq('id', websiteId);

            console.log(`Generation job queued for website ${websiteId}`);
          }
        }

        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const websiteId = session.metadata?.website_id;

        if (websiteId) {
          // Reset payment status
          await supabase
            .from('websites')
            .update({
              payment_status: 'unpaid',
              stripe_checkout_session_id: null,
            })
            .eq('id', websiteId);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment failed:', paymentIntent.id);

        // Find website by payment intent and mark as failed
        const { data: websites } = await supabase
          .from('websites')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id);

        if (websites && websites.length > 0) {
          await supabase
            .from('websites')
            .update({ payment_status: 'failed' })
            .eq('id', websites[0].id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Webhook handler failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
