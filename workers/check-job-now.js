import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  const { data: job } = await supabase
    .from('generation_jobs')
    .select('status, current_step, progress_percent, error_details, started_at')
    .eq('id', '2841d3ee-8203-4c1e-bed4-c97afcffb212')
    .single();

  console.log('Job Status:', job?.status);
  console.log('Progress:', job?.progress_percent + '%');
  console.log('Step:', job?.current_step);
  console.log('Started:', job?.started_at);
  if (job?.error_details) {
    console.log('Error:', JSON.stringify(job.error_details).substring(0, 200));
  }
}

check();
