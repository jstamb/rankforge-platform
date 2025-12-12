/**
 * SEO System Prompts for Lead Generation Website Builder
 *
 * Based on comprehensive local lead gen SEO requirements including:
 * - Hub & spoke site architecture
 * - 2,000-3,500 word content per page
 * - Schema markup (LocalBusiness, Service, FAQ, Breadcrumb, Review)
 * - Internal linking strategy
 */

export interface BusinessInput {
  business_name: string;
  niche: string;
  city: string;
  state: string;
  phone: string;
  address: string;
  google_maps_embed_url?: string;
  neighborhoods: string[];
  services: string[];
  business_hours: string;
  year_established: number;
  license_number?: string;
  email?: string;
}

export interface SiteArchitecture {
  pages: PageDefinition[];
  hubAndSpoke: {
    hubs: string[];
    spokeMapping: Record<string, string[]>;
  };
  internalLinkingRules: {
    homepage: string[];
    serviceHub: string[];
    cityServicePages: string[];
    neighborhoodPages: string[];
    blogPosts: string[];
  };
  sitemapEntries: SitemapEntry[];
  robotsTxt: string;
}

export interface PageDefinition {
  slug: string;
  type: 'home' | 'about' | 'contact' | 'service_hub' | 'service' | 'location_hub' | 'city_service' | 'neighborhood' | 'blog_hub' | 'blog_post' | 'reviews';
  title: string;
  h1: string;
  targetKeywords: string[];
  secondaryKeywords: string[];
  internalLinksTo: string[];
  internalLinksFrom: string[];
  priority: number; // For sitemap
  changefreq: 'daily' | 'weekly' | 'monthly';
  expectedWordCount: number;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

export interface PageContent {
  slug: string;
  metaTitle: string; // 50-60 chars
  metaDescription: string; // 150-160 chars
  h1: string;
  sections: ContentSection[];
  faqSection: FAQItem[];
  schemaMarkup: SchemaMarkup;
  wordCount: number;
  internalLinks: InternalLink[];
}

export interface ContentSection {
  heading: string;
  headingLevel: 'h2' | 'h3' | 'h4';
  content: string; // HTML content
  keywords: string[];
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface SchemaMarkup {
  localBusiness?: object;
  service?: object;
  faqPage?: object;
  breadcrumbList?: object;
  review?: object;
}

export interface InternalLink {
  targetSlug: string;
  anchorText: string;
  anchorType: 'primary' | 'partial' | 'branded' | 'generic' | 'url';
}

export interface DesignSystem {
  colorPalette: {
    primary: string;
    primaryLight: string;
    primaryDark: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    success: string;
    warning: string;
    error: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    baseFontSize: number;
    lineHeight: number;
    scale: number[];
  };
  spacing: {
    unit: number;
    scale: number[];
  };
  borderRadius: {
    small: string;
    medium: string;
    large: string;
    full: string;
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
  };
  breakpoints: {
    mobile: number;
    tablet: number;
    desktop: number;
    wide: number;
  };
}

/**
 * Generate the SEO Architecture System Prompt
 */
export function getSEOArchitecturePrompt(input: BusinessInput): string {
  return `You are an expert SEO architect specializing in local lead generation websites. Create a comprehensive site architecture for:

BUSINESS DETAILS:
- Business Name: ${input.business_name}
- Niche: ${input.niche}
- Primary City: ${input.city}, ${input.state}
- Phone: ${input.phone}
- Address: ${input.address}
- Services: ${input.services.join(', ')}
- Neighborhoods: ${input.neighborhoods.join(', ')}
- Year Established: ${input.year_established}
- Business Hours: ${input.business_hours}
${input.license_number ? `- License: ${input.license_number}` : ''}

CREATE A COMPLETE SITE ARCHITECTURE FOLLOWING THE HUB & SPOKE MODEL:

## URL STRUCTURE (lowercase, hyphens, keyword-rich, under 75 chars):
- Homepage: /
- Service pages: /services/[service-name]/
- City + Service: /[city]-[service-name]/
- Neighborhood: /[city]/[neighborhood]-[service-name]/
- Blog posts: /blog/[keyword-rich-title]/

## REQUIRED PAGES:
1. CORE PAGES:
   - Homepage (hub for city + niche)
   - About page
   - Contact page
   - Reviews page

2. SERVICES SECTION:
   - Services hub page (/services/)
   - Individual service pages for each service (${input.services.length} pages)

3. LOCATIONS SECTION:
   - Locations hub page (/locations/)
   - City + Service combination pages (${input.services.length} pages)
   - Neighborhood pages for each neighborhood + top 3 services (${input.neighborhoods.length * 3} pages)

4. BLOG SECTION:
   - Blog hub (/blog/)
   - 10 SEO-optimized blog posts:
     * 3 "How To" guides
     * 2 "Cost" guides
     * 2 "Best/Top" listicles
     * 2 "Vs" comparison posts
     * 1 comprehensive local guide

## INTERNAL LINKING STRATEGY:
1. Homepage links to: All main service pages, main locations page, blog hub, about, contact, reviews
2. Service Hub Pages link to: All city-specific service pages, 1-2 related services, homepage, 2-3 blog posts
3. City + Service Pages link to: Parent service hub, all neighborhood pages for that service, 2-3 blog posts, contact
4. Neighborhood Pages link to: Parent city + service page, 2-3 nearby neighborhoods, service hub, relevant blog
5. Blog Posts link to: Relevant service page, 2-3 related posts, neighborhood page if location-specific, homepage

## ANCHOR TEXT DISTRIBUTION:
- Primary keyword anchors: 30%
- Partial match anchors: 30%
- Branded anchors: 20%
- Generic anchors: 10%
- URL anchors: 10%

Return as JSON:
{
  "pages": [
    {
      "slug": "/",
      "type": "home",
      "title": "Expert ${input.niche} Services in ${input.city}, ${input.state}",
      "h1": "[Primary Keyword] in ${input.city} | ${input.business_name}",
      "targetKeywords": ["${input.niche} ${input.city}", "${input.city} ${input.niche}"],
      "secondaryKeywords": ["best ${input.niche} ${input.city}", "local ${input.niche}"],
      "internalLinksTo": ["/services/", "/locations/", "/about/", "/contact/"],
      "internalLinksFrom": [],
      "priority": 1.0,
      "changefreq": "weekly",
      "expectedWordCount": 3000
    }
    // ... all other pages
  ],
  "hubAndSpoke": {
    "hubs": ["/services/", "/locations/"],
    "spokeMapping": {
      "/services/": ["/services/drain-cleaning/", "/services/water-heaters/"],
      "/locations/": ["/${input.city.toLowerCase()}-drain-cleaning/"]
    }
  },
  "internalLinkingRules": {
    "homepage": ["services", "locations", "blog", "about", "contact", "reviews"],
    "serviceHub": ["cityServicePages", "relatedServices", "homepage", "blogPosts"],
    "cityServicePages": ["serviceHub", "neighborhoodPages", "blogPosts", "contact"],
    "neighborhoodPages": ["parentCityService", "nearbyNeighborhoods", "serviceHub", "blogPosts"],
    "blogPosts": ["relevantService", "relatedPosts", "neighborhoodPage", "homepage"]
  },
  "sitemapEntries": [
    {"loc": "/", "lastmod": "${new Date().toISOString().split('T')[0]}", "changefreq": "weekly", "priority": 1.0}
  ],
  "robotsTxt": "User-agent: *\\nAllow: /\\nDisallow: /admin/\\nDisallow: /tmp/\\nSitemap: https://[domain]/sitemap.xml"
}

Generate a comprehensive architecture with ${10 + input.services.length + input.services.length + (input.neighborhoods.length * 3) + 10}+ pages.`;
}

/**
 * Generate the Content Generation System Prompt for a single page
 */
export function getPageContentPrompt(
  input: BusinessInput,
  page: PageDefinition,
  allPages: PageDefinition[]
): string {
  const relatedPages = allPages
    .filter(p => page.internalLinksTo.includes(p.slug))
    .map(p => `- ${p.slug}: "${p.title}"`)
    .join('\n');

  return `You are an expert SEO copywriter specializing in local lead generation content. Write comprehensive, conversion-optimized content for this page:

BUSINESS:
- Name: ${input.business_name}
- Niche: ${input.niche}
- City: ${input.city}, ${input.state}
- Phone: ${input.phone}
- Address: ${input.address}
- Services: ${input.services.join(', ')}
- Year Established: ${input.year_established}
- Business Hours: ${input.business_hours}
${input.license_number ? `- License #: ${input.license_number}` : ''}

PAGE TO GENERATE:
- URL: ${page.slug}
- Type: ${page.type}
- Title: ${page.title}
- H1: ${page.h1}
- Primary Keywords: ${page.targetKeywords.join(', ')}
- Secondary Keywords: ${page.secondaryKeywords.join(', ')}
- Target Word Count: ${page.expectedWordCount} words

PAGES TO LINK TO:
${relatedPages}

## CONTENT REQUIREMENTS (${page.expectedWordCount} words total):

### A. Introduction (300-400 words)
- Hook with problem/pain point relevant to ${page.type} page
- Introduce solution
- Include primary keyword in first 100 words
- Mention ${input.city} naturally
- Include internal link to related service page

### B. Main Content (500-700 words)
- H2 heading with primary keyword variation
- Detailed explanation of service/topic
- H3 subheadings for subtopics
- Bullet points for scannable content
- Internal links to related pages

### C. Why Choose Us Section (300-400 words)
- H2: "Why Choose ${input.business_name} for [Service] in ${input.city}"
- Unique selling propositions
- ${input.year_established ? `${new Date().getFullYear() - input.year_established}+ years experience` : '10+ years experience'}
- Licensed & insured
- Local expertise

### D. Our Process Section (300-400 words)
- H2: "Our [Service] Process"
- Numbered steps (4-6 steps)
- What customers can expect
- Timeline information

### E. Service Areas Section (200-300 words)
- H2: "[Service] Service Areas in ${input.city}"
- List and link to neighborhood pages: ${input.neighborhoods.slice(0, 5).join(', ')}
- Mention coverage area
- Reference Google Maps

### F. Pricing/Cost Guide (300-400 words)
- H2: "[Service] Cost in ${input.city}" or "What Affects [Service] Pricing"
- Factors affecting cost
- General price ranges
- Free estimate CTA with phone ${input.phone}

### G. Related Services (200-300 words)
- H2: "Related ${input.niche} Services"
- Links to 3-4 other service pages
- Brief descriptions

### H. FAQ Section (400-500 words)
- H2: "Frequently Asked Questions About [Service] in ${input.city}"
- 8-12 questions with detailed answers
- Include long-tail keywords
- Address common concerns

## META REQUIREMENTS:
- Title: 50-60 chars, front-load primary keyword
- Description: 150-160 chars, include keyword + CTA + value prop

## SCHEMA MARKUP:
Include appropriate schema:
- LocalBusiness (always)
- Service (for service pages)
- FAQPage (always, for FAQ section)
- BreadcrumbList (always)

## INTERNAL LINKING:
Use format: [LINK:${page.internalLinksTo[0] || '/contact/'}:anchor text]
Follow anchor text distribution: 30% exact, 30% partial, 20% branded, 10% generic, 10% URL

Return as JSON:
{
  "slug": "${page.slug}",
  "metaTitle": "50-60 char title with keyword",
  "metaDescription": "150-160 char compelling description",
  "h1": "${page.h1}",
  "sections": [
    {
      "heading": "H2 Heading",
      "headingLevel": "h2",
      "content": "<p>Full HTML content with [LINK:/slug:anchor text] formatting...</p><ul><li>Points</li></ul>",
      "keywords": ["keyword1", "keyword2"]
    },
    {
      "heading": "H3 Subheading",
      "headingLevel": "h3",
      "content": "<p>More content...</p>",
      "keywords": ["keyword3"]
    }
  ],
  "faqSection": [
    {"question": "Question 1?", "answer": "Detailed answer..."},
    {"question": "Question 2?", "answer": "Detailed answer..."}
  ],
  "schemaMarkup": {
    "localBusiness": {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "${input.business_name}",
      "telephone": "${input.phone}",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "${input.city}",
        "addressRegion": "${input.state}"
      }
    },
    "faqPage": {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": []
    },
    "breadcrumbList": {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": []
    }
  },
  "wordCount": ${page.expectedWordCount},
  "internalLinks": [
    {"targetSlug": "/services/", "anchorText": "${input.niche} services", "anchorType": "primary"},
    {"targetSlug": "/contact/", "anchorText": "contact us", "anchorType": "generic"}
  ]
}`;
}

/**
 * Generate Blog Post Content Prompt
 */
export function getBlogPostPrompt(
  input: BusinessInput,
  postType: 'how_to' | 'cost_guide' | 'listicle' | 'comparison' | 'local_guide',
  topic: string,
  targetKeywords: string[]
): string {
  const postTypeGuide = {
    how_to: {
      title: `How to ${topic} in ${input.city}`,
      wordCount: 2500,
      structure: 'Step-by-step instructions with detailed explanations'
    },
    cost_guide: {
      title: `${topic} Cost in ${input.city}: Complete ${new Date().getFullYear()} Price Guide`,
      wordCount: 2000,
      structure: 'Price ranges, factors affecting cost, tips to save'
    },
    listicle: {
      title: `Top 10 Signs You Need ${topic} in Your ${input.city} Home`,
      wordCount: 2000,
      structure: 'Numbered list with detailed explanations for each item'
    },
    comparison: {
      title: `${topic}: Which is Right for ${input.city} Homeowners?`,
      wordCount: 2500,
      structure: 'Comparison tables, pros/cons, expert recommendations'
    },
    local_guide: {
      title: `Complete Guide to ${topic} for ${input.city} Homeowners`,
      wordCount: 3000,
      structure: 'Comprehensive resource covering all aspects of the topic'
    }
  };

  const guide = postTypeGuide[postType];

  return `You are an expert SEO content writer. Create a comprehensive blog post:

BUSINESS: ${input.business_name} - ${input.niche} in ${input.city}, ${input.state}
Phone: ${input.phone}

POST DETAILS:
- Type: ${postType}
- Title: ${guide.title}
- Target Word Count: ${guide.wordCount}+ words
- Structure: ${guide.structure}
- Keywords: ${targetKeywords.join(', ')}

## BLOG POST REQUIREMENTS:

### Header Section:
- SEO-optimized H1 title
- Author byline
- Publish date
- Read time estimate
- Featured image alt text suggestion

### Key Takeaways Box (at top):
- 3-5 bullet points summarizing main points

### Table of Contents:
- All H2 sections linked

### Main Content:
- ${guide.wordCount}+ words
- Proper H2/H3 hierarchy
- Include statistics and data where relevant
- Local ${input.city} references throughout
- Internal links to service pages

### Mid-Content CTA:
- Call-to-action box linking to services
- Phone number: ${input.phone}

### FAQ Section (5-8 questions):
- Related long-tail keyword questions
- Detailed answers

### Conclusion:
- Summary of key points
- Clear CTA

### Author Box:
- Author name and credentials
- Brief professional bio

### Related Posts Section:
- 3 related article suggestions

Return as JSON with full HTML content:
{
  "slug": "/blog/[generated-slug]/",
  "metaTitle": "...",
  "metaDescription": "...",
  "h1": "...",
  "author": {"name": "...", "title": "...", "bio": "..."},
  "publishDate": "${new Date().toISOString().split('T')[0]}",
  "readTime": "X min read",
  "featuredImageAlt": "...",
  "keyTakeaways": ["...", "..."],
  "tableOfContents": [{"text": "...", "anchor": "#section-1"}],
  "sections": [...],
  "faqSection": [...],
  "relatedPosts": ["...", "...", "..."],
  "schemaMarkup": {...},
  "wordCount": ${guide.wordCount}
}`;
}

/**
 * Generate Design System Prompt
 */
export function getDesignSystemPrompt(input: BusinessInput): string {
  return `You are an expert web designer. Create a professional, industry-appropriate design system for:

BUSINESS: ${input.business_name}
INDUSTRY: ${input.niche}
LOCATION: ${input.city}, ${input.state}

Create a design system that:
1. Reflects the ${input.niche} industry appropriately
2. Conveys trust, professionalism, and local expertise
3. Is unique and doesn't look like a generic template
4. Uses modern design principles
5. Is accessible (WCAG AA compliant contrast ratios)
6. Works well for lead generation (clear CTAs, conversion-focused)

Return as JSON:
{
  "colorPalette": {
    "primary": "#...",
    "primaryLight": "#...",
    "primaryDark": "#...",
    "secondary": "#...",
    "accent": "#...",
    "background": "#ffffff",
    "surface": "#f8fafc",
    "text": "#1e293b",
    "textMuted": "#64748b",
    "success": "#22c55e",
    "warning": "#f59e0b",
    "error": "#ef4444"
  },
  "typography": {
    "headingFont": "Inter",
    "bodyFont": "Inter",
    "baseFontSize": 16,
    "lineHeight": 1.6,
    "scale": [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72]
  },
  "spacing": {
    "unit": 4,
    "scale": [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]
  },
  "borderRadius": {
    "small": "0.25rem",
    "medium": "0.5rem",
    "large": "0.75rem",
    "full": "9999px"
  },
  "shadows": {
    "small": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    "medium": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    "large": "0 10px 15px -3px rgb(0 0 0 / 0.1)"
  },
  "breakpoints": {
    "mobile": 480,
    "tablet": 768,
    "desktop": 1024,
    "wide": 1200
  }
}`;
}
