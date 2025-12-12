import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

async function triggerRedeploy() {
  // Find the dry guys website
  const { data: websites } = await supabase
    .from('websites')
    .select('id, name, user_id')
    .ilike('name', '%dry%');

  if (!websites?.length) {
    console.log('No websites found matching "dry"');
    return;
  }

  const website = websites[0];
  console.log('Found website:', website.name);
  console.log('Website ID:', website.id);
  console.log('User ID:', website.user_id);

  // Create a new deployment job
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .insert({
      user_id: website.user_id,
      website_id: website.id,
      job_type: 'deployment',
      priority: 10,
      status: 'pending',
      input_payload: {
        business: {
          businessName: 'Dry Guys Damage Restoration Fort Worth',
        },
      },
      total_steps: 5,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating job:', error);
    return;
  }

  console.log('\n=== Deployment Job Created ===');
  console.log('Job ID:', job.id);
  console.log('Status:', job.status);
  console.log('\nWatching for progress...\n');

  // Poll for job progress
  let lastStatus = '';
  let lastStep = '';
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: updated } = await supabase
      .from('generation_jobs')
      .select('status, current_step, progress_percent, output_result, error_details')
      .eq('id', job.id)
      .single();

    if (!updated) continue;

    // Only log if something changed
    if (updated.status !== lastStatus || updated.current_step !== lastStep) {
      console.log(`[${new Date().toISOString()}] Status: ${updated.status}, Step: ${updated.current_step || '(none)'}, Progress: ${updated.progress_percent || 0}%`);
      lastStatus = updated.status;
      lastStep = updated.current_step || '';
    }

    if (updated.status === 'completed') {
      console.log('\n=== Job Completed ===');
      console.log('Output:', JSON.stringify(updated.output_result, null, 2));
      break;
    }

    if (updated.status === 'failed') {
      console.log('\n=== Job Failed ===');
      console.log('Error:', JSON.stringify(updated.error_details, null, 2));
      break;
    }
  }
}

triggerRedeploy();
