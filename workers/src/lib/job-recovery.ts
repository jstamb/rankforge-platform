import { supabase } from './supabase.js';

interface RecoveryStats {
  staleJobsReset: number;
  failedJobsRetried: number;
  deadLetterJobs: number;
}

const MAX_RETRY_COUNT = 3;
const STALE_TIMEOUT_MINUTES = 5;
const RECOVERY_INTERVAL_MS = 60 * 1000; // Run every minute

/**
 * JobRecoveryService - Automatic self-healing for stuck/failed jobs
 *
 * Features:
 * - Resets jobs stuck in 'processing' for too long
 * - Retries failed jobs (up to MAX_RETRY_COUNT times)
 * - Moves repeatedly failing jobs to dead letter queue
 * - Runs on startup and periodically
 */
export class JobRecoveryService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the recovery service
   */
  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log('[JobRecovery] Starting job recovery service...');

    // Run immediately on startup
    await this.runRecovery();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.runRecovery().catch(err => {
        console.error('[JobRecovery] Recovery cycle error:', err);
      });
    }, RECOVERY_INTERVAL_MS);

    console.log(`[JobRecovery] Service started - checking every ${RECOVERY_INTERVAL_MS / 1000}s`);
  }

  /**
   * Stop the recovery service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[JobRecovery] Service stopped');
  }

  /**
   * Run a full recovery cycle
   */
  async runRecovery(): Promise<RecoveryStats> {
    const stats: RecoveryStats = {
      staleJobsReset: 0,
      failedJobsRetried: 0,
      deadLetterJobs: 0,
    };

    try {
      // 1. Reset stale processing jobs
      stats.staleJobsReset = await this.resetStaleJobs();

      // 2. Retry failed jobs (with retry count check)
      const retryResult = await this.retryFailedJobs();
      stats.failedJobsRetried = retryResult.retried;
      stats.deadLetterJobs = retryResult.deadLetter;

      // Log only if something was recovered
      if (stats.staleJobsReset > 0 || stats.failedJobsRetried > 0 || stats.deadLetterJobs > 0) {
        console.log(`[JobRecovery] Cycle complete: ${stats.staleJobsReset} stale reset, ${stats.failedJobsRetried} retried, ${stats.deadLetterJobs} dead-lettered`);
      }
    } catch (error) {
      console.error('[JobRecovery] Recovery error:', error);
    }

    return stats;
  }

  /**
   * Reset jobs stuck in 'processing' for too long
   */
  private async resetStaleJobs(): Promise<number> {
    const cutoffTime = new Date(Date.now() - STALE_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    // Get stale jobs first (for logging)
    const { data: staleJobs } = await supabase
      .from('generation_jobs')
      .select('id, job_type, retry_count')
      .eq('status', 'processing')
      .lt('started_at', cutoffTime);

    if (!staleJobs || staleJobs.length === 0) {
      return 0;
    }

    // Reset them with incremented retry count
    for (const job of staleJobs) {
      const newRetryCount = (job.retry_count || 0) + 1;

      if (newRetryCount > MAX_RETRY_COUNT) {
        // Move to dead letter (failed permanently)
        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            current_step: 'Max retries exceeded',
            error_details: {
              message: `Job exceeded max retry count (${MAX_RETRY_COUNT})`,
              retry_count: newRetryCount,
              last_failure: 'Stuck in processing state',
            },
          })
          .eq('id', job.id);
        console.log(`[JobRecovery] Dead-lettered job ${job.id} (exceeded ${MAX_RETRY_COUNT} retries)`);
      } else {
        // Reset to pending for retry
        await supabase
          .from('generation_jobs')
          .update({
            status: 'pending',
            started_at: null,
            current_step: `Retry ${newRetryCount}/${MAX_RETRY_COUNT}`,
            retry_count: newRetryCount,
          })
          .eq('id', job.id);
        console.log(`[JobRecovery] Reset stale job ${job.id} (${job.job_type}) - retry ${newRetryCount}/${MAX_RETRY_COUNT}`);
      }
    }

    return staleJobs.length;
  }

  /**
   * Retry failed jobs that haven't exceeded max retries
   */
  private async retryFailedJobs(): Promise<{ retried: number; deadLetter: number }> {
    // Only retry jobs that failed within the last hour and haven't exceeded retries
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: failedJobs } = await supabase
      .from('generation_jobs')
      .select('id, job_type, retry_count, error_details')
      .eq('status', 'failed')
      .gt('completed_at', oneHourAgo)
      .or(`retry_count.is.null,retry_count.lt.${MAX_RETRY_COUNT}`);

    if (!failedJobs || failedJobs.length === 0) {
      return { retried: 0, deadLetter: 0 };
    }

    let retried = 0;
    let deadLetter = 0;

    for (const job of failedJobs) {
      const newRetryCount = (job.retry_count || 0) + 1;

      // Check if it's a permanent failure (shouldn't retry)
      const errorMessage = job.error_details?.message?.toLowerCase() || '';
      const isPermanentFailure =
        errorMessage.includes('not found') ||
        errorMessage.includes('access denied') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('max retries exceeded');

      if (isPermanentFailure) {
        continue; // Skip permanent failures
      }

      if (newRetryCount > MAX_RETRY_COUNT) {
        deadLetter++;
        // Already at max retries, update error message
        await supabase
          .from('generation_jobs')
          .update({
            error_details: {
              ...job.error_details,
              message: `${job.error_details?.message} (max retries exceeded)`,
            },
          })
          .eq('id', job.id);
      } else {
        retried++;
        // Reset to pending for retry
        await supabase
          .from('generation_jobs')
          .update({
            status: 'pending',
            started_at: null,
            completed_at: null,
            current_step: `Retry ${newRetryCount}/${MAX_RETRY_COUNT}`,
            retry_count: newRetryCount,
            error_details: null,
          })
          .eq('id', job.id);
        console.log(`[JobRecovery] Queued retry for failed job ${job.id} (${job.job_type}) - attempt ${newRetryCount}/${MAX_RETRY_COUNT}`);
      }
    }

    return { retried, deadLetter };
  }

  /**
   * Get recovery stats for health endpoint
   */
  async getHealthStats(): Promise<{
    pendingJobs: number;
    processingJobs: number;
    failedJobsLastHour: number;
    staleJobs: number;
  }> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const staleTimeout = new Date(Date.now() - STALE_TIMEOUT_MINUTES * 60 * 1000).toISOString();

    const [pending, processing, failed, stale] = await Promise.all([
      supabase.from('generation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('generation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('generation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed').gt('completed_at', oneHourAgo),
      supabase.from('generation_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing').lt('started_at', staleTimeout),
    ]);

    return {
      pendingJobs: pending.count || 0,
      processingJobs: processing.count || 0,
      failedJobsLastHour: failed.count || 0,
      staleJobs: stale.count || 0,
    };
  }
}

// Export singleton instance
export const jobRecoveryService = new JobRecoveryService();
