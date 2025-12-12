/**
 * SEO Content Generation Functions
 *
 * Multi-step generation process:
 * 1. Generate site architecture (URLs, structure, internal linking)
 * 2. Generate content for each page (2000-3500 words)
 * 3. Generate design system
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  BusinessInput,
  SiteArchitecture,
  PageDefinition,
  PageContent,
  DesignSystem,
  getSEOArchitecturePrompt,
  getPageContentPrompt,
  getBlogPostPrompt,
  getDesignSystemPrompt,
} from './seo-prompts.js';
import type {
  SiteConfig,
  GeneratedFile,
  GeneratedSiteContent,
} from './react-generation-prompts.js';
import {
  businessInputToSiteConfig,
  getNextJSGenerationPrompt,
  getContentGenerationPrompt,
} from './react-generation-prompts.js';
import {
  getAllGenerationPrompts,
  businessInputToSiteConfig as comprehensiveBusinessInputToSiteConfig,
  type SiteConfig as ComprehensiveSiteConfig,
  type GeneratedFile as ComprehensiveGeneratedFile,
} from './nextjs-comprehensive-prompt.js';

const geminiApiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(geminiApiKey!);

// Gemini 2.5 Pro for complex generation
const jsonModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig: {
    responseMimeType: 'application/json',
    maxOutputTokens: 65536,
  },
});

// Flash model for simpler/faster tasks
const flashJsonModel = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    maxOutputTokens: 8192,
  },
});

// Large output model for Next.js project generation (uses 2M context)
const largeOutputModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig: {
    responseMimeType: 'application/json',
    maxOutputTokens: 131072, // Maximum output for large projects
    temperature: 0.7,
  },
});

/**
 * Clean JSON string from LLM output
 */
function cleanJsonString(text: string): string {
  return text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/,(\s*[}\]])/g, '$1')
    .replace(/^\uFEFF/, '')
    .trim();
}

/**
 * Generate JSON with retry logic
 */
async function generateJSON<T>(
  prompt: string,
  useFlash = false,
  maxRetries = 2
): Promise<T> {
  const model = useFlash ? flashJsonModel : jsonModel;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const cleanedText = cleanJsonString(text);
      return JSON.parse(cleanedText) as T;
    } catch (error: any) {
      lastError = error;
      console.error(`[SEO Gen] JSON parse attempt ${attempt + 1} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(`Failed to generate valid JSON: ${lastError?.message}`);
}

/**
 * STEP 1: Generate Site Architecture
 *
 * Creates the complete URL structure, hub-and-spoke model,
 * internal linking strategy, sitemap, and robots.txt
 */
export async function generateSiteArchitecture(
  input: BusinessInput
): Promise<SiteArchitecture> {
  console.log(`[SEO Gen] Generating site architecture for ${input.business_name}...`);
  const startTime = Date.now();

  const prompt = getSEOArchitecturePrompt(input);
  const architecture = await generateJSON<SiteArchitecture>(prompt);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[SEO Gen] Architecture generated in ${duration}s - ${architecture.pages.length} pages defined`);

  return architecture;
}

/**
 * STEP 2: Generate Content for a Single Page
 *
 * Creates 2,000-3,500 word SEO-optimized content
 */
export async function generatePageContent(
  input: BusinessInput,
  page: PageDefinition,
  allPages: PageDefinition[]
): Promise<PageContent> {
  console.log(`[SEO Gen] Generating content for ${page.slug}...`);
  const startTime = Date.now();

  const prompt = getPageContentPrompt(input, page, allPages);
  const content = await generateJSON<PageContent>(prompt);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[SEO Gen] Content generated for ${page.slug} in ${duration}s - ${content.wordCount} words`);

  return content;
}

/**
 * STEP 2B: Generate Content for Multiple Pages in Batch
 *
 * Generates content for up to 5 pages at once to reduce API calls
 */
export async function generateBatchPageContent(
  input: BusinessInput,
  pages: PageDefinition[],
  allPages: PageDefinition[]
): Promise<PageContent[]> {
  console.log(`[SEO Gen] Batch generating content for ${pages.length} pages...`);
  const startTime = Date.now();

  // Build combined prompt
  const pagesInfo = pages.map((page, idx) => {
    const relatedPages = allPages
      .filter(p => page.internalLinksTo.includes(p.slug))
      .slice(0, 3)
      .map(p => `${p.slug}: "${p.title}"`)
      .join(', ');

    return `
PAGE ${idx + 1}:
- URL: ${page.slug}
- Type: ${page.type}
- Title: ${page.title}
- H1: ${page.h1}
- Keywords: ${page.targetKeywords.join(', ')}
- Links To: ${relatedPages}
- Target Words: ${page.expectedWordCount}`;
  }).join('\n');

  const prompt = `You are an expert SEO copywriter. Generate complete, SEO-optimized content for these ${pages.length} pages:

BUSINESS:
- Name: ${input.business_name}
- Niche: ${input.niche}
- City: ${input.city}, ${input.state}
- Phone: ${input.phone}
- Address: ${input.address}
- Services: ${input.services.join(', ')}
- Year Established: ${input.year_established}

PAGES TO GENERATE:
${pagesInfo}

FOR EACH PAGE, GENERATE:
1. metaTitle (50-60 chars with primary keyword)
2. metaDescription (150-160 chars)
3. h1 (optimized heading)
4. sections (array of H2/H3 sections with full HTML content)
5. faqSection (8-12 FAQs with detailed answers)
6. schemaMarkup (LocalBusiness, FAQPage, BreadcrumbList)
7. wordCount (actual count)
8. internalLinks (with anchor text)

CONTENT REQUIREMENTS:
- Each page should have ${pages[0]?.expectedWordCount || 2000}+ words
- Use proper heading hierarchy (H1 > H2 > H3)
- Include internal links using [LINK:/slug:anchor text] format
- Reference ${input.city} and local areas naturally
- Include CTAs with phone number ${input.phone}
- Write in professional but approachable tone

Return as JSON array:
{
  "pages": [
    {
      "slug": "/...",
      "metaTitle": "...",
      "metaDescription": "...",
      "h1": "...",
      "sections": [
        {"heading": "...", "headingLevel": "h2", "content": "<p>...</p>", "keywords": [...]}
      ],
      "faqSection": [{"question": "...", "answer": "..."}],
      "schemaMarkup": {...},
      "wordCount": 2500,
      "internalLinks": [{"targetSlug": "/...", "anchorText": "...", "anchorType": "primary"}]
    }
  ]
}`;

  const result = await generateJSON<{ pages: PageContent[] }>(prompt);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalWords = result.pages.reduce((sum, p) => sum + (p.wordCount || 0), 0);
  console.log(`[SEO Gen] Batch content generated in ${duration}s - ${result.pages.length} pages, ${totalWords} total words`);

  return result.pages;
}

/**
 * STEP 2C: Generate Blog Post Content
 */
export async function generateBlogPost(
  input: BusinessInput,
  postType: 'how_to' | 'cost_guide' | 'listicle' | 'comparison' | 'local_guide',
  topic: string,
  targetKeywords: string[]
): Promise<PageContent> {
  console.log(`[SEO Gen] Generating ${postType} blog post: ${topic}...`);
  const startTime = Date.now();

  const prompt = getBlogPostPrompt(input, postType, topic, targetKeywords);
  const content = await generateJSON<PageContent>(prompt);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[SEO Gen] Blog post generated in ${duration}s - ${content.wordCount} words`);

  return content;
}

/**
 * STEP 3: Generate Design System
 */
export async function generateDesignSystem(
  input: BusinessInput
): Promise<DesignSystem> {
  console.log(`[SEO Gen] Generating design system for ${input.niche} business...`);
  const startTime = Date.now();

  const prompt = getDesignSystemPrompt(input);
  const design = await generateJSON<DesignSystem>(prompt, true); // Use flash for speed

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[SEO Gen] Design system generated in ${duration}s`);

  return design;
}

/**
 * Generate All Page Content in Parallel Batches
 *
 * Splits pages into batches of 3-5 and generates in parallel
 */
export async function generateAllContent(
  input: BusinessInput,
  architecture: SiteArchitecture,
  onProgress?: (completed: number, total: number, currentPage: string) => void
): Promise<PageContent[]> {
  const allPages = architecture.pages;
  const batchSize = 3; // Pages per batch
  const batches: PageDefinition[][] = [];

  // Split into batches
  for (let i = 0; i < allPages.length; i += batchSize) {
    batches.push(allPages.slice(i, i + batchSize));
  }

  console.log(`[SEO Gen] Generating content for ${allPages.length} pages in ${batches.length} batches...`);
  const startTime = Date.now();

  const allContent: PageContent[] = [];
  let completed = 0;

  // Process batches sequentially (to avoid rate limits)
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const batchPageNames = batch.map(p => p.slug).join(', ');

    console.log(`[SEO Gen] Processing batch ${i + 1}/${batches.length}: ${batchPageNames}`);

    try {
      const batchContent = await generateBatchPageContent(input, batch, allPages);
      allContent.push(...batchContent);

      completed += batch.length;
      if (onProgress) {
        onProgress(completed, allPages.length, batch[batch.length - 1].slug);
      }
    } catch (error: any) {
      console.error(`[SEO Gen] Batch ${i + 1} failed:`, error.message);
      // Continue with empty content for failed pages
      batch.forEach(page => {
        allContent.push({
          slug: page.slug,
          metaTitle: page.title,
          metaDescription: `${page.title} - ${input.business_name} in ${input.city}`,
          h1: page.h1,
          sections: [{
            heading: page.title,
            headingLevel: 'h2',
            content: `<p>Content generation failed. Please regenerate.</p>`,
            keywords: page.targetKeywords
          }],
          faqSection: [],
          schemaMarkup: {},
          wordCount: 0,
          internalLinks: []
        });
      });
    }

    // Small delay between batches to respect rate limits
    if (i < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalWords = allContent.reduce((sum, p) => sum + (p.wordCount || 0), 0);
  console.log(`[SEO Gen] All content generated in ${duration}s - ${allContent.length} pages, ${totalWords} total words`);

  return allContent;
}

/**
 * Full SEO Website Generation Pipeline
 *
 * Orchestrates the complete generation process:
 * 1. Site architecture
 * 2. Design system
 * 3. All page content
 */
export async function generateFullSEOWebsite(
  input: BusinessInput,
  onProgress?: (step: string, detail: string) => void
): Promise<{
  architecture: SiteArchitecture;
  designSystem: DesignSystem;
  content: PageContent[];
  stats: {
    totalPages: number;
    totalWords: number;
    generationTime: string;
  };
}> {
  console.log(`[SEO Gen] Starting full website generation for ${input.business_name}...`);
  const overallStart = Date.now();

  // Step 1: Generate Architecture
  if (onProgress) onProgress('architecture', 'Planning site structure and URLs...');
  const architecture = await generateSiteArchitecture(input);

  // Step 2: Generate Design System (parallel with step 3)
  if (onProgress) onProgress('design', 'Creating visual design system...');
  const designPromise = generateDesignSystem(input);

  // Step 3: Generate All Content
  if (onProgress) onProgress('content', `Generating ${architecture.pages.length} pages...`);
  const content = await generateAllContent(
    input,
    architecture,
    (completed, total, currentPage) => {
      if (onProgress) {
        onProgress('content', `Generated ${completed}/${total} pages (${currentPage})`);
      }
    }
  );

  // Wait for design system
  const designSystem = await designPromise;

  const totalWords = content.reduce((sum, p) => sum + (p.wordCount || 0), 0);
  const generationTime = ((Date.now() - overallStart) / 1000).toFixed(1);

  console.log(`[SEO Gen] COMPLETE - ${content.length} pages, ${totalWords} words in ${generationTime}s`);

  return {
    architecture,
    designSystem,
    content,
    stats: {
      totalPages: content.length,
      totalWords,
      generationTime: `${generationTime}s`
    }
  };
}

// =====================================================
// REACT/NEXT.JS PROJECT GENERATION
// =====================================================

/**
 * Generate complete Next.js project files
 *
 * Uses Gemini 2.5 Pro's large context to generate
 * a production-ready Next.js 14 application with:
 * - TypeScript components
 * - Tailwind CSS styling
 * - SEO-optimized pages
 * - Docker/Cloud Run deployment config
 */
export async function generateNextJSProject(
  input: BusinessInput,
  onProgress?: (step: string, detail: string) => void
): Promise<{
  files: GeneratedFile[];
  stats: {
    totalFiles: number;
    generationTime: string;
  };
}> {
  console.log(`[React Gen] Starting Next.js project generation for ${input.business_name}...`);
  const startTime = Date.now();

  // Convert BusinessInput to SiteConfig
  const config = businessInputToSiteConfig(input);

  // Step 1: Generate site content data first (services, neighborhoods, etc.)
  if (onProgress) onProgress('content', 'Generating site content and data...');

  const contentPrompt = getContentGenerationPrompt(config);
  console.log('[React Gen] Generating site content data...');

  let siteContent: GeneratedSiteContent;
  try {
    const contentResult = await largeOutputModel.generateContent(contentPrompt);
    const contentText = cleanJsonString(contentResult.response.text());
    siteContent = JSON.parse(contentText) as GeneratedSiteContent;
    console.log(`[React Gen] Content data generated: ${siteContent.services?.length || 0} services, ${siteContent.neighborhoods?.length || 0} neighborhoods`);
  } catch (error: any) {
    console.error('[React Gen] Content generation failed:', error.message);
    throw new Error(`Failed to generate site content: ${error.message}`);
  }

  // Step 2: Generate the full Next.js project
  if (onProgress) onProgress('project', 'Generating Next.js project files...');

  const projectPrompt = getNextJSGenerationPrompt(config);
  console.log('[React Gen] Generating Next.js project structure...');

  let projectFiles: GeneratedFile[];
  try {
    const projectResult = await largeOutputModel.generateContent(projectPrompt);
    const projectText = cleanJsonString(projectResult.response.text());
    const projectData = JSON.parse(projectText) as { files: GeneratedFile[] };
    projectFiles = projectData.files;
    console.log(`[React Gen] Generated ${projectFiles.length} project files`);
  } catch (error: any) {
    console.error('[React Gen] Project generation failed:', error.message);
    throw new Error(`Failed to generate Next.js project: ${error.message}`);
  }

  // Step 3: Inject generated content into data files
  if (onProgress) onProgress('inject', 'Injecting content into data files...');

  projectFiles = injectContentIntoDataFiles(projectFiles, siteContent, config);

  const generationTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[React Gen] COMPLETE - ${projectFiles.length} files in ${generationTime}s`);

  return {
    files: projectFiles,
    stats: {
      totalFiles: projectFiles.length,
      generationTime: `${generationTime}s`,
    },
  };
}

/**
 * Generate content data files separately (for incremental updates)
 */
export async function generateNextJSContentData(
  input: BusinessInput
): Promise<GeneratedSiteContent> {
  const config = businessInputToSiteConfig(input);
  const prompt = getContentGenerationPrompt(config);

  console.log(`[React Gen] Generating content data for ${config.businessName}...`);
  const startTime = Date.now();

  const result = await largeOutputModel.generateContent(prompt);
  const text = cleanJsonString(result.response.text());
  const content = JSON.parse(text) as GeneratedSiteContent;

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[React Gen] Content data generated in ${duration}s`);

  return content;
}

/**
 * Inject generated content into project data files
 */
function injectContentIntoDataFiles(
  files: GeneratedFile[],
  content: GeneratedSiteContent,
  config: SiteConfig
): GeneratedFile[] {
  // Find and update data files with generated content
  const dataFilePaths = {
    services: 'src/data/services.ts',
    neighborhoods: 'src/data/neighborhoods.ts',
    reviews: 'src/data/reviews.ts',
    faqs: 'src/data/faqs.ts',
    blogPosts: 'src/data/blog-posts.ts',
  };

  return files.map(file => {
    // Update services data file
    if (file.path === dataFilePaths.services && content.services) {
      return {
        ...file,
        content: generateServicesDataFile(content.services),
      };
    }

    // Update neighborhoods data file
    if (file.path === dataFilePaths.neighborhoods && content.neighborhoods) {
      return {
        ...file,
        content: generateNeighborhoodsDataFile(content.neighborhoods),
      };
    }

    // Update reviews data file
    if (file.path === dataFilePaths.reviews && content.reviews) {
      return {
        ...file,
        content: generateReviewsDataFile(content.reviews),
      };
    }

    // Update FAQs data file
    if (file.path === dataFilePaths.faqs && content.faqs) {
      return {
        ...file,
        content: generateFAQsDataFile(content.faqs),
      };
    }

    // Update blog posts data file
    if (file.path === dataFilePaths.blogPosts && content.blogPosts) {
      return {
        ...file,
        content: generateBlogPostsDataFile(content.blogPosts),
      };
    }

    // Update config file with business info
    if (file.path === 'src/lib/config.ts') {
      return {
        ...file,
        content: generateConfigFile(config),
      };
    }

    return file;
  });
}

/**
 * Generate services.ts data file
 */
function generateServicesDataFile(services: any[]): string {
  return `import { Service } from '@/types';

export const services: Service[] = ${JSON.stringify(services, null, 2)};

export function getServiceBySlug(slug: string): Service | undefined {
  return services.find(s => s.slug === slug);
}

export function getServiceById(id: string): Service | undefined {
  return services.find(s => s.id === id);
}

export function getRelatedServices(serviceId: string, limit = 3): Service[] {
  const service = getServiceById(serviceId);
  if (!service) return [];
  return service.relatedServices
    .map(id => getServiceById(id))
    .filter((s): s is Service => s !== undefined)
    .slice(0, limit);
}
`;
}

/**
 * Generate neighborhoods.ts data file
 */
function generateNeighborhoodsDataFile(neighborhoods: any[]): string {
  return `import { Neighborhood } from '@/types';

export const neighborhoods: Neighborhood[] = ${JSON.stringify(neighborhoods, null, 2)};

export function getNeighborhoodBySlug(slug: string): Neighborhood | undefined {
  return neighborhoods.find(n => n.slug === slug);
}

export function getNeighborhoodById(id: string): Neighborhood | undefined {
  return neighborhoods.find(n => n.id === id);
}

export function getNearbyNeighborhoods(neighborhoodId: string, limit = 3): Neighborhood[] {
  const neighborhood = getNeighborhoodById(neighborhoodId);
  if (!neighborhood) return [];
  return neighborhood.nearbyNeighborhoods
    .map(id => getNeighborhoodById(id))
    .filter((n): n is Neighborhood => n !== undefined)
    .slice(0, limit);
}
`;
}

/**
 * Generate reviews.ts data file
 */
function generateReviewsDataFile(reviews: any[]): string {
  return `import { Review } from '@/types';

export const reviews: Review[] = ${JSON.stringify(reviews, null, 2)};

export function getReviewsByRating(minRating = 4): Review[] {
  return reviews.filter(r => r.rating >= minRating);
}

export function getReviewsByService(serviceId: string): Review[] {
  return reviews.filter(r => r.serviceType === serviceId);
}

export function getAverageRating(): number {
  if (reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}
`;
}

/**
 * Generate faqs.ts data file
 */
function generateFAQsDataFile(faqs: any[]): string {
  return `import { FAQ } from '@/types';

export const faqs: FAQ[] = ${JSON.stringify(faqs, null, 2)};

export function getFAQsByCategory(category: string): FAQ[] {
  return faqs.filter(f => f.category === category);
}

export function getGeneralFAQs(limit = 10): FAQ[] {
  return faqs.filter(f => !f.category || f.category === 'general').slice(0, limit);
}
`;
}

/**
 * Generate blog-posts.ts data file
 */
function generateBlogPostsDataFile(posts: any[]): string {
  return `import { BlogPost } from '@/types';

export const blogPosts: BlogPost[] = ${JSON.stringify(posts, null, 2)};

export function getPostBySlug(slug: string): BlogPost | undefined {
  return blogPosts.find(p => p.slug === slug);
}

export function getRecentPosts(limit = 5): BlogPost[] {
  return [...blogPosts]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}

export function getPostsByCategory(category: string): BlogPost[] {
  return blogPosts.filter(p => p.category === category);
}

export function getRelatedPosts(postId: string, limit = 3): BlogPost[] {
  const post = blogPosts.find(p => p.id === postId);
  if (!post?.relatedPosts) return [];
  return post.relatedPosts
    .map(id => blogPosts.find(p => p.id === id))
    .filter((p): p is BlogPost => p !== undefined)
    .slice(0, limit);
}
`;
}

/**
 * Generate config.ts file with business info
 */
function generateConfigFile(config: SiteConfig): string {
  return `import { SiteConfig } from '@/types';

export const siteConfig: SiteConfig = {
  businessName: '${config.businessName}',
  niche: '${config.niche}',
  nicheSlug: '${config.nicheSlug}',
  city: '${config.city}',
  citySlug: '${config.citySlug}',
  state: '${config.state}',
  phone: '${config.phone}',
  phoneFormatted: '${config.phone}',
  email: '${config.email}',

  address: {
    street: '${config.address.street}',
    city: '${config.address.city}',
    state: '${config.address.state}',
    zip: '${config.address.zip}',
    full: '${config.address.street}, ${config.address.city}, ${config.address.state} ${config.address.zip}',
  },

  coordinates: {
    lat: ${config.coordinates?.lat || 0},
    lng: ${config.coordinates?.lng || 0},
  },

  googleMapsEmbedUrl: '${config.googleMapsEmbedUrl || ''}',
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  googlePlaceId: '${config.googlePlaceId || ''}',

  domain: '${config.domain || ''}',
  yearEstablished: ${config.yearEstablished},
  licenseNumber: '${config.licenseNumber || ''}',

  businessHours: {
    monday: { open: '07:00', close: '19:00' },
    tuesday: { open: '07:00', close: '19:00' },
    wednesday: { open: '07:00', close: '19:00' },
    thursday: { open: '07:00', close: '19:00' },
    friday: { open: '07:00', close: '19:00' },
    saturday: { open: '08:00', close: '17:00' },
    sunday: 'closed',
  },

  socialLinks: {},

  branding: {
    primaryColor: '${config.primaryColor}',
    secondaryColor: '${config.secondaryColor}',
    logoUrl: '/images/logo.svg',
  },
};

export const getFullUrl = (path: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || \`https://\${siteConfig.domain}\`;
  return \`\${baseUrl}\${path}\`;
};

export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\\D/g, '');
  return \`+1\${cleaned}\`;
};

export const getPhoneLink = (): string => {
  return \`tel:\${formatPhone(siteConfig.phone)}\`;
};
`;
}

// =====================================================
// COMPREHENSIVE MULTI-STEP NEXT.JS GENERATION
// =====================================================

/**
 * Generate complete Next.js 14 project using multi-step comprehensive prompts
 *
 * This function uses the comprehensive prompt system to generate a production-ready
 * Next.js 14 application in 13 distinct steps:
 * 1. Configuration files (package.json, tsconfig.json, etc.) - STATIC TEMPLATE
 * 2. Docker & CI/CD files - STATIC TEMPLATE
 * 3. Core Types - STATIC TEMPLATE
 * 4. Library files (config, utils, seo, schema) - STATIC TEMPLATE
 * 5. Data files (services, neighborhoods, reviews, faqs) - AI GENERATED
 * 6. UI components - AI GENERATED
 * 7. Layout components (Header, Footer, Navigation, etc.) - AI GENERATED
 * 8. Section components (Hero, TrustBar, ServicesGrid, etc.) - AI GENERATED
 * 9. SEO components (Schema markup) - AI GENERATED
 * 10. Form components - AI GENERATED
 * 11. App pages (layout, homepage, about, etc.) - AI GENERATED
 * 12. Dynamic pages (services/[slug], locations/[slug]) - AI GENERATED
 * 13. API routes - STATIC TEMPLATE
 */
export async function generateNextJSProjectComprehensive(
  input: BusinessInput,
  onProgress?: (step: number, totalSteps: number, stepName: string, detail: string) => void
): Promise<{
  files: ComprehensiveGeneratedFile[];
  stats: {
    totalFiles: number;
    generationTime: string;
    stepsCompleted: number;
  };
}> {
  console.log(`[Comprehensive Gen] Starting multi-step Next.js generation for ${input.business_name}...`);
  const overallStart = Date.now();

  // Convert BusinessInput to comprehensive SiteConfig
  const config = comprehensiveBusinessInputToSiteConfig(input);

  // Get all generation prompts (includes both static templates and AI prompts)
  const steps = getAllGenerationPrompts(config);
  const totalSteps = steps.length;

  const allFiles: ComprehensiveGeneratedFile[] = [];
  let completedSteps = 0;

  // Process each step
  for (const stepDef of steps) {
    const { step, name, prompt, isStaticTemplate, staticFiles } = stepDef;
    const stepStart = Date.now();
    console.log(`[Comprehensive Gen] Step ${step}/${totalSteps}: ${name}${isStaticTemplate ? ' (template)' : ' (AI)'}...`);

    if (onProgress) {
      onProgress(step, totalSteps, name, isStaticTemplate
        ? `Applying ${name.toLowerCase()} template...`
        : `Generating ${name.toLowerCase()} with AI...`);
    }

    try {
      let stepFiles: ComprehensiveGeneratedFile[] = [];

      if (isStaticTemplate && staticFiles) {
        // Use pre-built templates directly (no AI call needed)
        stepFiles = staticFiles;
        console.log(`[Comprehensive Gen] Step ${step} (template): ${stepFiles.length} files added instantly`);
      } else if (prompt) {
        // Use AI to generate content
        const result = await largeOutputModel.generateContent(prompt);
        const text = cleanJsonString(result.response.text());
        const data = JSON.parse(text) as { files: ComprehensiveGeneratedFile[] };

        if (data.files && Array.isArray(data.files)) {
          // Validate files
          for (const file of data.files) {
            if (file.path && file.content && file.content.length > 10) {
              stepFiles.push(file);
            } else {
              console.warn(`[Comprehensive Gen] Skipping invalid file in step ${step}: ${file.path || 'no path'}`);
            }
          }
        } else {
          console.error(`[Comprehensive Gen] Step ${step} returned invalid data structure`);
        }

        console.log(`[Comprehensive Gen] Step ${step} (AI): ${stepFiles.length} files in ${((Date.now() - stepStart) / 1000).toFixed(1)}s`);
      }

      // Add files from this step
      allFiles.push(...stepFiles);
      completedSteps++;

      if (onProgress) {
        onProgress(step, totalSteps, name, `Completed ${name} (${stepFiles.length} files)`);
      }

    } catch (error: any) {
      console.error(`[Comprehensive Gen] Step ${step} (${name}) failed:`, error.message);

      // Continue with other steps but log the failure
      if (onProgress) {
        onProgress(step, totalSteps, name, `Failed: ${error.message}`);
      }

      // For critical early steps (templates), throw the error
      if (isStaticTemplate) {
        throw new Error(`Critical template step ${step} (${name}) failed: ${error.message}`);
      }
    }

    // Small delay between AI steps to respect rate limits (skip for templates)
    if (!isStaticTemplate && step < totalSteps) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  const generationTime = ((Date.now() - overallStart) / 1000).toFixed(1);
  console.log(`[Comprehensive Gen] COMPLETE - ${allFiles.length} files in ${generationTime}s (${completedSteps}/${totalSteps} steps)`);

  return {
    files: allFiles,
    stats: {
      totalFiles: allFiles.length,
      generationTime: `${generationTime}s`,
      stepsCompleted: completedSteps,
    },
  };
}

/**
 * Generate a single step of the comprehensive Next.js project
 *
 * Useful for retrying failed steps or generating specific parts
 */
export async function generateNextJSProjectStep(
  input: BusinessInput,
  stepNumber: number
): Promise<ComprehensiveGeneratedFile[]> {
  const config = comprehensiveBusinessInputToSiteConfig(input);
  const prompts = getAllGenerationPrompts(config);

  const step = prompts.find(p => p.step === stepNumber);
  if (!step) {
    throw new Error(`Invalid step number: ${stepNumber}. Valid steps are 1-${prompts.length}`);
  }

  console.log(`[Comprehensive Gen] Generating step ${stepNumber}: ${step.name}...`);
  const startTime = Date.now();

  const result = await largeOutputModel.generateContent(step.prompt);
  const text = cleanJsonString(result.response.text());
  const data = JSON.parse(text) as { files: ComprehensiveGeneratedFile[] };

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Comprehensive Gen] Step ${stepNumber} complete: ${data.files?.length || 0} files in ${duration}s`);

  return data.files || [];
}

// Re-export types for convenience
export { SiteConfig, GeneratedFile, GeneratedSiteContent, businessInputToSiteConfig };
export { ComprehensiveSiteConfig, ComprehensiveGeneratedFile };
