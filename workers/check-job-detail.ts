import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkJobDetail() {
  // Get the most recent full_generation job
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', '2841d3ee-8203-4c1e-bed4-c97afcffb212')
    .single();

  if (error) {
    console.error('Error fetching job:', error);
    return;
  }

  console.log('\n=== Full Generation Job Details ===\n');
  console.log('ID:', job.id);
  console.log('Website ID:', job.website_id);
  console.log('Status:', job.status);
  console.log('Current Step:', job.current_step);
  console.log('Progress:', job.progress_percent + '%');
  console.log('Worker ID:', job.worker_id);
  console.log('Created:', job.created_at);
  console.log('Started:', job.started_at);
  console.log('Completed:', job.completed_at);
  console.log('\nInput Payload:');
  console.log(JSON.stringify(job.input_payload, null, 2));
  console.log('\nOutput Result:');
  console.log(JSON.stringify(job.output_result, null, 2));
  console.log('\nError Details:');
  console.log(JSON.stringify(job.error_details, null, 2));

  // Also get the deployment job
  const { data: deployJob } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', '9bb65a49-36a6-49b9-857b-3c307eaa98ae')
    .single();

  console.log('\n\n=== Deployment Job Details ===\n');
  console.log('ID:', deployJob?.id);
  console.log('Status:', deployJob?.status);
  console.log('Worker ID:', deployJob?.worker_id);
  console.log('Output Result:');
  console.log(JSON.stringify(deployJob?.output_result, null, 2));
  console.log('Error Details:');
  console.log(JSON.stringify(deployJob?.error_details, null, 2));
}

checkJobDetail();
