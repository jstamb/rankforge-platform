/**
 * Supabase Edge Function: Process Generation Job
 * Processes website generation job status updates
 *
 * This runs server-side with access to secrets and APIs
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface JobPayload {
  jobId: string;
  action: 'process' | 'update_status' | 'complete' | 'fail';
  step?: string;
  progress?: number;
  result?: any;
  error?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: JobPayload = await req.json();
    const { jobId, action, step, progress, result, error } = payload;

    // Create Supabase admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current job
    const { data: job, error: fetchError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let updateData: any = { updated_at: new Date().toISOString() };

    switch (action) {
      case 'process':
        // Mark job as processing
        updateData = {
          ...updateData,
          status: 'processing',
          started_at: new Date().toISOString(),
          current_step: 'Initializing',
        };
        break;

      case 'update_status':
        // Update progress
        updateData = {
          ...updateData,
          current_step: step,
          progress_percent: progress,
          completed_steps: Math.floor((progress || 0) / (100 / job.total_steps)),
        };
        break;

      case 'complete':
        // Mark as completed
        updateData = {
          ...updateData,
          status: 'completed',
          completed_at: new Date().toISOString(),
          current_step: 'Completed',
          progress_percent: 100,
          completed_steps: job.total_steps,
          output_result: result,
        };

        // Update website status
        await supabase
          .from('websites')
          .update({
            status: 'deployed',
            github_repo_url: result?.repoUrl,
            cloud_run_service_url: result?.deploymentUrl,
            last_deployed_at: new Date().toISOString(),
          })
          .eq('id', job.website_id);

        // Create deployment log
        await supabase.from('deployment_logs').insert({
          website_id: job.website_id,
          status: 'success',
          step: 'complete',
          message: 'Website generated and deployed successfully',
        });
        break;

      case 'fail':
        // Mark as failed
        updateData = {
          ...updateData,
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_details: {
            message: error,
            step: step,
            attempt: (job.error_details?.attempt || 0) + 1,
          },
        };

        // Update website status
        await supabase
          .from('websites')
          .update({ status: 'error' })
          .eq('id', job.website_id);

        // Create deployment log
        await supabase.from('deployment_logs').insert({
          website_id: job.website_id,
          status: 'failed',
          step: step,
          message: error,
        });
        break;
    }

    // Update job
    const { error: updateError } = await supabase
      .from('generation_jobs')
      .update(updateData)
      .eq('id', jobId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, jobId, action }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Error processing job:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
