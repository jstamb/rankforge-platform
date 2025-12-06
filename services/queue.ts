import { supabase } from '../lib/supabase';
import { GenerationJob } from '../types';

export interface EnqueueJobParams {
  websiteId: string;
  businessId: string;
  jobType: 'full_generation' | 'deployment';
  payload: any;
}

// In a real implementation, this would call a Next.js API route 
// which would push to Redis/BullMQ.
// Here, we interact directly with Supabase to create the job record.
export const enqueueJob = async (params: EnqueueJobParams): Promise<GenerationJob> => {
  if (!supabase) throw new Error("Supabase not configured");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // 1. Create the job record
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .insert({
      user_id: user.id,
      website_id: params.websiteId,
      job_type: params.jobType,
      priority: 5, // Default priority
      input_payload: params.payload,
      status: 'pending',
      total_steps: 6, // Estimate based on typical flow
      queue_position: 1, // Simplified for demo
    } as any)
    .select()
    .single();

  if (error) {
    console.error("Failed to enqueue job:", error);
    throw error;
  }

  // SIMULATION: Since we don't have a real N8N worker running in this environment,
  // we trigger a client-side simulation to update the job status so the UI works.
  simulateWorkerProgress(job.id);

  return job;
};

// This function simulates what the Backend Worker (N8N) would do
const simulateWorkerProgress = async (jobId: string) => {
  if (!supabase) return;

  const steps = [
    { status: 'queued', step: 'Waiting for worker...', progress: 0, delay: 1000 },
    { status: 'processing', step: 'Generating homepage content', progress: 10, delay: 2000 },
    { status: 'processing', step: 'Generating location pages', progress: 30, delay: 3000 },
    { status: 'processing', step: 'Generating service pages', progress: 50, delay: 2500 },
    { status: 'processing', step: 'Building website files', progress: 70, delay: 2000 },
    { status: 'processing', step: 'Pushing to GitHub', progress: 85, delay: 2000 },
    { status: 'processing', step: 'Deploying to Cloud Run', progress: 95, delay: 3000 },
    { status: 'completed', step: 'Deployed successfully', progress: 100, delay: 1000 },
  ];

  for (const s of steps) {
    await new Promise(r => setTimeout(r, s.delay));
    
    const updateData: any = {
      status: s.status,
      current_step: s.step,
      progress_percent: s.progress,
      updated_at: new Date().toISOString()
    };

    if (s.status === 'processing' && !updateData.started_at) {
        // We handle logic loosely here for simulation
    }

    if (s.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
      updateData.output_result = {
        deploymentUrl: 'https://rankforge-demo-site.web.app',
        repoUrl: 'https://github.com/rankforge/demo-site',
        pagesGenerated: { locations: 12, services: 5 }
      };
      
      // Also update the website status
      // In real app, we'd fetch the job first to get website_id, but here we assume context
      const { data: job } = await supabase.from('generation_jobs').select('website_id').eq('id', jobId).single();
      if (job) {
          await supabase.from('websites').update({ status: 'deployed' }).eq('id', job.website_id);
      }
    }

    await supabase
      .from('generation_jobs')
      .update(updateData)
      .eq('id', jobId);
  }
};