import { createClient } from '@supabase/supabase-js';
import type { GenerationJob, JobStatus } from './types.js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

// Log configuration status at startup (with key prefix for debugging)
console.log('[Supabase] URL:', supabaseUrl);
console.log('[Supabase] Service key prefix:', supabaseServiceKey?.substring(0, 20) + '...');
console.log('[Supabase] Key type check:', supabaseServiceKey?.startsWith('eyJ') ? 'JWT format (correct)' : 'NOT JWT format (wrong key type!)');

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Test database connection on startup
(async () => {
  console.log('[Supabase] Testing database connection...');
  console.log('[Supabase] URL:', supabaseUrl);
  console.log('[Supabase] Key starts with eyJ:', supabaseServiceKey?.startsWith('eyJ') ? 'YES (JWT)' : 'NO (wrong key!)');

  // Test a simple query to check if connection works
  const { count, error } = await supabase
    .from('generation_jobs')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[Supabase] Connection test FAILED:', error.message);
  } else {
    console.log(`[Supabase] Connection test SUCCESS - found ${count} total jobs in database`);
  }
})();

/**
 * Reset stale processing jobs back to pending
 * Jobs stuck in 'processing' for more than 5 minutes are considered stale
 */
export async function resetStaleJobs(): Promise<number> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: staleJobs, error } = await supabase
    .from('generation_jobs')
    .update({
      status: 'pending',
      started_at: null,
      current_step: 'Retrying...',
    })
    .eq('status', 'processing')
    .lt('started_at', fiveMinutesAgo)
    .select('id');

  if (error) {
    console.error('[Supabase] Error resetting stale jobs:', error.message);
    return 0;
  }

  if (staleJobs && staleJobs.length > 0) {
    console.log(`[Supabase] Reset ${staleJobs.length} stale job(s) to pending`);
  }

  return staleJobs?.length || 0;
}

/**
 * Fetch the next available job to process
 */
export async function claimNextJob(jobTypes: string[]): Promise<GenerationJob | null> {
  // First, check for and reset any stale processing jobs
  await resetStaleJobs();

  // Get oldest pending job of specified types
  const { data: jobs, error, count } = await supabase
    .from('generation_jobs')
    .select('*', { count: 'exact' })
    .in('job_type', jobTypes)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('[Supabase] Error fetching jobs:', error.message, error.code, error.details, error.hint);
    return null;
  }

  // Log query results for debugging
  console.log(`[Supabase] Query result: ${jobs?.length || 0} jobs returned, total count: ${count}`);

  if (!jobs || jobs.length === 0) {
    return null;
  }

  const job = jobs[0];

  // Atomically claim the job by updating status
  const { data: claimed, error: claimError } = await supabase
    .from('generation_jobs')
    .update({
      status: 'processing',
      started_at: new Date().toISOString(),
      current_step: 'Initializing...',
    })
    .eq('id', job.id)
    .eq('status', 'pending') // Ensure it's still pending
    .select()
    .single();

  if (claimError || !claimed) {
    // Job was claimed by another worker
    return null;
  }

  return claimed as GenerationJob;
}

/**
 * Update job progress
 */
export async function updateJobProgress(
  jobId: string,
  currentStep: string,
  completedSteps: number,
  totalSteps: number
): Promise<void> {
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  await supabase
    .from('generation_jobs')
    .update({
      current_step: currentStep,
      completed_steps: completedSteps,
      total_steps: totalSteps,
      progress_percent: progressPercent,
    })
    .eq('id', jobId);
}

/**
 * Complete a job successfully
 */
export async function completeJob(
  jobId: string,
  outputResult: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('generation_jobs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress_percent: 100,
      current_step: 'Completed',
      output_result: outputResult,
    })
    .eq('id', jobId);
}

/**
 * Fail a job with error details
 */
export async function failJob(
  jobId: string,
  error: Error,
  step?: string
): Promise<void> {
  await supabase
    .from('generation_jobs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      current_step: 'Failed',
      error_details: {
        message: error.message,
        step,
        stack: error.stack,
      },
    })
    .eq('id', jobId);
}

/**
 * Update website status
 */
export async function updateWebsiteStatus(
  websiteId: string,
  status: 'draft' | 'generating' | 'deployed' | 'error',
  updates?: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('websites')
    .update({
      status,
      ...updates,
    })
    .eq('id', websiteId);
}

/**
 * Get website by ID
 */
export async function getWebsite(websiteId: string) {
  const { data, error } = await supabase
    .from('websites')
    .select('*')
    .eq('id', websiteId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get business by ID
 */
export async function getBusiness(businessId: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Save SEO research results
 */
export async function saveSEOResearch(
  websiteId: string,
  keywords: Record<string, string[]>,
  competitors: unknown[],
  searchIntent: Record<string, string[]>
): Promise<string> {
  const { data, error } = await supabase
    .from('seo_research')
    .insert({
      website_id: websiteId,
      keywords,
      competitors,
      search_intent: searchIntent,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Save content index entries
 */
export async function saveContentIndex(
  entries: Array<{
    website_id: string;
    page_slug: string;
    page_type: string;
    title: string;
    target_keywords: string[];
    internal_links_to: string[];
  }>
): Promise<void> {
  const { error } = await supabase.from('content_index').insert(entries);
  if (error) throw error;
}

/**
 * Get content index for a website
 */
export async function getContentIndex(websiteId: string) {
  const { data, error } = await supabase
    .from('content_index')
    .select('*')
    .eq('website_id', websiteId)
    .order('page_type', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Save page content
 */
export async function savePageContent(
  websiteId: string,
  contentIndexId: string,
  content: {
    html_content: string;
    meta_title: string;
    meta_description: string;
    schema_markup: Record<string, unknown>;
    word_count: number;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('page_content')
    .insert({
      website_id: websiteId,
      content_index_id: contentIndexId,
      ...content,
    })
    .select('id')
    .single();

  if (error) throw error;

  // Update content index status
  await supabase
    .from('content_index')
    .update({ content_status: 'complete' })
    .eq('id', contentIndexId);

  return data.id;
}

/**
 * Save design system
 */
export async function saveDesignSystem(
  websiteId: string,
  designSystem: {
    tailwind_config: Record<string, unknown>;
    color_palette: Record<string, string>;
    typography: Record<string, unknown>;
    component_library: Record<string, unknown>;
  }
): Promise<string> {
  const { data, error } = await supabase
    .from('design_systems')
    .insert({
      website_id: websiteId,
      ...designSystem,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

/**
 * Get design system for a website
 */
export async function getDesignSystem(websiteId: string) {
  const { data, error } = await supabase
    .from('design_systems')
    .select('*')
    .eq('website_id', websiteId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get SEO research for a website
 */
export async function getSEOResearch(websiteId: string) {
  const { data, error } = await supabase
    .from('seo_research')
    .select('*')
    .eq('website_id', websiteId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get all page content for a website
 */
export async function getAllPageContent(websiteId: string) {
  const { data, error } = await supabase
    .from('page_content')
    .select('*, content_index(*)')
    .eq('website_id', websiteId);

  if (error) throw error;
  return data;
}
