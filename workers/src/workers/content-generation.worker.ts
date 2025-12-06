import { BaseWorker } from '../lib/worker-base.js';
import { generatePageContent } from '../lib/gemini.js';
import { getContentIndex, savePageContent, supabase } from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';

export class ContentGenerationWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'Content Generation',
      jobTypes: ['content_generation', 'full_generation'],
      pollInterval: 5000,
      maxConcurrent: 2, // Lower concurrency due to API rate limits
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const business = job.input_payload.business;

    // Step 1: Get content index
    this.currentStep = 'Loading content plan';
    await this.progress(job.id, this.currentStep, 0, 1);

    const contentIndex = await getContentIndex(job.website_id);
    if (!contentIndex || contentIndex.length === 0) {
      throw new Error('Content index not found. Run content architecture first.');
    }

    // Filter to pages that need content
    const pagesToGenerate = contentIndex.filter(
      (page) => page.content_status === 'planned'
    );

    const totalPages = pagesToGenerate.length;
    let generatedCount = 0;
    let totalWordCount = 0;

    console.log(`[Content Generation] Generating ${totalPages} pages...`);

    // Generate content for each page
    for (const page of pagesToGenerate) {
      this.currentStep = `Generating: ${page.title}`;
      await this.progress(job.id, this.currentStep, generatedCount, totalPages);

      try {
        // Update content index to 'generating'
        await supabase
          .from('content_index')
          .update({ content_status: 'generating' })
          .eq('id', page.id);

        // Generate content with Gemini
        const content = await generatePageContent(
          business.businessName,
          business.niche || business.businessType,
          {
            slug: page.page_slug,
            type: page.page_type,
            title: page.title,
            targetKeywords: page.target_keywords,
            internalLinksTo: page.internal_links_to,
          },
          {
            phone: business.phone,
            email: business.email,
            address: business.address,
            services: business.services,
            yearsInBusiness: business.yearsInBusiness,
          }
        );

        // Save page content
        await savePageContent(job.website_id, page.id, {
          html_content: content.htmlContent,
          meta_title: content.metaTitle,
          meta_description: content.metaDescription,
          schema_markup: content.schemaMarkup,
          word_count: content.wordCount,
        });

        totalWordCount += content.wordCount;
        generatedCount++;

        console.log(
          `[Content Generation] Generated ${page.page_slug} (${content.wordCount} words)`
        );

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[Content Generation] Failed to generate ${page.page_slug}:`, error);
        // Continue with other pages
      }
    }

    this.currentStep = 'Content generation complete';
    await this.progress(job.id, this.currentStep, generatedCount, totalPages);

    return {
      pagesGenerated: generatedCount,
      totalPages,
      totalWordCount,
      averageWordCount: Math.round(totalWordCount / generatedCount) || 0,
    };
  }
}
