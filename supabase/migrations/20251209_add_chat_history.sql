-- Add chat_history column to websites table for AI chat persistence
-- Stores the last 10 messages as JSONB array

ALTER TABLE public.websites
ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.websites.chat_history IS 'Stores last 10 AI chat messages as JSONB array [{role, content, timestamp}]';
