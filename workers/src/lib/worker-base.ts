import {
  claimNextJob,
  updateJobProgress,
  completeJob,
  failJob,
  updateWebsiteStatus,
} from './supabase.js';
import type { GenerationJob, JobType } from './types.js';

export interface WorkerConfig {
  name: string;
  jobTypes: JobType[];
  pollInterval: number;
  maxConcurrent: number;
}

export abstract class BaseWorker {
  protected config: WorkerConfig;
  protected activeJobs: Map<string, GenerationJob> = new Map();
  protected isRunning: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(config: WorkerConfig) {
    this.config = config;
  }

  /**
   * Start the worker
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`[${this.config.name}] Starting worker...`);
    this.poll();
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log(`[${this.config.name}] Stopped worker`);
  }

  /**
   * Poll for new jobs
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Check if we can take more jobs
      if (this.activeJobs.size >= this.config.maxConcurrent) {
        this.schedulePoll();
        return;
      }

      // Try to claim a job
      const job = await claimNextJob(this.config.jobTypes);

      if (job) {
        console.log(`[${this.config.name}] Claimed job ${job.id}`);
        this.activeJobs.set(job.id, job);
        this.processJob(job);
      }
    } catch (error) {
      console.error(`[${this.config.name}] Poll error:`, error);
    }

    this.schedulePoll();
  }

  private schedulePoll(): void {
    if (this.isRunning) {
      this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
    }
  }

  /**
   * Process a job
   */
  private async processJob(job: GenerationJob): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`[${this.config.name}] Processing job ${job.id} (${job.job_type})`);

      // Update website status to generating
      await updateWebsiteStatus(job.website_id, 'generating');

      // Run the worker-specific processing
      const result = await this.process(job);

      // Complete the job
      await completeJob(job.id, result);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[${this.config.name}] Completed job ${job.id} in ${duration}s`);
    } catch (error) {
      console.error(`[${this.config.name}] Job ${job.id} failed:`, error);

      // Fail the job
      await failJob(
        job.id,
        error instanceof Error ? error : new Error(String(error)),
        this.getCurrentStep()
      );

      // Update website status to error
      await updateWebsiteStatus(job.website_id, 'error');
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Update progress helper
   */
  protected async progress(
    jobId: string,
    step: string,
    completed: number,
    total: number
  ): Promise<void> {
    console.log(`[${this.config.name}] ${step} (${completed}/${total})`);
    await updateJobProgress(jobId, step, completed, total);
  }

  /**
   * Abstract method - implement job processing logic
   */
  protected abstract process(job: GenerationJob): Promise<Record<string, unknown>>;

  /**
   * Get current step for error reporting
   */
  protected abstract getCurrentStep(): string;
}
