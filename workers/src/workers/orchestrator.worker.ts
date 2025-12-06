import { BaseWorker } from '../lib/worker-base.js';
import { supabase } from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';

/**
 * Orchestrator Worker
 *
 * Handles `full_generation` jobs by creating and monitoring
 * the chain of sub-jobs that make up a complete website generation.
 *
 * Job chain:
 * 1. seo_research
 * 2. content_architecture
 * 3. design_generation
 * 4. content_generation
 * 5. site_build
 * 6. deployment
 */
export class OrchestratorWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'Orchestrator',
      jobTypes: ['full_generation'],
      pollInterval: 3000,
      maxConcurrent: 5,
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const jobChain = [
      { type: 'seo_research', name: 'SEO Research' },
      { type: 'content_architecture', name: 'Content Architecture' },
      { type: 'design_generation', name: 'Design Generation' },
      { type: 'content_generation', name: 'Content Generation' },
      { type: 'site_build', name: 'Site Builder' },
      { type: 'deployment', name: 'Deployment' },
    ];

    const totalSteps = jobChain.length;
    let completedSteps = 0;
    const results: Record<string, unknown> = {};

    for (const step of jobChain) {
      this.currentStep = `Starting ${step.name}`;
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      // Create sub-job
      const { data: subJob, error: createError } = await supabase
        .from('generation_jobs')
        .insert({
          user_id: job.user_id,
          website_id: job.website_id,
          job_type: step.type,
          priority: job.priority,
          status: 'pending',
          input_payload: {
            ...job.input_payload,
            parent_job_id: job.id,
            previous_results: results,
          },
          total_steps: 5,
          completed_steps: 0,
          progress_percent: 0,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create ${step.type} job: ${createError.message}`);
      }

      // Wait for sub-job to complete
      this.currentStep = `Running ${step.name}`;
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      const subResult = await this.waitForJob(subJob.id, step.name);

      if (subResult.status === 'failed') {
        throw new Error(`${step.name} failed: ${subResult.error_details?.message || 'Unknown error'}`);
      }

      // Store results for next step
      results[step.type] = subResult.output_result;

      completedSteps++;
      this.currentStep = `Completed ${step.name}`;
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);
    }

    // Return final deployment results
    return {
      ...results.deployment as Record<string, unknown>,
      pagesGenerated: (results.content_generation as any)?.pagesGenerated,
      allResults: results,
    };
  }

  /**
   * Polls a sub-job until it completes or fails
   */
  private async waitForJob(jobId: string, stepName: string): Promise<GenerationJob> {
    const maxWaitTime = 10 * 60 * 1000; // 10 minutes max per step
    const pollInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const { data: job, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        throw new Error(`Failed to check job status: ${error.message}`);
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return job as GenerationJob;
      }

      // Update parent job with sub-job progress
      if (job.current_step) {
        this.currentStep = `${stepName}: ${job.current_step}`;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`${stepName} timed out after 10 minutes`);
  }
}
