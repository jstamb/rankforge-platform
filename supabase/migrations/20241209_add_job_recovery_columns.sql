-- Add columns for job recovery tracking
-- retry_count: Number of times the job has been retried
-- heartbeat_at: Last heartbeat timestamp (for long-running job monitoring)

ALTER TABLE generation_jobs
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

-- Create index for efficient stale job queries
CREATE INDEX IF NOT EXISTS idx_generation_jobs_recovery
ON generation_jobs (status, started_at)
WHERE status = 'processing';

COMMENT ON COLUMN generation_jobs.retry_count IS 'Number of times this job has been automatically retried';
COMMENT ON COLUMN generation_jobs.heartbeat_at IS 'Last heartbeat timestamp for detecting stuck jobs';
