import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkRecentJobs() {
  // Get all recent jobs
  const { data: jobs, error } = await supabase
    .from('generation_jobs')
    .select('id, job_type, status, created_at, completed_at, current_step, error_details, website_id')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching jobs:', error);
    return;
  }

  console.log('\n=== Recent Jobs ===\n');
  for (const job of jobs || []) {
    console.log(`ID: ${job.id}`);
    console.log(`Type: ${job.job_type}`);
    console.log(`Status: ${job.status}`);
    console.log(`Step: ${job.current_step}`);
    console.log(`Created: ${job.created_at}`);
    console.log(`Completed: ${job.completed_at || 'N/A'}`);
    if (job.error_details) {
      console.log(`Error: ${JSON.stringify(job.error_details, null, 2)}`);
    }
    console.log('---');
  }

  // Check for pending jobs specifically
  const { data: pending, count } = await supabase
    .from('generation_jobs')
    .select('*', { count: 'exact' })
    .eq('status', 'pending');

  console.log(`\n=== Pending Jobs: ${count} ===`);

  // Check website for fort-worth
  const { data: websites } = await supabase
    .from('websites')
    .select('id, name, status, github_repo_url')
    .ilike('name', '%fort%worth%')
    .limit(5);

  console.log('\n=== Websites matching "fort worth" ===');
  console.log(websites);
}

checkRecentJobs();
