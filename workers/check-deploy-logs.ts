import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkDeployLogs() {
  // Get deployment logs for the website
  const { data: logs, error } = await supabase
    .from('deployment_logs')
    .select('*')
    .eq('website_id', '329c5fc5-0f11-4062-9df5-4795b2ccd5f6')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n=== Deployment Logs ===\n');
  console.log(JSON.stringify(logs, null, 2));

  // Check if there's a Cloud Run worker on GCP processing these
  // Check for recently completed jobs to see worker_id pattern
  const { data: jobs } = await supabase
    .from('generation_jobs')
    .select('id, job_type, status, worker_id, created_at, completed_at')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('\n\n=== Recent Jobs with Worker IDs ===\n');
  for (const job of jobs || []) {
    const duration = job.completed_at && job.created_at
      ? ((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000).toFixed(1)
      : 'N/A';
    console.log(`${job.job_type.padEnd(20)} ${job.status.padEnd(12)} worker: ${job.worker_id || 'undefined'.padEnd(30)} duration: ${duration}s`);
  }

  // Check for any database triggers
  const { data: triggers, error: trigErr } = await supabase
    .rpc('pg_catalog_triggers');

  if (trigErr) {
    console.log('\n\nNote: Could not check triggers (may need RPC)');
  } else {
    console.log('\n\n=== Database Triggers ===');
    console.log(triggers);
  }
}

checkDeployLogs();
