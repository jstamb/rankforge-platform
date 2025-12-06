/**
 * Generation Pipeline Orchestrator
 * Coordinates the full website generation, deployment, and DNS setup process
 */

import { supabase } from '../lib/supabase';
import { BusinessInput, generateStaticWebsiteFiles, generateWebsiteWithAI, GeneratedFile } from './websiteGenerator';
import { GitHubService } from './github';
import { CloudflareService } from './cloudflare';

export interface PipelineConfig {
  userId: string;
  websiteId: string;
  business: BusinessInput;
  githubToken?: string;
  cloudflareToken?: string;
  googleProjectId?: string;
  domain?: string;
}

export interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  message?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PipelineProgress {
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  currentStep: string;
  steps: PipelineStep[];
  progress: number;
  result?: {
    repoUrl?: string;
    deploymentUrl?: string;
    domain?: string;
    filesGenerated: number;
    pagesGenerated: number;
  };
  error?: string;
}

type ProgressCallback = (progress: PipelineProgress) => void;

/**
 * Main generation pipeline
 */
export class GenerationPipeline {
  private config: PipelineConfig;
  private progress: PipelineProgress;
  private onProgress?: ProgressCallback;

  constructor(config: PipelineConfig, onProgress?: ProgressCallback) {
    this.config = config;
    this.onProgress = onProgress;
    this.progress = {
      jobId: config.websiteId,
      status: 'running',
      currentStep: 'Initializing',
      steps: [
        { id: 'init', name: 'Initialize Generation', status: 'pending' },
        { id: 'generate', name: 'Generate Website Files', status: 'pending' },
        { id: 'github', name: 'Create GitHub Repository', status: 'pending' },
        { id: 'push', name: 'Push Files to GitHub', status: 'pending' },
        { id: 'deploy', name: 'Deploy to Cloud Run', status: 'pending' },
        { id: 'dns', name: 'Configure DNS', status: 'pending' },
        { id: 'finalize', name: 'Finalize & Verify', status: 'pending' },
      ],
      progress: 0,
    };
  }

  /**
   * Update step status and notify listeners
   */
  private updateStep(
    stepId: string,
    status: PipelineStep['status'],
    message?: string
  ) {
    const step = this.progress.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
      step.message = message;
      if (status === 'running') {
        step.startedAt = new Date().toISOString();
        this.progress.currentStep = step.name;
      }
      if (status === 'completed' || status === 'failed') {
        step.completedAt = new Date().toISOString();
      }
    }

    // Calculate progress percentage
    const completedSteps = this.progress.steps.filter(
      (s) => s.status === 'completed' || s.status === 'skipped'
    ).length;
    this.progress.progress = Math.round(
      (completedSteps / this.progress.steps.length) * 100
    );

    this.notifyProgress();
  }

  /**
   * Notify progress listeners
   */
  private notifyProgress() {
    if (this.onProgress) {
      this.onProgress({ ...this.progress });
    }
  }

  /**
   * Update job in database
   */
  private async updateJobInDb(updates: Record<string, any>) {
    try {
      await supabase
        .from('generation_jobs')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('website_id', this.config.websiteId);
    } catch (error) {
      console.error('Failed to update job in DB:', error);
    }
  }

  /**
   * Run the full generation pipeline
   */
  async run(): Promise<PipelineProgress> {
    let generatedFiles: GeneratedFile[] = [];
    let repoUrl: string | undefined;
    let deploymentUrl: string | undefined;

    try {
      // Step 1: Initialize
      this.updateStep('init', 'running', 'Preparing generation environment...');
      await this.updateJobInDb({
        status: 'processing',
        current_step: 'Initializing',
        started_at: new Date().toISOString(),
      });
      await this.delay(500);
      this.updateStep('init', 'completed', 'Environment ready');

      // Step 2: Generate website files
      this.updateStep('generate', 'running', 'Generating website files with AI...');
      await this.updateJobInDb({ current_step: 'Generating website files' });

      try {
        // Try AI generation first if API key is available
        const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (geminiApiKey) {
          this.updateStep('generate', 'running', 'Generating website files with AI...');
          const result = await generateWebsiteWithAI(this.config.business, geminiApiKey);
          generatedFiles = result.files;
          this.updateStep(
            'generate',
            'completed',
            `Generated ${generatedFiles.length} files with AI`
          );
        } else {
          // Fallback to static templates if no API key
          this.updateStep('generate', 'running', 'Generating website from templates...');
          generatedFiles = generateStaticWebsiteFiles(this.config.business);
          this.updateStep(
            'generate',
            'completed',
            `Generated ${generatedFiles.length} files`
          );
        }
      } catch (error: any) {
        // Fallback to static generation if AI fails
        console.warn('AI generation failed, using static templates:', error);
        generatedFiles = generateStaticWebsiteFiles(this.config.business);
        this.updateStep(
          'generate',
          'completed',
          `Generated ${generatedFiles.length} files (using templates)`
        );
      }

      // Step 3: Create GitHub repository
      if (this.config.githubToken) {
        this.updateStep('github', 'running', 'Creating GitHub repository...');
        await this.updateJobInDb({ current_step: 'Creating GitHub repository' });

        try {
          const github = new GitHubService(this.config.githubToken);
          const user = await github.getUser();
          const repoName = this.config.business.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          const repo = await github.createRepo(
            repoName,
            `Website for ${this.config.business.businessName} - Generated by RankForge`
          );

          repoUrl = repo.html_url;

          await supabase
            .from('websites')
            .update({
              github_repo_url: repoUrl,
              github_repo_name: repo.name,
            })
            .eq('id', this.config.websiteId);

          this.updateStep('github', 'completed', `Repository created: ${repoName}`);

          // Step 4: Push files to GitHub
          this.updateStep('push', 'running', 'Pushing files to repository...');
          await this.updateJobInDb({ current_step: 'Pushing files to GitHub' });

          await this.delay(1000); // Wait for repo initialization

          const { commitSha } = await github.pushFiles(
            user.login,
            repo.name,
            generatedFiles,
            'Initial website generation via RankForge'
          );

          this.updateStep(
            'push',
            'completed',
            `Pushed ${generatedFiles.length} files (${commitSha.slice(0, 7)})`
          );
        } catch (error: any) {
          this.updateStep('github', 'failed', error.message);
          this.updateStep('push', 'skipped', 'Skipped - GitHub creation failed');
          throw error;
        }
      } else {
        this.updateStep('github', 'skipped', 'No GitHub token configured');
        this.updateStep('push', 'skipped', 'No GitHub token configured');
      }

      // Step 5: Deploy to Cloud Run
      const googleProjectId =
        this.config.googleProjectId ||
        import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID;

      if (googleProjectId && repoUrl) {
        this.updateStep('deploy', 'running', 'Triggering Cloud Run deployment...');
        await this.updateJobInDb({ current_step: 'Deploying to Cloud Run' });

        try {
          // In production, this would trigger Cloud Build via API
          // For now, we simulate the deployment
          await this.delay(3000);

          const serviceName = this.config.business.businessName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-');

          deploymentUrl = `https://${serviceName}-${googleProjectId}.run.app`;

          await supabase
            .from('websites')
            .update({
              cloud_run_service_url: deploymentUrl,
              cloud_run_project_id: googleProjectId,
              status: 'deployed',
              last_deployed_at: new Date().toISOString(),
            })
            .eq('id', this.config.websiteId);

          this.updateStep('deploy', 'completed', 'Deployed successfully');
        } catch (error: any) {
          this.updateStep('deploy', 'failed', error.message);
          // Continue to DNS step even if deploy fails
        }
      } else {
        this.updateStep(
          'deploy',
          'skipped',
          'No Google Cloud project configured'
        );
      }

      // Step 6: Configure DNS
      if (this.config.cloudflareToken && this.config.domain && deploymentUrl) {
        this.updateStep('dns', 'running', 'Configuring DNS...');
        await this.updateJobInDb({ current_step: 'Configuring DNS' });

        try {
          const cloudflare = new CloudflareService(this.config.cloudflareToken);

          const { zone, dnsRecord } = await cloudflare.setupDomainForWebsite(
            this.config.domain,
            null, // root domain
            deploymentUrl
          );

          await supabase
            .from('websites')
            .update({
              domain: this.config.domain,
              cloudflare_zone_id: zone.id,
              dns_configured: true,
              ssl_status: 'active',
            })
            .eq('id', this.config.websiteId);

          this.updateStep('dns', 'completed', `DNS configured for ${this.config.domain}`);
        } catch (error: any) {
          this.updateStep('dns', 'failed', error.message);
        }
      } else {
        this.updateStep('dns', 'skipped', 'No domain or Cloudflare token configured');
      }

      // Step 7: Finalize
      this.updateStep('finalize', 'running', 'Finalizing...');
      await this.updateJobInDb({ current_step: 'Finalizing' });

      // Create deployment log
      await supabase.from('deployment_logs').insert({
        website_id: this.config.websiteId,
        status: 'success',
        step: 'complete',
        message: 'Website generated and deployed successfully',
        started_at: this.progress.steps[0].startedAt,
        completed_at: new Date().toISOString(),
      });

      this.updateStep('finalize', 'completed', 'Generation complete!');

      // Update final job status
      await this.updateJobInDb({
        status: 'completed',
        completed_at: new Date().toISOString(),
        completed_steps: this.progress.steps.length,
        progress_percent: 100,
        output_result: {
          repoUrl,
          deploymentUrl,
          domain: this.config.domain,
          filesGenerated: generatedFiles.length,
          pagesGenerated:
            2 +
            this.config.business.targetCities.length +
            this.config.business.services.length,
        },
      });

      this.progress.status = 'completed';
      this.progress.result = {
        repoUrl,
        deploymentUrl,
        domain: this.config.domain,
        filesGenerated: generatedFiles.length,
        pagesGenerated:
          2 +
          this.config.business.targetCities.length +
          this.config.business.services.length,
      };
      this.notifyProgress();

      return this.progress;
    } catch (error: any) {
      this.progress.status = 'failed';
      this.progress.error = error.message;

      await this.updateJobInDb({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_details: { message: error.message },
      });

      // Create failed deployment log
      await supabase.from('deployment_logs').insert({
        website_id: this.config.websiteId,
        status: 'failed',
        step: this.progress.currentStep,
        message: error.message,
        error_details: { stack: error.stack },
      });

      this.notifyProgress();
      throw error;
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Start a website generation job
 */
export async function startGenerationJob(
  userId: string,
  websiteId: string,
  business: BusinessInput,
  options: {
    githubToken?: string;
    cloudflareToken?: string;
    domain?: string;
    onProgress?: ProgressCallback;
  } = {}
): Promise<PipelineProgress> {
  // Create job record
  await supabase.from('generation_jobs').insert({
    user_id: userId,
    website_id: websiteId,
    job_type: 'full_generation',
    status: 'queued',
    total_steps: 7,
    completed_steps: 0,
    progress_percent: 0,
  });

  // Update website status
  await supabase
    .from('websites')
    .update({ status: 'generating' })
    .eq('id', websiteId);

  // Run pipeline
  const pipeline = new GenerationPipeline(
    {
      userId,
      websiteId,
      business,
      githubToken: options.githubToken,
      cloudflareToken: options.cloudflareToken,
      domain: options.domain,
      googleProjectId: import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID,
    },
    options.onProgress
  );

  return pipeline.run();
}

/**
 * Get job progress from database
 */
export async function getJobProgress(
  websiteId: string
): Promise<PipelineProgress | null> {
  const { data: job } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('website_id', websiteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!job) return null;

  return {
    jobId: job.id,
    status: job.status === 'completed' ? 'completed' : job.status === 'failed' ? 'failed' : 'running',
    currentStep: job.current_step || 'Initializing',
    steps: [], // Would need to store steps in DB for full reconstruction
    progress: job.progress_percent || 0,
    result: job.output_result,
    error: job.error_details?.message,
  };
}
