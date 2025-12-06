import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const geminiApiKey = process.env.GEMINI_API_KEY;
console.log('[Gemini] API key configured:', !!geminiApiKey);

const genAI = new GoogleGenerativeAI(geminiApiKey!);

// Use Gemini 2.0 Flash for fast, high-quality generation
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

/**
 * Generate text content with Gemini
 */
export async function generateText(prompt: string): Promise<string> {
  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/**
 * Generate JSON content with Gemini
 */
export async function generateJSON<T>(prompt: string): Promise<T> {
  const fullPrompt = `${prompt}

IMPORTANT: Respond with valid JSON only. No markdown, no code blocks, just the raw JSON object.`;

  const result = await model.generateContent(fullPrompt);
  const text = result.response.text();

  // Clean up response - remove any markdown code blocks
  const cleanedText = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  return JSON.parse(cleanedText) as T;
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
