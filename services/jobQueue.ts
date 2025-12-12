/**
 * Job Queue Service
 * Handles job creation, status updates, and Realtime subscriptions
 * Jobs are processed by Cloud Run workers polling the queue
 */

import { supabase } from '../lib/supabase';
import { BusinessInput } from './websiteGenerator';
import { RealtimeChannel } from '@supabase/supabase-js';

export type JobStatus = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJobRecord {
  id: string;
  user_id: string;
  website_id: string;
  job_type: 'full_generation' | 'content_update' | 'seo_optimization' | 'redeploy';
  priority: number;
  status: JobStatus;
  queue_position: number;

  // Timestamps
  created_at: string;
  queued_at?: string;
  started_at?: string;
  completed_at?: string;

  // Progress tracking
  current_step?: string;
  total_steps: number;
  completed_steps: number;
  progress_percent: number;

  // Input/Output
  input_payload: {
    business: BusinessInput;
    options: {
      useAI: boolean;
      deployToGithub: boolean;
      deployToCloudRun: boolean;
      configureDNS: boolean;
      domain?: string;
    };
  };
  output_result?: {
    repoUrl?: string;
    deploymentUrl?: string;
    domain?: string;
    filesGenerated?: number;
    pagesGenerated?: number;
  };
  error_details?: {
    message: string;
    step?: string;
    attempt?: number;
    stack?: string;
  };
}

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  currentStep: string;
  progress: number;
  queuePosition?: number;
  result?: GenerationJobRecord['output_result'];
  error?: string;
}

type JobProgressCallback = (progress: JobProgress) => void;

/**
 * Create a new generation job and add to queue
 * Jobs are processed directly via Edge Functions
 */
export type ProjectType = 'nextjs' | 'static-html' | 'react-spa';

export async function createGenerationJob(
  userId: string,
  websiteId: string,
  business: BusinessInput,
  options: {
    useAI?: boolean;
    deployToGithub?: boolean;
    deployToCloudRun?: boolean;
    configureDNS?: boolean;
    domain?: string;
    projectType?: ProjectType;  // Default: 'nextjs' for new sites
    neighborhoods?: string[];
  } = {}
): Promise<{ jobId: string; queuePosition: number }> {
  // Get current queue position
  const { count } = await supabase
    .from('generation_jobs')
    .select('*', { count: 'exact', head: true })
    .in('status', ['pending', 'queued', 'processing']);

  const queuePosition = (count || 0) + 1;

  // Create job record - status must be 'pending' for workers to pick it up
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .insert({
      user_id: userId,
      website_id: websiteId,
      job_type: 'full_generation',
      priority: 5, // Default priority (1-10, lower = higher priority)
      status: 'pending',
      current_step: 'Queued for processing...',
      queue_position: queuePosition,
      total_steps: 7,
      completed_steps: 0,
      progress_percent: 0,
      input_payload: {
        business,
        projectType: options.projectType ?? 'nextjs',  // Default to Next.js for new sites
        neighborhoods: options.neighborhoods ?? business.neighborhoods,
        options: {
          useAI: options.useAI ?? true,
          deployToGithub: options.deployToGithub ?? true,
          deployToCloudRun: options.deployToCloudRun ?? true,
          configureDNS: options.configureDNS ?? false,
          domain: options.domain,
        },
      },
    })
    .select()
    .single();

  if (error) throw error;

  // Update website status
  await supabase
    .from('websites')
    .update({ status: 'generating' })
    .eq('id', websiteId);

  // Job will be picked up by Cloud Run workers polling the queue
  return { jobId: job.id, queuePosition };
}

/**
 * Subscribe to real-time job progress updates
 */
export function subscribeToJobProgress(
  jobId: string,
  onProgress: JobProgressCallback
): RealtimeChannel {
  const channel = supabase
    .channel(`job-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'generation_jobs',
        filter: `id=eq.${jobId}`,
      },
      (payload) => {
        const job = payload.new as GenerationJobRecord;
        onProgress({
          jobId: job.id,
          status: job.status,
          currentStep: job.current_step || 'Waiting...',
          progress: job.progress_percent,
          queuePosition: job.queue_position,
          result: job.output_result,
          error: job.error_details?.message,
        });
      }
    )
    .subscribe();

  return channel;
}

/**
 * Get current job status
 */
export async function getJobStatus(jobId: string): Promise<JobProgress | null> {
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) return null;

  return {
    jobId: job.id,
    status: job.status,
    currentStep: job.current_step || 'Waiting...',
    progress: job.progress_percent,
    queuePosition: job.queue_position,
    result: job.output_result,
    error: job.error_details?.message,
  };
}

/**
 * Cancel a pending or queued job
 */
export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('generation_jobs')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .eq('user_id', userId)
    .in('status', ['pending', 'queued']);

  return !error;
}

/**
 * Get user's active jobs
 */
export async function getUserActiveJobs(userId: string): Promise<GenerationJobRecord[]> {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'queued', 'processing'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completedToday: number;
  averageWaitTime: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [pendingResult, processingResult, completedResult] = await Promise.all([
    supabase
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'queued']),
    supabase
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing'),
    supabase
      .from('generation_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', today.toISOString()),
  ]);

  return {
    pending: pendingResult.count || 0,
    processing: processingResult.count || 0,
    completedToday: completedResult.count || 0,
    averageWaitTime: 120, // TODO: Calculate from actual data
  };
}
