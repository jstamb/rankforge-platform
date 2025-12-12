-- Add target_cities column to businesses table for storing additional service areas
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS target_cities JSONB DEFAULT '[]'::jsonb;
