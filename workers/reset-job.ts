import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

const jobId = process.argv[2];

if (!jobId) {
  console.log('Usage: npx tsx reset-job.ts <job-id>');
  process.exit(1);
}

async function resetJob() {
  const { data, error } = await supabase
    .from('generation_jobs')
    .update({
      status: 'pending',
      started_at: null,
      current_step: 'Waiting to restart...',
      progress_percent: 0,
      completed_steps: 0,
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error) {
    console.error('Error resetting job:', error);
    return;
  }

  console.log('Job reset to pending:', data.id);
  console.log('Job type:', data.job_type);
  console.log('Status:', data.status);
}

resetJob();
