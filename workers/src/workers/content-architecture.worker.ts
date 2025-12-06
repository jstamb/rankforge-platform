import { BaseWorker } from '../lib/worker-base.js';
import { planContentArchitecture } from '../lib/gemini.js';
import { getSEOResearch, saveContentIndex } from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';

export class ContentArchitectureWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'Content Architecture',
      jobTypes: ['content_architecture', 'full_generation'],
      pollInterval: 5000,
      maxConcurrent: 3,
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const totalSteps = 5;
    let completedSteps = 0;

    const business = job.input_payload.business;

    // Step 1: Get SEO research
    this.currentStep = 'Loading SEO research';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const seoResearch = await getSEOResearch(job.website_id);
    if (!seoResearch) {
      throw new Error('SEO research not found. Run SEO research first.');
    }

    completedSteps++;

    // Step 2: Plan content architecture
    this.currentStep = 'Planning site structure';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const targetCities = business.targetCities || [
      { name: business.address.city, state: business.address.state },
    ];

    const architecture = await planContentArchitecture(
      business.businessName,
      business.niche || business.businessType,
      business.services,
      targetCities,
      seoResearch.keywords
    );

    completedSteps++;

    // Step 3: Process internal linking
    this.currentStep = 'Building internal link structure';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Calculate internal links FROM each page
    const linksFromMap: Record<string, string[]> = {};
    for (const page of architecture.pages) {
      for (const linkedSlug of page.internalLinksTo) {
        if (!linksFromMap[linkedSlug]) {
          linksFromMap[linkedSlug] = [];
        }
        linksFromMap[linkedSlug].push(page.slug);
      }
    }

    completedSteps++;

    // Step 4: Save content index
    this.currentStep = 'Saving content index';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const contentIndexEntries = architecture.pages.map((page) => ({
      website_id: job.website_id,
      page_slug: page.slug,
      page_type: page.type,
      title: page.title,
      target_keywords: page.targetKeywords,
      internal_links_to: page.internalLinksTo,
      internal_links_from: linksFromMap[page.slug] || [],
    }));

    await saveContentIndex(contentIndexEntries);

    completedSteps++;

    // Step 5: Complete
    this.currentStep = 'Content architecture complete';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    return {
      pagesPlanned: architecture.pages.length,
      hubPages: architecture.hubAndSpoke.hubs.length,
      pagesByType: {
        home: architecture.pages.filter((p) => p.type === 'home').length,
        service: architecture.pages.filter((p) => p.type === 'service').length,
        location: architecture.pages.filter((p) => p.type === 'location').length,
        hub: architecture.pages.filter((p) => p.type === 'hub').length,
        blog: architecture.pages.filter((p) => p.type === 'blog').length,
      },
    };
  }
}
