import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const geminiApiKey = process.env.GEMINI_API_KEY;
console.log('[Gemini] API key configured:', !!geminiApiKey);

const genAI = new GoogleGenerativeAI(geminiApiKey!);

// Use Gemini 2.5 Pro for maximum capability - 1M input, 65K output tokens
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

// Model configured for JSON output with high token limit
const jsonModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
  generationConfig: {
    responseMimeType: 'application/json',
    maxOutputTokens: 65536,
  },
});

// Fast model for simpler tasks
const flashModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Generate text content with Gemini
 */
export async function generateText(prompt: string): Promise<string> {
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/**
 * Clean and fix common JSON issues from LLM output
 */
function cleanJsonString(text: string): string {
  let cleaned = text
    // Remove markdown code blocks
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Remove trailing commas before ] or }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Remove any BOM or invisible characters at the start
  cleaned = cleaned.replace(/^\uFEFF/, '');

  return cleaned;
}

/**
 * Generate JSON content with Gemini
 */
export async function generateJSON<T>(prompt: string, maxRetries = 2): Promise<T> {
  const fullPrompt = `${prompt}

CRITICAL: You must respond with valid JSON only. No markdown, no code blocks, no trailing commas, just the raw JSON object. Ensure all arrays and objects are properly closed.`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Use JSON-configured model
      const result = await jsonModel.generateContent(fullPrompt);
      const text = result.response.text();

      // Clean up response
      const cleanedText = cleanJsonString(text);

      // Try to parse
      return JSON.parse(cleanedText) as T;
    } catch (error: any) {
      lastError = error;
      console.error(`[Gemini] JSON parse attempt ${attempt + 1} failed:`, error.message);

      if (attempt < maxRetries) {
        console.log(`[Gemini] Retrying JSON generation...`);
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // If all retries failed, throw with context
  throw new Error(`Failed to generate valid JSON after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * SEO Research: Analyze niche and generate keyword strategy
 */
export async function researchSEO(
  businessName: string,
  niche: string,
  location: string,
  services: string[]
): Promise<{
  keywords: { primary: string[]; secondary: string[]; longtail: string[] };
  competitors: Array<{ url: string; strengths: string[]; weaknesses: string[] }>;
  searchIntent: { informational: string[]; transactional: string[]; navigational: string[] };
  contentGaps: string[];
}> {
  const prompt = `You are an expert SEO strategist. Analyze the following local business and create a comprehensive SEO strategy:

Business: ${businessName}
Niche/Industry: ${niche}
Location: ${location}
Services: ${services.join(', ')}

Generate a detailed SEO research report with:

1. Keywords (categorized):
   - Primary keywords (5-10): High-volume, direct service keywords
   - Secondary keywords (10-15): Related terms, variations
   - Long-tail keywords (15-20): Specific phrases, questions, local modifiers

2. Competitor Analysis (3-5 competitors):
   - Likely competitor websites in this niche/location
   - Their strengths (what they do well for SEO)
   - Their weaknesses (opportunities for us)

3. Search Intent Mapping:
   - Informational queries (people seeking information)
   - Transactional queries (people ready to buy/hire)
   - Navigational queries (people looking for specific businesses)

4. Content Gaps:
   - Topics competitors aren't covering well
   - Underserved search queries
   - Local content opportunities

Return as JSON with this structure:
{
  "keywords": {
    "primary": ["keyword1", "keyword2"],
    "secondary": ["keyword1", "keyword2"],
    "longtail": ["keyword phrase 1", "keyword phrase 2"]
  },
  "competitors": [
    {"url": "example.com", "strengths": ["strength1"], "weaknesses": ["weakness1"]}
  ],
  "searchIntent": {
    "informational": ["query1", "query2"],
    "transactional": ["query1", "query2"],
    "navigational": ["query1", "query2"]
  },
  "contentGaps": ["gap1", "gap2"]
}`;

  return generateJSON(prompt);
}

/**
 * Content Architecture: Plan site structure and internal linking
 */
export async function planContentArchitecture(
  businessName: string,
  niche: string,
  services: string[],
  targetCities: Array<{ name: string; state: string }>,
  keywords: { primary: string[]; secondary: string[]; longtail: string[] }
): Promise<{
  pages: Array<{
    slug: string;
    type: 'home' | 'location' | 'service' | 'blog' | 'hub' | 'about' | 'contact';
    title: string;
    targetKeywords: string[];
    internalLinksTo: string[];
  }>;
  hubAndSpoke: {
    hubs: string[];
    spokeMapping: Record<string, string[]>;
  };
}> {
  const prompt = `You are an expert content strategist specializing in local SEO. Create a comprehensive site architecture for:

Business: ${businessName}
Niche: ${niche}
Services: ${services.join(', ')}
Target Cities: ${targetCities.map(c => `${c.name}, ${c.state}`).join('; ')}

Available Keywords:
- Primary: ${keywords.primary.join(', ')}
- Secondary: ${keywords.secondary.join(', ')}
- Long-tail: ${keywords.longtail.join(', ')}

Create a site architecture following the hub-and-spoke content model:

1. Hub Pages (pillar content):
   - Main service pages
   - Location hub pages
   - Comprehensive guides

2. Spoke Pages (supporting content):
   - Individual city/neighborhood pages
   - Specific service variation pages
   - FAQ and how-to content

3. Internal Linking Strategy:
   - Each spoke links to its hub
   - Hubs link to related spokes
   - Cross-linking between related topics

Generate ALL pages the site should have (aim for 30-100+ pages for good SEO coverage).

Return as JSON:
{
  "pages": [
    {
      "slug": "/",
      "type": "home",
      "title": "Page Title",
      "targetKeywords": ["keyword1", "keyword2"],
      "internalLinksTo": ["/about", "/services"]
    }
  ],
  "hubAndSpoke": {
    "hubs": ["/services/plumbing", "/locations/seattle"],
    "spokeMapping": {
      "/services/plumbing": ["/services/plumbing/drain-cleaning", "/services/plumbing/water-heaters"],
      "/locations/seattle": ["/locations/seattle/ballard", "/locations/seattle/capitol-hill"]
    }
  }
}`;

  return generateJSON(prompt);
}

/**
 * Generate unique page content
 */
export async function generatePageContent(
  businessName: string,
  niche: string,
  pageInfo: {
    slug: string;
    type: string;
    title: string;
    targetKeywords: string[];
    internalLinksTo: string[];
  },
  businessDetails: {
    phone: string;
    email: string;
    address: { city: string; state: string };
    services: string[];
    yearsInBusiness?: number;
  }
): Promise<{
  htmlContent: string;
  metaTitle: string;
  metaDescription: string;
  schemaMarkup: Record<string, unknown>;
  wordCount: number;
}> {
  const prompt = `You are an expert SEO copywriter. Create compelling, SEO-optimized content for this page:

Business: ${businessName}
Industry: ${niche}
Phone: ${businessDetails.phone}
Location: ${businessDetails.address.city}, ${businessDetails.address.state}
Years in Business: ${businessDetails.yearsInBusiness || 10}

Page Details:
- URL: ${pageInfo.slug}
- Type: ${pageInfo.type}
- Title: ${pageInfo.title}
- Target Keywords: ${pageInfo.targetKeywords.join(', ')}
- Should Link To: ${pageInfo.internalLinksTo.join(', ')}

Requirements:
1. Write 800-1500 words of unique, valuable content
2. Naturally incorporate target keywords (2-3% density)
3. Include internal links using [LINK:slug:anchor text] format
4. Use proper heading hierarchy (H1, H2, H3)
5. Include a compelling call-to-action
6. Write in a professional but approachable tone
7. Include local references and specifics
8. Add trust signals (experience, certifications, reviews)

Also create:
- Meta title (50-60 chars, include primary keyword)
- Meta description (150-160 chars, compelling with keyword)
- LocalBusiness schema markup

Return as JSON:
{
  "htmlContent": "<h1>Title</h1><p>Content with [LINK:/services:our services]...</p>",
  "metaTitle": "Primary Keyword | Business Name",
  "metaDescription": "Compelling description with keywords...",
  "schemaMarkup": {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Business Name"
  },
  "wordCount": 1200
}`;

  return generateJSON(prompt);
}

/**
 * Generate unique design system
 */
export async function generateDesignSystem(
  businessName: string,
  niche: string,
  preferences?: {
    style?: 'modern' | 'classic' | 'minimal' | 'bold';
    primaryColor?: string;
  }
): Promise<{
  tailwindConfig: {
    colors: Record<string, string>;
    fontFamily: Record<string, string[]>;
  };
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    scale: number[];
  };
  componentStyles: {
    borderRadius: string;
    shadowStyle: string;
    buttonStyle: string;
  };
}> {
  const style = preferences?.style || 'modern';

  const prompt = `You are an expert web designer. Create a unique, professional design system for:

Business: ${businessName}
Industry/Niche: ${niche}
Style Preference: ${style}
${preferences?.primaryColor ? `Preferred Primary Color: ${preferences.primaryColor}` : ''}

Create a cohesive design system that:
1. Reflects the industry appropriately (e.g., plumbing = trustworthy blues, law = sophisticated neutrals)
2. Is unique and doesn't look like a template
3. Uses modern design principles
4. Is accessible (good contrast ratios)
5. Works well for a local service business

Return as JSON:
{
  "tailwindConfig": {
    "colors": {
      "primary": "#1e40af",
      "primary-light": "#3b82f6",
      "primary-dark": "#1e3a8a",
      "secondary": "#64748b",
      "accent": "#f97316",
      "background": "#ffffff",
      "surface": "#f8fafc",
      "text": "#1e293b",
      "text-muted": "#64748b"
    },
    "fontFamily": {
      "heading": ["Inter", "sans-serif"],
      "body": ["Inter", "sans-serif"]
    }
  },
  "colorPalette": {
    "primary": "#1e40af",
    "secondary": "#64748b",
    "accent": "#f97316",
    "background": "#ffffff",
    "text": "#1e293b",
    "muted": "#94a3b8"
  },
  "typography": {
    "headingFont": "Inter",
    "bodyFont": "Inter",
    "scale": [12, 14, 16, 18, 20, 24, 30, 36, 48, 60]
  },
  "componentStyles": {
    "borderRadius": "0.75rem",
    "shadowStyle": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    "buttonStyle": "rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
  }
}`;

  return generateJSON(prompt);
}

/**
 * BATCH Generate ALL page content in a single call
 * Uses Gemini 2.5 Pro's 65K output token limit to generate entire site at once
 */
export async function generateAllPagesContent(
  businessName: string,
  niche: string,
  pages: Array<{
    slug: string;
    type: string;
    title: string;
    targetKeywords: string[];
    internalLinksTo: string[];
  }>,
  businessDetails: {
    phone: string;
    email: string;
    address: { city: string; state: string };
    services: string[];
    yearsInBusiness?: number;
  }
): Promise<Array<{
  slug: string;
  htmlContent: string;
  metaTitle: string;
  metaDescription: string;
  schemaMarkup: Record<string, unknown>;
  wordCount: number;
}>> {
  // Build the page list for the prompt
  const pagesList = pages.map((p, i) => `
${i + 1}. Page: "${p.title}"
   - Slug: ${p.slug}
   - Type: ${p.type}
   - Target Keywords: ${p.targetKeywords.join(', ')}
   - Internal Links To: ${p.internalLinksTo.join(', ')}`).join('\n');

  const prompt = `You are an expert SEO copywriter. Generate complete, unique content for ALL ${pages.length} pages of this local business website in a single response.

BUSINESS DETAILS:
- Name: ${businessName}
- Industry: ${niche}
- Phone: ${businessDetails.phone}
- Email: ${businessDetails.email}
- Location: ${businessDetails.address.city}, ${businessDetails.address.state}
- Services: ${businessDetails.services.join(', ')}
- Years in Business: ${businessDetails.yearsInBusiness || 10}

PAGES TO GENERATE:
${pagesList}

REQUIREMENTS FOR EACH PAGE:
1. Write 500-1000 words of unique, valuable content (shorter for simple pages, longer for main pages)
2. Naturally incorporate target keywords
3. Include internal links using [LINK:slug:anchor text] format
4. Use proper heading hierarchy (H1, H2, H3)
5. Include compelling calls-to-action with phone number
6. Professional but approachable tone
7. Local references and specifics for ${businessDetails.address.city}
8. Trust signals (experience, reviews mentions)

FOR EACH PAGE INCLUDE:
- htmlContent: Full HTML content with headings and paragraphs
- metaTitle: 50-60 chars with primary keyword
- metaDescription: 150-160 chars
- schemaMarkup: Appropriate schema.org markup
- wordCount: Actual word count

Return as JSON array - one object per page:
{
  "pages": [
    {
      "slug": "/",
      "htmlContent": "<h1>...</h1><p>...</p>",
      "metaTitle": "...",
      "metaDescription": "...",
      "schemaMarkup": {...},
      "wordCount": 850
    },
    ...
  ]
}

Generate ALL ${pages.length} pages now:`;

  console.log(`[Gemini] Generating ${pages.length} pages in single batch call...`);
  const startTime = Date.now();

  const result = await generateJSON<{ pages: Array<{
    slug: string;
    htmlContent: string;
    metaTitle: string;
    metaDescription: string;
    schemaMarkup: Record<string, unknown>;
    wordCount: number;
  }> }>(prompt);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Gemini] Batch generation complete in ${duration}s - generated ${result.pages.length} pages`);

  return result.pages;
}

/**
 * Generate complete website in ONE call - SEO research, architecture, content, and design
 */
export async function generateCompleteWebsite(
  businessName: string,
  niche: string,
  businessDetails: {
    phone: string;
    email: string;
    address: { street?: string; city: string; state: string; zip?: string };
    services: string[];
    targetCities: Array<{ name: string; state: string }>;
    yearsInBusiness?: number;
    colorScheme?: { primary: string; secondary: string; accent: string };
  }
): Promise<{
  seoResearch: {
    keywords: { primary: string[]; secondary: string[]; longtail: string[] };
    competitors: Array<{ url: string; strengths: string[]; weaknesses: string[] }>;
    searchIntent: { informational: string[]; transactional: string[]; navigational: string[] };
    contentGaps: string[];
  };
  siteArchitecture: {
    pages: Array<{
      slug: string;
      type: string;
      title: string;
      targetKeywords: string[];
      internalLinksTo: string[];
    }>;
    hubAndSpoke: {
      hubs: string[];
      spokeMapping: Record<string, string[]>;
    };
  };
  designSystem: {
    colorPalette: Record<string, string>;
    typography: { headingFont: string; bodyFont: string };
    componentStyles: Record<string, string>;
  };
  pages: Array<{
    slug: string;
    htmlContent: string;
    metaTitle: string;
    metaDescription: string;
    schemaMarkup: Record<string, unknown>;
    wordCount: number;
  }>;
}> {
  const cityList = businessDetails.targetCities.map(c => `${c.name}, ${c.state}`).join('; ');
  const colorPref = businessDetails.colorScheme
    ? `Use these colors: Primary ${businessDetails.colorScheme.primary}, Secondary ${businessDetails.colorScheme.secondary}, Accent ${businessDetails.colorScheme.accent}`
    : 'Choose appropriate professional colors for the industry';

  const prompt = `You are an expert SEO strategist, content writer, and web designer. Generate a COMPLETE local business website in one response.

BUSINESS:
- Name: ${businessName}
- Industry/Niche: ${niche}
- Phone: ${businessDetails.phone}
- Email: ${businessDetails.email}
- Address: ${businessDetails.address.street || ''} ${businessDetails.address.city}, ${businessDetails.address.state} ${businessDetails.address.zip || ''}
- Services: ${businessDetails.services.join(', ')}
- Target Cities: ${cityList}
- Years in Business: ${businessDetails.yearsInBusiness || 10}
- Design: ${colorPref}

GENERATE THE FOLLOWING:

1. SEO RESEARCH:
   - Primary keywords (5-8)
   - Secondary keywords (8-12)
   - Long-tail keywords (10-15)
   - 3-4 competitor analysis
   - Search intent mapping
   - Content gaps to exploit

2. SITE ARCHITECTURE:
   - Create 15-25 pages covering:
     * Home page
     * About page
     * Contact page
     * Main service pages (one per service)
     * Location pages (one per target city)
     * 3-5 blog/resource pages
   - Define hub-and-spoke structure
   - Plan internal linking

3. DESIGN SYSTEM:
   - Color palette (6 colors: primary, secondary, accent, background, text, muted)
   - Typography (heading and body fonts)
   - Component styles (border radius, shadows, button style)

4. ALL PAGE CONTENT:
   For EACH page in the architecture, generate:
   - Full HTML content (400-800 words, proper H1/H2/H3 structure)
   - Meta title (50-60 chars)
   - Meta description (150-160 chars)
   - Schema markup
   - Word count
   - Use [LINK:slug:anchor text] for internal links
   - Include CTAs with phone number ${businessDetails.phone}

Return as a single JSON object:
{
  "seoResearch": {
    "keywords": { "primary": [...], "secondary": [...], "longtail": [...] },
    "competitors": [...],
    "searchIntent": { "informational": [...], "transactional": [...], "navigational": [...] },
    "contentGaps": [...]
  },
  "siteArchitecture": {
    "pages": [{ "slug": "/", "type": "home", "title": "...", "targetKeywords": [...], "internalLinksTo": [...] }, ...],
    "hubAndSpoke": { "hubs": [...], "spokeMapping": {...} }
  },
  "designSystem": {
    "colorPalette": { "primary": "#...", "secondary": "#...", "accent": "#...", "background": "#...", "text": "#...", "muted": "#..." },
    "typography": { "headingFont": "Inter", "bodyFont": "Inter" },
    "componentStyles": { "borderRadius": "0.5rem", "shadowStyle": "...", "buttonStyle": "..." }
  },
  "pages": [
    { "slug": "/", "htmlContent": "<h1>...</h1>...", "metaTitle": "...", "metaDescription": "...", "schemaMarkup": {...}, "wordCount": 650 },
    ...
  ]
}`;

  console.log(`[Gemini] Generating COMPLETE website for ${businessName} in single call...`);
  const startTime = Date.now();

  const result = await generateJSON<{
    seoResearch: any;
    siteArchitecture: any;
    designSystem: any;
    pages: any[];
  }>(prompt);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Gemini] Complete website generated in ${duration}s - ${result.pages?.length || 0} pages`);

  return result;
}

/**
 * Generate React component code
 */
export async function generateComponentCode(
  componentType: 'hero' | 'cta' | 'services' | 'testimonials' | 'features' | 'footer',
  businessInfo: {
    name: string;
    niche: string;
    phone: string;
    tagline?: string;
  },
  designSystem: {
    colorPalette: Record<string, string>;
    componentStyles: Record<string, string>;
  }
): Promise<string> {
  const prompt = `You are an expert React/TypeScript developer. Create a beautiful, production-ready ${componentType} component.

Business: ${businessInfo.name}
Industry: ${businessInfo.niche}
Phone: ${businessInfo.phone}
Tagline: ${businessInfo.tagline || `Your Trusted ${businessInfo.niche} Professionals`}

Design System:
- Colors: ${JSON.stringify(designSystem.colorPalette)}
- Styles: ${JSON.stringify(designSystem.componentStyles)}

Requirements:
1. Use React functional component with TypeScript
2. Use Tailwind CSS for styling
3. Make it responsive (mobile-first)
4. Include proper accessibility attributes
5. Use Lucide React for icons
6. Make it unique and professional - NOT a generic template
7. Include micro-interactions (hover effects, transitions)
8. Use the design system colors and styles

Return ONLY the component code, no explanation. The code should be ready to use:

import React from 'react';
import { Icon1, Icon2 } from 'lucide-react';

interface ${componentType.charAt(0).toUpperCase() + componentType.slice(1)}Props {
  // props
}

export default function ${componentType.charAt(0).toUpperCase() + componentType.slice(1)}({ ...props }: ${componentType.charAt(0).toUpperCase() + componentType.slice(1)}Props) {
  return (
    // JSX
  );
}`;

  return generateText(prompt);
}
