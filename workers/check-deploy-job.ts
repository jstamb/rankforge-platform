import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

async function check() {
  // Find the dry guys website
  const { data: websites } = await supabase
    .from('websites')
    .select('id, name')
    .ilike('name', '%dry%');

  console.log('Websites matching "dry":', websites);

  if (!websites?.length) {
    console.log('No websites found');
    return;
  }

  const websiteId = websites[0].id;

  // Get all jobs for this website
  const { data: jobs } = await supabase
    .from('generation_jobs')
    .select('id, job_type, status, current_step, output_result, error_details, created_at')
    .eq('website_id', websiteId)
    .order('created_at', { ascending: false });

  for (const job of jobs || []) {
    console.log(`\n=== ${job.job_type} Job ===`);
    console.log('Status:', job.status);
    console.log('Step:', job.current_step);

    if (job.output_result) {
      const result = job.output_result as any;
      console.log('Output keys:', Object.keys(result));
      if (result.files) {
        console.log('Files count:', result.files.length);
        // Show ALL file paths to debug
        console.log('All file paths:', result.files.map((f: any) => f.path).sort());
        const deploymentFiles = result.files.filter((f: any) =>
          f.path.includes('github') || f.path.includes('cloudbuild') || f.path === 'Dockerfile' || f.path === 'nginx.conf' || f.path === '.gitignore'
        );
        console.log('Deployment files in output:', deploymentFiles.map((f: any) => f.path));
      }
      if (result.repoUrl) console.log('Repo URL:', result.repoUrl);
      if (result.deployed !== undefined) console.log('Deployed:', result.deployed);
      if (result.deploymentUrl !== undefined) console.log('Deployment URL:', result.deploymentUrl || '(empty)');
    }
    if (job.error_details) {
      console.log('Error:', JSON.stringify(job.error_details).substring(0, 300));
    }
  }
}

check();
