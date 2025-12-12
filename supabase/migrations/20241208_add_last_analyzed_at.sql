-- Add last_analyzed_at column to websites table
-- Tracks when the GitHub repository was last analyzed for page structure

ALTER TABLE public.websites
ADD COLUMN IF NOT EXISTS last_analyzed_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN public.websites.last_analyzed_at IS 'Timestamp of last GitHub repository analysis';
