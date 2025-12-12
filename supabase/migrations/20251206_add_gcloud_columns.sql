-- Add Google Cloud columns to profiles table for user-hosted deployments
-- Run this migration in Supabase SQL Editor

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gcloud_project_id TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gcloud_service_account_key TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.gcloud_project_id IS 'Google Cloud project ID for user-hosted deployments';
COMMENT ON COLUMN public.profiles.gcloud_service_account_key IS 'JSON service account key for Google Cloud (encrypted at rest)';
