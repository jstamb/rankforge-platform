import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_KEY as string
);

async function triggerSiteBuild() {
  // Find a website to rebuild
  const { data: websites } = await supabase
    .from('websites')
    .select('id, name, user_id, business_id')
    .limit(1);

  if (!websites?.length) {
    console.log('No websites found');
    return;
  }

  const website = websites[0];
  console.log('Found website:', website.name);
  console.log('Website ID:', website.id);
  console.log('User ID:', website.user_id);

  // Get the business data
  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', website.business_id)
    .single();

  if (!business) {
    console.log('No business found for website');
    return;
  }

  console.log('Business:', business.business_name);
  console.log('Services:', business.services);

  // Create a new site_build job
  const { data: job, error } = await supabase
    .from('generation_jobs')
    .insert({
      user_id: website.user_id,
      website_id: website.id,
      job_type: 'site_build',
      priority: 10,
      status: 'pending',
      input_payload: {
        business: {
          business_name: business.business_name,
          niche: business.business_type,
          city: business.address_city,
          state: business.address_state,
          phone: business.phone,
          address: `${business.address_street}, ${business.address_city}, ${business.address_state} ${business.address_zip}`,
          neighborhoods: [],
          services: business.services || [],
          business_hours: 'Mon-Fri 8am-6pm, Sat 9am-4pm',
          year_established: 2015,
          email: business.email,
        },
      },
      total_steps: 14, // 11 generation steps + 3 finalization steps
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating job:', error);
    return;
  }

  console.log('\n=== Site Build Job Created ===');
  console.log('Job ID:', job.id);
  console.log('Status:', job.status);
  console.log('\nWatching for progress... (this will take several minutes)\n');

  // Poll for job progress
  let lastStatus = '';
  let lastStep = '';
  for (let i = 0; i < 300; i++) { // 10 minutes max
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
      if (updated.output_result) {
        console.log('Files generated:', (updated.output_result as any).files?.length || 0);
        console.log('Stats:', JSON.stringify((updated.output_result as any).stats, null, 2));
      }
      break;
    }

    if (updated.status === 'failed') {
      console.log('\n=== Job Failed ===');
      console.log('Error:', JSON.stringify(updated.error_details, null, 2));
      break;
    }
  }
}

triggerSiteBuild();
