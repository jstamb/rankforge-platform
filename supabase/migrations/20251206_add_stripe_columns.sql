-- Add Stripe payment columns to websites table
-- Run this migration in Supabase SQL Editor

-- Payment status for websites
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Add Stripe customer ID to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add index for payment status queries
CREATE INDEX IF NOT EXISTS idx_websites_payment_status ON public.websites(payment_status);

-- Add comments
COMMENT ON COLUMN public.websites.payment_status IS 'Payment status: unpaid, pending, paid, failed';
COMMENT ON COLUMN public.websites.paid_at IS 'Timestamp when payment was completed';
COMMENT ON COLUMN public.websites.stripe_checkout_session_id IS 'Stripe checkout session ID for pending payments';
COMMENT ON COLUMN public.websites.stripe_payment_intent_id IS 'Stripe payment intent ID for completed payments';
COMMENT ON COLUMN public.profiles.stripe_customer_id IS 'Stripe customer ID for recurring payments';
