import { BaseWorker } from '../lib/worker-base.js';
import { supabase, updateWebsiteStatus, getWebsite, getBusiness } from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';
import {
  generateFullSEOWebsite,
  generateSiteArchitecture,
  generateDesignSystem,
  generateAllContent,
} from '../lib/seo-generation.js';
import { BusinessInput } from '../lib/seo-prompts.js';

/**
 * Unified Generation Worker (Enhanced with SEO Pipeline)
 *
 * Generates an entire SEO-optimized website using a multi-step process:
 * 1. Generate site architecture (URLs, hub-and-spoke, internal linking)
 * 2. Generate design system (colors, typography, spacing)
 * 3. Generate content for all pages (2,000-3,500 words each)
 * 4. Build static HTML files
 * 5. Deploy to GitHub
 *
 * This generates 30-100+ page websites with proper SEO structure.
 */
export class UnifiedGenerationWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'UnifiedGeneration',
      jobTypes: ['full_generation'],
      pollInterval: 3000,
      maxConcurrent: 2, // Reduced due to higher complexity
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const totalSteps = 7;
    let completedSteps = 0;

    try {
      // Step 1: Load business and website data
      this.currentStep = 'Loading business data';
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      const website = await getWebsite(job.website_id);
      const business = await getBusiness(website.business_id);

      const inputPayload = job.input_payload as any;

      // Build BusinessInput for SEO generation
      const businessInput: BusinessInput = {
        business_name: business.business_name,
        niche: business.business_type,
        city: business.address_city,
        state: business.address_state,
        phone: business.phone,
        address: `${business.address_street}, ${business.address_city}, ${business.address_state} ${business.address_zip}`,
        neighborhoods: inputPayload?.neighborhoods || this.getDefaultNeighborhoods(business.address_city),
        services: business.services || [],
        business_hours: inputPayload?.businessHours || 'Mon-Fri 8am-6pm, Sat 9am-4pm',
        year_established: inputPayload?.yearEstablished || (new Date().getFullYear() - 10),
        license_number: inputPayload?.licenseNumber,
        email: business.email,
        google_maps_embed_url: inputPayload?.googleMapsEmbedUrl,
      };

      console.log(`[UnifiedGeneration] Starting SEO website generation for ${businessInput.business_name}`);
      const overallStart = Date.now();

      completedSteps++;

      // Step 2: Generate Site Architecture
      this.currentStep = 'Planning site architecture';
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      console.log('[UnifiedGeneration] Generating site architecture...');
      const architecture = await generateSiteArchitecture(businessInput);
      console.log(`[UnifiedGeneration] Architecture complete - ${architecture.pages.length} pages planned`);

      completedSteps++;

      // Step 3: Generate Design System
      this.currentStep = 'Creating design system';
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      console.log('[UnifiedGeneration] Generating design system...');
      const designSystem = await generateDesignSystem(businessInput);
      console.log('[UnifiedGeneration] Design system complete');

      completedSteps++;

      // Step 4: Generate All Page Content
      this.currentStep = `Generating ${architecture.pages.length} pages of content`;
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      console.log(`[UnifiedGeneration] Generating content for ${architecture.pages.length} pages...`);
      const content = await generateAllContent(
        businessInput,
        architecture,
        (completed, total, currentPage) => {
          this.currentStep = `Generating content: ${completed}/${total} pages (${currentPage})`;
          // Don't await - just update the step name for visibility
        }
      );

      const totalWords = content.reduce((sum, p) => sum + (p.wordCount || 0), 0);
      console.log(`[UnifiedGeneration] Content complete - ${content.length} pages, ${totalWords} words`);

      completedSteps++;

      // Step 5: Save data to database
      this.currentStep = 'Saving generated content';
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      // Save content index entries
      const contentIndexEntries = architecture.pages.map((page) => ({
        website_id: job.website_id,
        page_slug: page.slug,
        page_type: page.type,
        title: page.title,
        target_keywords: page.targetKeywords,
        internal_links_to: page.internalLinksTo,
      }));

      const { data: indexData, error: indexError } = await supabase
        .from('content_index')
        .insert(contentIndexEntries)
        .select('id, page_slug');

      if (indexError) {
        console.error('[UnifiedGeneration] Error saving content index:', indexError);
      }

      // Create slug-to-id mapping
      const slugToIndexId = new Map(
        (indexData || []).map((entry: any) => [entry.page_slug, entry.id])
      );

      // Save page content
      for (const page of content) {
        const contentIndexId = slugToIndexId.get(page.slug);
        if (contentIndexId) {
          const { error } = await supabase
            .from('page_content')
            .insert({
              content_index_id: contentIndexId,
              html_content: page.sections.map(s => s.content).join('\n'),
              meta_title: page.metaTitle,
              meta_description: page.metaDescription,
              schema_markup: page.schemaMarkup,
              word_count: page.wordCount,
            });

          if (error) {
            console.error(`[UnifiedGeneration] Error saving page content for ${page.slug}:`, error);
          }
        }
      }

      // Populate location_pages and service_pages tables for accurate stats
      console.log('[UnifiedGeneration] Populating location and service page tables...');
      const locationCount = await this.populateLocationPages(
        job.website_id,
        architecture,
        content,
        businessInput
      );
      const serviceCount = await this.populateServicePages(
        job.website_id,
        architecture,
        content,
        businessInput
      );
      console.log(`[UnifiedGeneration] Page tables populated: ${locationCount} locations, ${serviceCount} services`);

      // Save design system
      const { error: designError } = await supabase
        .from('design_systems')
        .insert({
          website_id: job.website_id,
          tailwind_config: {
            colors: designSystem.colorPalette,
            fontFamily: {
              heading: [designSystem.typography.headingFont, 'sans-serif'],
              body: [designSystem.typography.bodyFont, 'sans-serif'],
            },
          },
          color_palette: designSystem.colorPalette,
          typography: designSystem.typography,
          component_library: {},
        });

      if (designError) {
        console.error('[UnifiedGeneration] Error saving design system:', designError);
      }

      completedSteps++;

      // Step 6: Build site files (trigger site_build job)
      this.currentStep = 'Building site files';
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      // Determine project type - default to 'nextjs' for new sites
      const projectType = inputPayload?.projectType || 'nextjs';

      const { data: buildJob } = await supabase
        .from('generation_jobs')
        .insert({
          user_id: job.user_id,
          website_id: job.website_id,
          job_type: 'site_build',
          priority: job.priority,
          status: 'pending',
          input_payload: {
            parent_job_id: job.id,
            projectType,  // 'nextjs', 'static-html', or 'react-spa'
            architecture,
            designSystem,
            content,
            business: businessInput,
            domain: inputPayload?.domain,
            neighborhoods: inputPayload?.neighborhoods,
          },
          total_steps: 5,
        })
        .select()
        .single();

      if (buildJob) {
        const buildResult = await this.waitForJob(buildJob.id, 'Site Build');
        if (buildResult.status === 'failed') {
          throw new Error(`Site build failed: ${buildResult.error_details?.message}`);
        }
      }

      completedSteps++;

      // Step 7: Deploy (trigger deployment job)
      this.currentStep = 'Deploying website';
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      const { data: deployJob } = await supabase
        .from('generation_jobs')
        .insert({
          user_id: job.user_id,
          website_id: job.website_id,
          job_type: 'deployment',
          priority: job.priority,
          status: 'pending',
          input_payload: {
            parent_job_id: job.id,
            business: businessInput,
          },
          total_steps: 5,
        })
        .select()
        .single();

      let deploymentResult: any = {};
      if (deployJob) {
        const result = await this.waitForJob(deployJob.id, 'Deployment');
        if (result.status === 'failed') {
          console.warn('[UnifiedGeneration] Deployment failed, but website content is generated');
        } else {
          deploymentResult = result.output_result || {};
        }
      }

      completedSteps++;

      // Update website status
      await updateWebsiteStatus(job.website_id, 'deployed', {
        deployed_at: new Date().toISOString(),
      });

      const overallDuration = ((Date.now() - overallStart) / 1000).toFixed(1);
      console.log(`[UnifiedGeneration] COMPLETE - ${content.length} pages, ${totalWords} words in ${overallDuration}s`);

      return {
        pagesGenerated: content.length,
        totalWords,
        generationTime: `${overallDuration}s`,
        architecture: {
          totalPages: architecture.pages.length,
          pageTypes: this.countPageTypes(architecture.pages),
        },
        // Page counts for dashboard display
        locationCount,
        serviceCount,
        pagesGeneratedByType: {
          locations: locationCount,
          services: serviceCount,
        },
        ...deploymentResult,
      };

    } catch (error: any) {
      console.error('[UnifiedGeneration] Error:', error);
      await updateWebsiteStatus(job.website_id, 'error');
      throw error;
    }
  }

  /**
   * Get default neighborhoods for a city
   */
  private getDefaultNeighborhoods(city: string): string[] {
    // Return a small set of default neighborhoods
    // In production, this could come from a city database
    return [
      'Downtown',
      'Northside',
      'Southside',
      'East Side',
      'West Side',
    ];
  }

  /**
   * Populate location_pages table with generated location pages
   * This provides accurate counts in website_stats view
   */
  private async populateLocationPages(
    websiteId: string,
    architecture: any,
    content: any[],
    businessInput: any
  ): Promise<number> {
    const locationTypes = ['location_hub', 'city_service', 'neighborhood'];
    const locationPages = architecture.pages.filter((p: any) => locationTypes.includes(p.type));

    if (locationPages.length === 0) {
      console.log('[UnifiedGeneration] No location pages to save');
      return 0;
    }

    // First delete any existing location pages for this website
    await supabase.from('location_pages').delete().eq('website_id', websiteId);

    const entries = locationPages.map((page: any) => {
      // Find corresponding content
      const pageContent = content.find((c: any) => c.slug === page.slug);

      // Extract city/neighborhood from slug or title
      const slugParts = page.slug.split('/').filter(Boolean);
      const neighborhood = page.type === 'neighborhood' ? slugParts[slugParts.length - 1]?.replace(/-/g, ' ') : null;

      return {
        website_id: websiteId,
        city: businessInput.city,
        state: businessInput.state || '',
        neighborhood: neighborhood,
        page_slug: page.slug,
        title_tag: pageContent?.metaTitle || page.title,
        meta_description: pageContent?.metaDescription || '',
        h1_heading: pageContent?.h1 || page.h1 || page.title,
        main_content: pageContent?.sections?.map((s: any) => s.content).join('\n') || '',
        local_business_schema: pageContent?.schemaMarkup?.localBusiness || {},
        faq_schema: pageContent?.schemaMarkup?.faqPage || null,
        related_locations: page.internalLinksTo?.filter((link: string) =>
          locationPages.some((lp: any) => lp.slug === link)
        ) || [],
        status: 'generated',
        generated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from('location_pages').insert(entries);

    if (error) {
      console.error('[UnifiedGeneration] Error saving location pages:', error);
      return 0;
    }

    console.log(`[UnifiedGeneration] Saved ${entries.length} location pages`);
    return entries.length;
  }

  /**
   * Populate service_pages table with generated service pages
   * This provides accurate counts in website_stats view
   */
  private async populateServicePages(
    websiteId: string,
    architecture: any,
    content: any[],
    businessInput: any
  ): Promise<number> {
    const serviceTypes = ['service_hub', 'service'];
    const servicePages = architecture.pages.filter((p: any) => serviceTypes.includes(p.type));

    if (servicePages.length === 0) {
      console.log('[UnifiedGeneration] No service pages to save');
      return 0;
    }

    // First delete any existing service pages for this website
    await supabase.from('service_pages').delete().eq('website_id', websiteId);

    const entries = servicePages.map((page: any) => {
      // Find corresponding content
      const pageContent = content.find((c: any) => c.slug === page.slug);

      // Extract service name from slug or title
      const slugParts = page.slug.split('/').filter(Boolean);
      const serviceName = slugParts[slugParts.length - 1]?.replace(/-/g, ' ') || page.title;

      return {
        website_id: websiteId,
        service_name: serviceName,
        page_slug: page.slug,
        title_tag: pageContent?.metaTitle || page.title,
        meta_description: pageContent?.metaDescription || '',
        h1_heading: pageContent?.h1 || page.h1 || page.title,
        content: pageContent?.sections?.map((s: any) => s.content).join('\n') || '',
        service_schema: pageContent?.schemaMarkup?.service || {},
        faq_schema: pageContent?.schemaMarkup?.faqPage || null,
        status: 'generated',
        generated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase.from('service_pages').insert(entries);

    if (error) {
      console.error('[UnifiedGeneration] Error saving service pages:', error);
      return 0;
    }

    console.log(`[UnifiedGeneration] Saved ${entries.length} service pages`);
    return entries.length;
  }

  /**
   * Count pages by type
   */
  private countPageTypes(pages: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const page of pages) {
      counts[page.type] = (counts[page.type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Polls a sub-job until it completes or fails
   */
  private async waitForJob(jobId: string, stepName: string): Promise<GenerationJob> {
    const maxWaitTime = 15 * 60 * 1000; // 15 minutes max (increased for larger content)
    const pollInterval = 3000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const { data: job, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        throw new Error(`Failed to check job status: ${error.message}`);
      }

      if (job.status === 'completed' || job.status === 'failed') {
        return job as GenerationJob;
      }

      if (job.current_step) {
        this.currentStep = `${stepName}: ${job.current_step}`;
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`${stepName} timed out after 15 minutes`);
  }
}
