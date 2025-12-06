import { BaseWorker } from '../lib/worker-base.js';
import { generateDesignSystem, generateComponentCode } from '../lib/gemini.js';
import { saveDesignSystem } from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';

export class DesignGenerationWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'Design Generation',
      jobTypes: ['design_generation', 'full_generation'],
      pollInterval: 5000,
      maxConcurrent: 3,
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const totalSteps = 6;
    let completedSteps = 0;

    const business = job.input_payload.business;

    // Step 1: Generate design system
    this.currentStep = 'Generating design system';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const designSystem = await generateDesignSystem(
      business.businessName,
      business.niche || business.businessType
    );

    completedSteps++;

    // Step 2-5: Generate component variations
    const componentTypes = ['hero', 'cta', 'features', 'footer'] as const;
    const componentLibrary: Record<string, string[]> = {};

    for (const componentType of componentTypes) {
      this.currentStep = `Generating ${componentType} component`;
      await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

      try {
        const componentCode = await generateComponentCode(
          componentType,
          {
            name: business.businessName,
            niche: business.niche || business.businessType,
            phone: business.phone,
          },
          {
            colorPalette: designSystem.colorPalette,
            componentStyles: designSystem.componentStyles,
          }
        );

        componentLibrary[componentType] = [componentCode];

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Design Generation] Failed to generate ${componentType}:`, error);
        componentLibrary[componentType] = [];
      }

      completedSteps++;
    }

    // Step 6: Save design system
    this.currentStep = 'Saving design system';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const designSystemId = await saveDesignSystem(job.website_id, {
      tailwind_config: designSystem.tailwindConfig,
      color_palette: designSystem.colorPalette,
      typography: designSystem.typography,
      component_library: componentLibrary,
    });

    completedSteps++;
    await this.progress(job.id, 'Design system complete', completedSteps, totalSteps);

    return {
      designSystemId,
      colorPalette: designSystem.colorPalette,
      componentsGenerated: Object.keys(componentLibrary).length,
    };
  }
}
