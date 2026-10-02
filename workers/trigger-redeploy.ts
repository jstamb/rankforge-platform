import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

async function triggerDeployment() {
  // Find website with recent completed site_build
  const { data: siteBuild, error: fetchError } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('job_type', 'site_build')
    .eq('status', 'completed')
    .not('output_result', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !siteBuild) {
    console.log('No completed site_build found:', fetchError?.message);
    return;
  }

  console.log('Found site_build:', siteBuild.id.slice(0, 8));
  console.log('Website ID:', siteBuild.website_id);
  const files = (siteBuild.output_result as any)?.files || [];
  console.log('Files in output:', files.length);

  // Create new deployment job
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .insert({
      user_id: siteBuild.user_id,
      website_id: siteBuild.website_id,
      job_type: 'deployment',
      priority: 1,
      status: 'pending',
      input_payload: siteBuild.input_payload,
      total_steps: 5,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating deployment job:', error);
    return;
  }

  console.log('\nCreated deployment job:', job.id);
  console.log('Status:', job.status);
  console.log('\nCloud Run workers will pick this up automatically.');
}

triggerDeployment();
