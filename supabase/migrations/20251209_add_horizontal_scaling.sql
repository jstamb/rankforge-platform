-- Migration: Add horizontal scaling support with atomic job claiming
-- Date: 2024-12-09

-- Add worker_id column to track which worker is processing a job
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS worker_id TEXT;

-- Add index for efficient job claiming
CREATE INDEX IF NOT EXISTS idx_generation_jobs_pending_claim
ON generation_jobs (status, priority, created_at)
WHERE status = 'pending';

-- Add index for worker tracking
CREATE INDEX IF NOT EXISTS idx_generation_jobs_worker
ON generation_jobs (worker_id, status)
WHERE status = 'processing';

-- Function to atomically claim the next available job
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions
CREATE OR REPLACE FUNCTION claim_next_job(
  p_job_types TEXT[],
  p_worker_id TEXT
)
RETURNS SETOF generation_jobs
LANGUAGE plpgsql
AS $$
DECLARE
  v_job generation_jobs;
BEGIN
  -- Atomically select and update a single job
  -- FOR UPDATE SKIP LOCKED ensures no two workers can claim the same job
  SELECT * INTO v_job
  FROM generation_jobs
  WHERE job_type = ANY(p_job_types)
    AND status = 'pending'
  ORDER BY priority ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  -- If no job found, return empty
  IF v_job.id IS NULL THEN
    RETURN;
  END IF;

  -- Update the job to processing status
  UPDATE generation_jobs
  SET
    status = 'processing',
    started_at = NOW(),
    current_step = 'Initializing...',
    worker_id = p_worker_id,
    heartbeat_at = NOW()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN NEXT v_job;
END;
$$;

-- Function to update worker heartbeat (for health monitoring)
CREATE OR REPLACE FUNCTION update_job_heartbeat(
  p_job_id UUID,
  p_worker_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE generation_jobs
  SET heartbeat_at = NOW()
  WHERE id = p_job_id
    AND worker_id = p_worker_id
    AND status = 'processing';

  RETURN FOUND;
END;
$$;

-- Function to get count of jobs currently being processed
CREATE OR REPLACE FUNCTION get_processing_job_count()
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT COUNT(*)::INTEGER
  FROM generation_jobs
  WHERE status = 'processing';
$$;

-- Function to get count of jobs being processed by a specific worker
CREATE OR REPLACE FUNCTION get_worker_job_count(p_worker_id TEXT)
RETURNS INTEGER
LANGUAGE sql
AS $$
  SELECT COUNT(*)::INTEGER
  FROM generation_jobs
  WHERE status = 'processing'
    AND worker_id = p_worker_id;
$$;

-- Grant execute permissions to authenticated and service role
GRANT EXECUTE ON FUNCTION claim_next_job(TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_next_job(TEXT[], TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION update_job_heartbeat(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_job_heartbeat(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_processing_job_count() TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_job_count() TO service_role;
GRANT EXECUTE ON FUNCTION get_worker_job_count(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_worker_job_count(TEXT) TO service_role;

-- Comment for documentation
COMMENT ON FUNCTION claim_next_job IS 'Atomically claims the next available job for processing. Uses FOR UPDATE SKIP LOCKED for horizontal scaling support.';
