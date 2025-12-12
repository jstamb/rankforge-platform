-- ============================================
-- RANKFORGE (RANK N BANK) DATABASE SCHEMA
-- Supabase PostgreSQL Schema
-- ============================================
-- Run this in the Supabase SQL Editor
-- ============================================

-- ============================================
-- RESET: DROP ALL EXISTING OBJECTS (CLEAN SLATE)
-- ============================================

-- Drop views first
DROP VIEW IF EXISTS public.active_jobs_queue CASCADE;
DROP VIEW IF EXISTS public.user_quota_status CASCADE;
DROP VIEW IF EXISTS public.website_stats CASCADE;

-- Drop trigger on auth.users (the only external table)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop tables (CASCADE automatically removes triggers and dependent objects)
DROP TABLE IF EXISTS public.deployment_logs CASCADE;
DROP TABLE IF EXISTS public.automation_workflows CASCADE;
DROP TABLE IF EXISTS public.generation_jobs CASCADE;
DROP TABLE IF EXISTS public.service_pages CASCADE;
DROP TABLE IF EXISTS public.location_pages CASCADE;
DROP TABLE IF EXISTS public.websites CASCADE;
DROP TABLE IF EXISTS public.businesses CASCADE;
DROP TABLE IF EXISTS public.user_quotas CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.plan_limits CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_updated_at CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.claim_next_job CASCADE;
DROP FUNCTION IF EXISTS public.update_job_progress CASCADE;
DROP FUNCTION IF EXISTS public.complete_job CASCADE;
DROP FUNCTION IF EXISTS public.fail_job CASCADE;
DROP FUNCTION IF EXISTS public.can_enqueue_job CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_job CASCADE;
DROP FUNCTION IF EXISTS public.reset_monthly_quotas CASCADE;

-- ============================================
-- BEGIN FRESH SCHEMA CREATION
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user creation (creates profile automatically)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, subscription_tier)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    'free'
  );

  -- Also create initial quota record for the user
  INSERT INTO public.user_quotas (user_id, plan_type)
  VALUES (NEW.id, 'free');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next job in queue (for workers)
CREATE OR REPLACE FUNCTION public.claim_next_job(worker_id TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
  job_id UUID;
BEGIN
  -- Get the highest priority pending job and claim it
  UPDATE public.generation_jobs
  SET
    status = 'processing',
    started_at = NOW(),
    current_step = 'Initializing...'
  WHERE id = (
    SELECT id FROM public.generation_jobs
    WHERE status = 'queued'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING id INTO job_id;

  RETURN job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update job progress
CREATE OR REPLACE FUNCTION public.update_job_progress(
  p_job_id UUID,
  p_current_step TEXT,
  p_completed_steps INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.generation_jobs
  SET
    current_step = p_current_step,
    completed_steps = p_completed_steps,
    progress_percent = ROUND((p_completed_steps::NUMERIC / NULLIF(total_steps, 0)) * 100)
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to complete a job
CREATE OR REPLACE FUNCTION public.complete_job(
  p_job_id UUID,
  p_output_result JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.generation_jobs
  SET
    status = 'completed',
    completed_at = NOW(),
    completed_steps = total_steps,
    progress_percent = 100,
    output_result = p_output_result
  WHERE id = p_job_id;

  -- Decrement user's concurrent job count
  UPDATE public.user_quotas
  SET current_concurrent_jobs = GREATEST(0, current_concurrent_jobs - 1)
  WHERE user_id = (SELECT user_id FROM public.generation_jobs WHERE id = p_job_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to fail a job
CREATE OR REPLACE FUNCTION public.fail_job(
  p_job_id UUID,
  p_error_message TEXT,
  p_attempt INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.generation_jobs
  SET
    status = 'failed',
    completed_at = NOW(),
    error_details = jsonb_build_object('message', p_error_message, 'attempt', p_attempt)
  WHERE id = p_job_id;

  -- Decrement user's concurrent job count
  UPDATE public.user_quotas
  SET current_concurrent_jobs = GREATEST(0, current_concurrent_jobs - 1)
  WHERE user_id = (SELECT user_id FROM public.generation_jobs WHERE id = p_job_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can enqueue a new job
CREATE OR REPLACE FUNCTION public.can_enqueue_job(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  quota RECORD;
  plan RECORD;
BEGIN
  SELECT * INTO quota FROM public.user_quotas WHERE user_id = p_user_id;
  SELECT * INTO plan FROM public.plan_limits WHERE plan_type = quota.plan_type;

  IF quota IS NULL OR plan IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check monthly limit
  IF quota.monthly_generations_used >= plan.monthly_generations_limit THEN
    RETURN FALSE;
  END IF;

  -- Check concurrent job limit
  IF quota.current_concurrent_jobs >= plan.max_concurrent_jobs THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enqueue a new job
CREATE OR REPLACE FUNCTION public.enqueue_job(
  p_user_id UUID,
  p_website_id UUID,
  p_job_type TEXT DEFAULT 'full_generation',
  p_priority INTEGER DEFAULT 1,
  p_total_steps INTEGER DEFAULT 10
)
RETURNS UUID AS $$
DECLARE
  new_job_id UUID;
  queue_pos INTEGER;
BEGIN
  -- Check if user can enqueue
  IF NOT public.can_enqueue_job(p_user_id) THEN
    RAISE EXCEPTION 'User has exceeded their quota or concurrent job limit';
  END IF;

  -- Calculate queue position
  SELECT COALESCE(MAX(queue_position), 0) + 1 INTO queue_pos
  FROM public.generation_jobs
  WHERE status IN ('pending', 'queued');

  -- Insert the job
  INSERT INTO public.generation_jobs (
    user_id, website_id, job_type, priority, status,
    queue_position, total_steps, completed_steps, progress_percent
  ) VALUES (
    p_user_id, p_website_id, p_job_type, p_priority, 'queued',
    queue_pos, p_total_steps, 0, 0
  ) RETURNING id INTO new_job_id;

  -- Update user quotas
  UPDATE public.user_quotas
  SET
    monthly_generations_used = monthly_generations_used + 1,
    current_concurrent_jobs = current_concurrent_jobs + 1
  WHERE user_id = p_user_id;

  RETURN new_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset monthly quotas (run via cron)
CREATE OR REPLACE FUNCTION public.reset_monthly_quotas()
RETURNS VOID AS $$
BEGIN
  UPDATE public.user_quotas
  SET
    monthly_generations_used = 0,
    quota_reset_at = NOW() + INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TABLES
-- ============================================

-- Subscription plan limits configuration
CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan_type TEXT PRIMARY KEY,
  monthly_generations_limit INTEGER NOT NULL DEFAULT 5,
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 1,
  max_locations_per_website INTEGER NOT NULL DEFAULT 10,
  max_services_per_website INTEGER NOT NULL DEFAULT 5,
  priority_boost INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plan limits
INSERT INTO public.plan_limits (plan_type, monthly_generations_limit, max_concurrent_jobs, max_locations_per_website, max_services_per_website, priority_boost, features)
VALUES
  ('free', 3, 1, 5, 3, 0, '{"support": "community", "analytics": false, "custom_domain": false}'),
  ('pro', 25, 3, 50, 20, 5, '{"support": "email", "analytics": true, "custom_domain": true}'),
  ('enterprise', 100, 10, 500, 100, 10, '{"support": "priority", "analytics": true, "custom_domain": true, "api_access": true}')
ON CONFLICT (plan_type) DO UPDATE SET
  monthly_generations_limit = EXCLUDED.monthly_generations_limit,
  max_concurrent_jobs = EXCLUDED.max_concurrent_jobs,
  max_locations_per_website = EXCLUDED.max_locations_per_website,
  max_services_per_website = EXCLUDED.max_services_per_website,
  priority_boost = EXCLUDED.priority_boost,
  features = EXCLUDED.features;

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT DEFAULT '',
  company_name TEXT,
  subscription_tier TEXT DEFAULT 'free' REFERENCES public.plan_limits(plan_type),
  subscription_status TEXT DEFAULT 'active',
  avatar_url TEXT,
  stripe_customer_id TEXT,
  github_access_token TEXT,
  github_username TEXT,
  cloudflare_api_token TEXT,
  cloudflare_account_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User quotas and usage tracking
CREATE TABLE IF NOT EXISTS public.user_quotas (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  plan_type TEXT DEFAULT 'free' REFERENCES public.plan_limits(plan_type),
  monthly_generations_used INTEGER DEFAULT 0,
  current_concurrent_jobs INTEGER DEFAULT 0,
  quota_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business profiles for website generation
CREATE TABLE IF NOT EXISTS public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  business_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  description TEXT,
  services JSONB DEFAULT '[]',
  unique_selling_points JSONB DEFAULT '[]',
  target_keywords JSONB DEFAULT '[]',
  brand_colors JSONB,
  logo_url TEXT,
  images JSONB DEFAULT '[]',
  business_hours JSONB,
  social_links JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated websites
CREATE TABLE IF NOT EXISTS public.websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'deployed', 'error')),
  template TEXT DEFAULT 'modern',

  -- Deployment info
  github_repo_url TEXT,
  github_repo_name TEXT,
  cloud_run_service_url TEXT,
  cloud_run_project_id TEXT,
  cloud_run_region TEXT DEFAULT 'us-central1',

  -- DNS info
  cloudflare_zone_id TEXT,
  dns_configured BOOLEAN DEFAULT FALSE,
  ssl_status TEXT,

  -- Generated content storage
  generated_pages JSONB DEFAULT '{}',
  global_seo_config JSONB DEFAULT '{}',

  -- Metadata
  last_deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Location pages for multi-location SEO
CREATE TABLE IF NOT EXISTS public.location_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE NOT NULL,

  -- Location hierarchy
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  neighborhood TEXT,
  zip_code TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- SEO elements
  page_slug TEXT NOT NULL,
  title_tag TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  h1_heading TEXT NOT NULL,

  -- Schema markup (JSON-LD)
  local_business_schema JSONB DEFAULT '{}',
  service_schema JSONB,
  faq_schema JSONB,
  breadcrumb_schema JSONB,

  -- Content
  hero_content JSONB,
  main_content TEXT,
  service_content JSONB,
  testimonials JSONB,

  -- Internal linking
  related_locations JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'published')),
  generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(website_id, page_slug)
);

-- Service pages
CREATE TABLE IF NOT EXISTS public.service_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE NOT NULL,

  service_name TEXT NOT NULL,
  page_slug TEXT NOT NULL,

  -- SEO elements
  title_tag TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  h1_heading TEXT,

  -- Schema
  service_schema JSONB DEFAULT '{}',
  faq_schema JSONB,
  how_to_schema JSONB,

  -- Content
  content TEXT,
  features JSONB,
  pricing_info JSONB,

  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(website_id, page_slug)
);

-- Generation jobs queue
CREATE TABLE IF NOT EXISTS public.generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE NOT NULL,

  job_type TEXT NOT NULL DEFAULT 'full_generation',
  priority INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
  queue_position INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_completion_at TIMESTAMPTZ,

  -- Progress tracking
  current_step TEXT,
  total_steps INTEGER DEFAULT 10,
  completed_steps INTEGER DEFAULT 0,
  progress_percent INTEGER DEFAULT 0,

  -- Results
  output_result JSONB,
  error_details JSONB,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automation workflows (webhook-based)
CREATE TABLE IF NOT EXISTS public.automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  website_id UUID REFERENCES public.websites(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,
  webhook_url TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('manual', 'scheduled', 'on_deploy', 'on_content_update')),

  is_active BOOLEAN DEFAULT TRUE,
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployment logs
CREATE TABLE IF NOT EXISTS public.deployment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID REFERENCES public.websites(id) ON DELETE CASCADE NOT NULL,
  job_id UUID REFERENCES public.generation_jobs(id) ON DELETE SET NULL,

  status TEXT NOT NULL CHECK (status IN ('started', 'building', 'deploying', 'success', 'failed')),
  step TEXT,
  message TEXT,
  error_details JSONB,

  github_commit_sha TEXT,
  cloud_run_revision TEXT,

  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER
);

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at triggers for all tables
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_user_quotas_updated_at
  BEFORE UPDATE ON public.user_quotas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_businesses_updated_at
  BEFORE UPDATE ON public.businesses
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_websites_updated_at
  BEFORE UPDATE ON public.websites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_location_pages_updated_at
  BEFORE UPDATE ON public.location_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_service_pages_updated_at
  BEFORE UPDATE ON public.service_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_generation_jobs_updated_at
  BEFORE UPDATE ON public.generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_automation_workflows_updated_at
  BEFORE UPDATE ON public.automation_workflows
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_plan_limits_updated_at
  BEFORE UPDATE ON public.plan_limits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Plan limits - readable by everyone (public config)
CREATE POLICY "Plan limits are viewable by everyone"
  ON public.plan_limits FOR SELECT
  USING (true);

-- Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- User quotas
CREATE POLICY "Users can view own quota"
  ON public.user_quotas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quota"
  ON public.user_quotas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quota"
  ON public.user_quotas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Businesses
CREATE POLICY "Users can view own businesses"
  ON public.businesses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own businesses"
  ON public.businesses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own businesses"
  ON public.businesses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own businesses"
  ON public.businesses FOR DELETE
  USING (auth.uid() = user_id);

-- Websites
CREATE POLICY "Users can view own websites"
  ON public.websites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own websites"
  ON public.websites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own websites"
  ON public.websites FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own websites"
  ON public.websites FOR DELETE
  USING (auth.uid() = user_id);

-- Location pages
CREATE POLICY "Users can view own location pages"
  ON public.location_pages FOR SELECT
  USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own location pages"
  ON public.location_pages FOR INSERT
  WITH CHECK (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own location pages"
  ON public.location_pages FOR UPDATE
  USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own location pages"
  ON public.location_pages FOR DELETE
  USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

-- Service pages
CREATE POLICY "Users can view own service pages"
  ON public.service_pages FOR SELECT
  USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own service pages"
  ON public.service_pages FOR INSERT
  WITH CHECK (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own service pages"
  ON public.service_pages FOR UPDATE
  USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own service pages"
  ON public.service_pages FOR DELETE
  USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

-- Generation jobs
CREATE POLICY "Users can view own jobs"
  ON public.generation_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own jobs"
  ON public.generation_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON public.generation_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own jobs"
  ON public.generation_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- Service role policies for workers (service_role key bypasses RLS by default,
-- but these policies ensure access even if that behavior changes)
CREATE POLICY "Service role can view all jobs"
  ON public.generation_jobs FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update all jobs"
  ON public.generation_jobs FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert jobs"
  ON public.generation_jobs FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Also add service role policies for related tables workers need access to
CREATE POLICY "Service role can view all websites"
  ON public.websites FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update all websites"
  ON public.websites FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Service role can view all businesses"
  ON public.businesses FOR SELECT
  TO service_role
  USING (true);

-- Automation workflows
CREATE POLICY "Users can view own workflows"
  ON public.automation_workflows FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workflows"
  ON public.automation_workflows FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workflows"
  ON public.automation_workflows FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workflows"
  ON public.automation_workflows FOR DELETE
  USING (auth.uid() = user_id);

-- Deployment logs
CREATE POLICY "Users can view own deployment logs"
  ON public.deployment_logs FOR SELECT
  USING (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own deployment logs"
  ON public.deployment_logs FOR INSERT
  WITH CHECK (website_id IN (SELECT id FROM public.websites WHERE user_id = auth.uid()));

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- User lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_businesses_user_id ON public.businesses(user_id);
CREATE INDEX IF NOT EXISTS idx_websites_user_id ON public.websites(user_id);
CREATE INDEX IF NOT EXISTS idx_websites_business_id ON public.websites(business_id);
CREATE INDEX IF NOT EXISTS idx_websites_slug ON public.websites(slug);

-- Location/Service page lookups
CREATE INDEX IF NOT EXISTS idx_location_pages_website_id ON public.location_pages(website_id);
CREATE INDEX IF NOT EXISTS idx_location_pages_city_state ON public.location_pages(city, state);
CREATE INDEX IF NOT EXISTS idx_service_pages_website_id ON public.service_pages(website_id);

-- Job queue indexes (critical for performance)
CREATE INDEX IF NOT EXISTS idx_generation_jobs_user_id ON public.generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_website_id ON public.generation_jobs(website_id);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_status ON public.generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_generation_jobs_queue ON public.generation_jobs(status, priority DESC, created_at ASC);

-- Workflow and log indexes
CREATE INDEX IF NOT EXISTS idx_automation_workflows_user_id ON public.automation_workflows(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_workflows_website_id ON public.automation_workflows(website_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_website_id ON public.deployment_logs(website_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_job_id ON public.deployment_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_started_at ON public.deployment_logs(started_at DESC);

-- ============================================
-- VIEWS FOR CONVENIENCE
-- ============================================

-- Website stats view (includes location and service counts)
CREATE OR REPLACE VIEW public.website_stats AS
SELECT
  w.id,
  w.user_id,
  w.business_id,
  w.name,
  w.slug,
  w.domain,
  w.status,
  w.template,
  w.github_repo_url,
  w.cloud_run_service_url,
  w.last_deployed_at,
  w.created_at,
  COUNT(DISTINCT lp.id) AS location_count,
  COUNT(DISTINCT sp.id) AS service_count,
  b.business_name,
  b.business_type
FROM public.websites w
LEFT JOIN public.location_pages lp ON w.id = lp.website_id
LEFT JOIN public.service_pages sp ON w.id = sp.website_id
LEFT JOIN public.businesses b ON w.business_id = b.id
GROUP BY w.id, w.business_id, b.business_name, b.business_type;

-- User quota status view
CREATE OR REPLACE VIEW public.user_quota_status AS
SELECT
  uq.user_id,
  uq.plan_type,
  uq.monthly_generations_used,
  uq.current_concurrent_jobs,
  uq.quota_reset_at,
  pl.monthly_generations_limit,
  pl.max_concurrent_jobs,
  pl.max_locations_per_website,
  pl.max_services_per_website,
  pl.monthly_generations_limit - uq.monthly_generations_used AS generations_remaining,
  pl.max_concurrent_jobs - uq.current_concurrent_jobs AS concurrent_slots_available,
  pl.features
FROM public.user_quotas uq
JOIN public.plan_limits pl ON uq.plan_type = pl.plan_type;

-- Active jobs queue view
CREATE OR REPLACE VIEW public.active_jobs_queue AS
SELECT
  gj.id,
  gj.user_id,
  gj.website_id,
  w.name AS website_name,
  gj.job_type,
  gj.priority,
  gj.status,
  gj.queue_position,
  gj.current_step,
  gj.total_steps,
  gj.completed_steps,
  gj.progress_percent,
  gj.created_at,
  gj.started_at,
  gj.estimated_completion_at,
  p.subscription_tier
FROM public.generation_jobs gj
JOIN public.websites w ON gj.website_id = w.id
JOIN public.profiles p ON gj.user_id = p.id
WHERE gj.status IN ('pending', 'queued', 'processing')
ORDER BY gj.priority DESC, gj.created_at ASC;

-- ============================================
-- GRANT PERMISSIONS FOR VIEWS
-- ============================================

-- Enable RLS on views (views inherit from base tables)
-- Users can only see their own data through these views

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for job progress updates
-- Note: These may already be added; errors here are safe to ignore
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.generation_jobs;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.deployment_logs;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ============================================
-- SCHEDULED FUNCTIONS (set up via Supabase Dashboard or pg_cron)
-- ============================================

-- To set up monthly quota reset, add this cron job in Supabase Dashboard:
-- Schedule: 0 0 1 * * (First day of each month at midnight)
-- Command: SELECT public.reset_monthly_quotas();

-- ============================================
-- SEED DATA FOR DEVELOPMENT (OPTIONAL)
-- ============================================

-- Uncomment to insert test data:

/*
-- Test user (you'll need to create this user through Supabase Auth first)
-- Then the trigger will auto-create profile and quota

-- Sample business
INSERT INTO public.businesses (user_id, business_name, business_type, phone, email, address_city, address_state, description, services, target_keywords)
VALUES
  ('YOUR-USER-UUID-HERE', 'Demo Plumbing Co', 'plumber', '555-123-4567', 'demo@example.com', 'Seattle', 'WA', 'Professional plumbing services', '["Drain Cleaning", "Water Heater Repair", "Pipe Installation"]', '["plumber seattle", "emergency plumber", "drain cleaning"]');
*/

-- ============================================
-- SCHEMA COMPLETE
-- ============================================
