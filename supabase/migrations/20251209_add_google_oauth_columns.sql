-- Add Google OAuth columns to profiles table for Analytics & Search Console integration
-- Google tokens expire (unlike GitHub), so we need refresh_token and expiration tracking

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_email TEXT,
ADD COLUMN IF NOT EXISTS google_scopes TEXT[]; -- Track granted scopes

-- Add comment for documentation
COMMENT ON COLUMN profiles.google_access_token IS 'Google OAuth access token for Analytics/Search Console APIs';
COMMENT ON COLUMN profiles.google_refresh_token IS 'Google OAuth refresh token for automatic token renewal';
COMMENT ON COLUMN profiles.google_token_expires_at IS 'Timestamp when the access token expires';
COMMENT ON COLUMN profiles.google_email IS 'Google account email associated with the OAuth connection';
COMMENT ON COLUMN profiles.google_scopes IS 'Array of OAuth scopes granted by the user';

-- Create website_analytics table for linking GA4 properties to websites
CREATE TABLE IF NOT EXISTS website_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,

  -- GA4 Property
  ga4_property_id TEXT,
  ga4_property_name TEXT,
  ga4_measurement_id TEXT, -- G-XXXXXXXXXX
  ga4_data_stream_id TEXT,

  -- Search Console
  search_console_site_url TEXT, -- The verified site URL
  search_console_verified BOOLEAN DEFAULT FALSE,
  search_console_verification_method TEXT, -- 'dns', 'file', 'meta_tag', 'gtag'

  -- Status
  analytics_connected BOOLEAN DEFAULT FALSE,
  search_console_connected BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,

  UNIQUE(website_id)
);

-- Create analytics_cache table for storing fetched analytics data
CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,

  -- Cache type: 'ga4_traffic', 'search_console_performance', 'search_console_errors'
  cache_type TEXT NOT NULL,

  -- Date range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Cached data as JSONB
  data JSONB NOT NULL,

  -- Timestamps
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Index for lookups
  UNIQUE(website_id, cache_type, start_date, end_date)
);

-- Create website_errors table for Cloud Run error monitoring
CREATE TABLE IF NOT EXISTS website_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,

  -- Error details
  error_type TEXT NOT NULL, -- 'runtime', 'build', 'deployment', 'http_4xx', 'http_5xx'
  error_message TEXT NOT NULL,
  error_stack TEXT,

  -- Context
  source_file TEXT, -- File where error occurred (if known)
  source_line INTEGER,
  request_path TEXT, -- For HTTP errors
  request_method TEXT,
  status_code INTEGER,

  -- Cloud Run context
  cloud_run_revision TEXT,
  cloud_run_service TEXT,

  -- Resolution tracking
  status TEXT DEFAULT 'new', -- 'new', 'acknowledged', 'fixing', 'fixed', 'ignored'
  auto_fix_attempted BOOLEAN DEFAULT FALSE,
  auto_fix_job_id UUID REFERENCES generation_jobs(id),
  resolved_at TIMESTAMPTZ,

  -- Timestamps
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_website_analytics_website_id ON website_analytics(website_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_website_id ON analytics_cache(website_id);
CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires ON analytics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_website_errors_website_id ON website_errors(website_id);
CREATE INDEX IF NOT EXISTS idx_website_errors_status ON website_errors(status);
CREATE INDEX IF NOT EXISTS idx_website_errors_occurred_at ON website_errors(occurred_at DESC);

-- Enable RLS
ALTER TABLE website_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_errors ENABLE ROW LEVEL SECURITY;

-- RLS policies for website_analytics
CREATE POLICY "Users can view their own website analytics" ON website_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = website_analytics.website_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own website analytics" ON website_analytics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = website_analytics.website_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own website analytics" ON website_analytics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = website_analytics.website_id
      AND w.user_id = auth.uid()
    )
  );

-- RLS policies for analytics_cache
CREATE POLICY "Users can view their own analytics cache" ON analytics_cache
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = analytics_cache.website_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own analytics cache" ON analytics_cache
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = analytics_cache.website_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own analytics cache" ON analytics_cache
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = analytics_cache.website_id
      AND w.user_id = auth.uid()
    )
  );

-- RLS policies for website_errors
CREATE POLICY "Users can view their own website errors" ON website_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = website_errors.website_id
      AND w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own website errors" ON website_errors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM websites w
      WHERE w.id = website_errors.website_id
      AND w.user_id = auth.uid()
    )
  );

-- Service role can insert errors (from webhooks)
CREATE POLICY "Service role can insert website errors" ON website_errors
  FOR INSERT WITH CHECK (true);
