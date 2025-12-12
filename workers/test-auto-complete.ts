import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testAutoComplete() {
  const jobId = '2841d3ee-8203-4c1e-bed4-c97afcffb212';

  console.log('=== Testing for Database Webhook Auto-Complete ===\n');

  // Reset the job to pending
  console.log('1. Resetting job to pending status...');
  const { error: resetError } = await supabase
    .from('generation_jobs')
    .update({
      status: 'pending',
      started_at: null,
      completed_at: null,
      current_step: 'Testing for auto-complete',
      progress_percent: 0,
      output_result: null,
    })
    .eq('id', jobId);

  if (resetError) {
    console.error('Failed to reset job:', resetError);
    return;
  }
  console.log('Job reset to pending.');

  // Wait 10 seconds to see if it auto-completes
  console.log('\n2. Waiting 10 seconds to see if job auto-completes...\n');

  for (let i = 1; i <= 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: job } = await supabase
      .from('generation_jobs')
      .select('status, worker_id, current_step, completed_at')
      .eq('id', jobId)
      .single();

    console.log(`   ${i}s - Status: ${job?.status}, Worker: ${job?.worker_id || 'none'}, Step: ${job?.current_step}`);

    if (job?.status !== 'pending') {
      console.log('\n🚨 JOB STATUS CHANGED! Something is auto-completing jobs!');
      console.log('   New status:', job?.status);
      console.log('   Worker ID:', job?.worker_id || 'NONE (not a worker)');
      console.log('   Completed at:', job?.completed_at);

      if (!job?.worker_id && job?.status === 'completed') {
        console.log('\n⚠️  This confirms there is a DATABASE WEBHOOK or TRIGGER auto-completing jobs.');
        console.log('   Check Supabase Dashboard > Database > Webhooks for any webhook on generation_jobs table.');
      }
      return;
    }
  }

  console.log('\n✅ Job remained pending. No auto-complete detected.');
  console.log('   Local workers should pick this up now.');
}

testAutoComplete();
