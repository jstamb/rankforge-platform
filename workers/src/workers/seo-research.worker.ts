import { BaseWorker } from '../lib/worker-base.js';
import { researchSEO } from '../lib/gemini.js';
import { saveSEOResearch, getWebsite, getBusiness } from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';

export class SEOResearchWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'SEO Research',
      jobTypes: ['seo_research', 'full_generation'],
      pollInterval: 5000,
      maxConcurrent: 3,
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const totalSteps = 4;
    let completedSteps = 0;

    // Step 1: Get business data
    this.currentStep = 'Loading business data';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const business = job.input_payload.business;
    const location = `${business.address.city}, ${business.address.state}`;

    completedSteps++;

    // Step 2: Run SEO research with Gemini
    this.currentStep = 'Analyzing market and competitors';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const seoData = await researchSEO(
      business.businessName,
      business.niche || business.businessType,
      location,
      business.services
    );

    completedSteps++;

    // Step 3: Process and validate results
    this.currentStep = 'Processing keyword data';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Ensure we have valid data
    const keywords = {
      primary: seoData.keywords?.primary || [],
      secondary: seoData.keywords?.secondary || [],
      longtail: seoData.keywords?.longtail || [],
    };

    completedSteps++;

    // Step 4: Save to Supabase
    this.currentStep = 'Saving SEO research';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const seoResearchId = await saveSEOResearch(
      job.website_id,
      keywords,
      seoData.competitors || [],
      seoData.searchIntent || { informational: [], transactional: [], navigational: [] }
    );

    completedSteps++;
    await this.progress(job.id, 'SEO research complete', completedSteps, totalSteps);

    return {
      seoResearchId,
      keywordsFound: {
        primary: keywords.primary.length,
        secondary: keywords.secondary.length,
        longtail: keywords.longtail.length,
      },
      competitorsAnalyzed: seoData.competitors?.length || 0,
      contentGaps: seoData.contentGaps?.length || 0,
    };
  }
}
