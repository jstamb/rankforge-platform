/**
 * React/Next.js Generation Prompts for Lead Generation Website Builder
 *
 * Generates complete, production-ready Next.js 14 applications
 * optimized for local SEO and Google Maps ranking.
 */

// Site Configuration Types
export interface SiteConfig {
  businessName: string;
  niche: string;
  nicheSlug: string;
  city: string;
  citySlug: string;
  state: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  coordinates?: {
    lat: number;
    lng: number;
  };
  googleMapsEmbedUrl?: string;
  googlePlaceId?: string;
  neighborhoods: string[];
  services: string[];
  businessHours: string;
  yearEstablished: number;
  licenseNumber?: string;
  primaryColor: string;
  secondaryColor: string;
  domain?: string;
}

// Generated file structure
export interface GeneratedFile {
  path: string;
  content: string;
}

export interface NextJSProject {
  config: ProjectConfig;
  files: GeneratedFile[];
}

export interface ProjectConfig {
  packageJson: object;
  tsconfig: object;
  tailwindConfig: string;
  nextConfig: string;
  dockerFile: string;
  cloudbuildYaml: string;
  githubWorkflow: string;
}

// Service data type
export interface ServiceData {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  icon: string;
  features: string[];
  benefits: string[];
  process: Array<{ step: number; title: string; description: string }>;
  faqs: Array<{ question: string; answer: string }>;
  relatedServices: string[];
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

// Neighborhood data type
export interface NeighborhoodData {
  id: string;
  name: string;
  slug: string;
  description: string;
  zipCodes: string[];
  nearbyNeighborhoods: string[];
  landmarks?: string[];
  metaTitle: string;
  metaDescription: string;
}

// Review data type
export interface ReviewData {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  source: 'google' | 'yelp' | 'facebook' | 'direct';
  serviceType?: string;
  verified: boolean;
}

// FAQ data type
export interface FAQData {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

// Blog post data type
export interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: { name: string; title: string; bio: string };
  publishedAt: string;
  category: string;
  tags: string[];
  relatedServices: string[];
  metaTitle: string;
  metaDescription: string;
  readingTime: number;
}

// Full generated site content
export interface GeneratedSiteContent {
  services: ServiceData[];
  neighborhoods: NeighborhoodData[];
  reviews: ReviewData[];
  faqs: FAQData[];
  blogPosts: BlogPostData[];
  homePageContent: {
    heroTitle: string;
    heroSubtitle: string;
    whyChooseUsContent: string;
    introContent: string;
  };
  aboutPageContent: {
    headline: string;
    story: string;
    mission: string;
    teamSection: string;
  };
}

/**
 * Convert BusinessInput to SiteConfig
 */
export function businessInputToSiteConfig(input: {
  business_name: string;
  niche: string;
  city: string;
  state: string;
  phone: string;
  email?: string;
  address: string;
  google_maps_embed_url?: string;
  neighborhoods: string[];
  services: string[];
  business_hours: string;
  year_established: number;
  license_number?: string;
}): SiteConfig {
  const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  // Parse address string into components
  const addressParts = input.address.split(',').map(p => p.trim());
  const street = addressParts[0] || '';
  const cityFromAddr = addressParts[1] || input.city;
  const stateZip = addressParts[2]?.split(' ') || [input.state, ''];

  return {
    businessName: input.business_name,
    niche: input.niche,
    nicheSlug: slugify(input.niche),
    city: input.city,
    citySlug: slugify(input.city),
    state: input.state,
    phone: input.phone,
    email: input.email || `info@${slugify(input.business_name)}.com`,
    address: {
      street,
      city: cityFromAddr,
      state: input.state,
      zip: stateZip[1] || '',
    },
    googleMapsEmbedUrl: input.google_maps_embed_url,
    neighborhoods: input.neighborhoods,
    services: input.services,
    businessHours: input.business_hours,
    yearEstablished: input.year_established,
    licenseNumber: input.license_number,
    primaryColor: '#2563eb', // Default blue
    secondaryColor: '#f59e0b', // Default amber
  };
}

/**
 * Get the system prompt for generating the complete Next.js project
 */
export function getNextJSGenerationPrompt(config: SiteConfig): string {
  return `You are an expert full-stack developer specializing in SEO-optimized local lead generation websites. Generate a complete, production-ready Next.js 14 application.

## TECH STACK
- Framework: Next.js 14+ (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Forms: React Hook Form + Zod validation
- Deployment: Google Cloud Run via GitHub Actions

## BUSINESS INFORMATION
- Business Name: ${config.businessName}
- Niche: ${config.niche}
- City: ${config.city}, ${config.state}
- Phone: ${config.phone}
- Email: ${config.email}
- Address: ${config.address.street}, ${config.address.city}, ${config.address.state} ${config.address.zip}
- Services: ${config.services.join(', ')}
- Neighborhoods: ${config.neighborhoods.join(', ')}
- Year Established: ${config.yearEstablished}
- Business Hours: ${config.businessHours}
${config.licenseNumber ? `- License: ${config.licenseNumber}` : ''}
${config.googleMapsEmbedUrl ? `- Google Maps: ${config.googleMapsEmbedUrl}` : ''}

## BRANDING
- Primary Color: ${config.primaryColor}
- Secondary Color: ${config.secondaryColor}

## REQUIRED OUTPUT FORMAT

Generate a complete Next.js project as a JSON object with this structure:

{
  "files": [
    {
      "path": "package.json",
      "content": "{ package.json content }"
    },
    {
      "path": "src/app/page.tsx",
      "content": "// TypeScript React component content"
    }
    // ... all project files
  ]
}

## REQUIRED FILES TO GENERATE

### Configuration Files
1. package.json - Dependencies for Next.js 14, React 18, Tailwind, Zod, React Hook Form, Lucide React
2. tsconfig.json - Strict TypeScript config with path aliases
3. tailwind.config.ts - Custom colors from branding, container settings
4. next.config.js - Standalone output, security headers, redirects
5. next-sitemap.config.js - SEO sitemap generation
6. postcss.config.js - PostCSS for Tailwind

### Docker & CI/CD
7. Dockerfile - Multi-stage build for Cloud Run (port 8080)
8. .dockerignore - Exclude node_modules, .next, etc.
9. .github/workflows/deploy.yml - GitHub Actions for Cloud Run deployment
10. cloudbuild.yaml - Google Cloud Build config

### Core Source Files

#### Types (src/types/index.ts)
- SiteConfig, Service, Neighborhood, Review, FAQ, BlogPost types
- Form data types
- Schema markup types

#### Library Files
- src/lib/config.ts - Site configuration with all business info
- src/lib/utils.ts - cn(), slugify(), formatDate(), etc.
- src/lib/seo.ts - generateMetadata function using Next.js Metadata API
- src/lib/schema.ts - Schema.org generators (LocalBusiness, Service, FAQ, Review, Breadcrumb)

#### Data Files (Generate realistic, SEO-optimized content)
- src/data/services.ts - ${config.services.length} services with full descriptions (300+ words each), FAQs, process steps
- src/data/neighborhoods.ts - ${config.neighborhoods.length} neighborhoods with local descriptions
- src/data/reviews.ts - 10-15 realistic reviews (4-5 star ratings)
- src/data/faqs.ts - 20-30 FAQs organized by category
- src/data/blog-posts.ts - 5-8 SEO blog posts (titles, excerpts, full content)

#### Layout Components (src/components/layout/)
- Header.tsx - Logo, navigation with dropdowns, phone CTA, mobile menu
- Footer.tsx - Contact info, service links, location links, copyright
- Navigation.tsx - Desktop nav with mega menus
- MobileMenu.tsx - Slide-out mobile navigation
- Breadcrumbs.tsx - SEO breadcrumb component

#### Section Components (src/components/sections/)
- Hero.tsx - Full-width hero with form, background image support
- HeroForm.tsx - Lead capture form embedded in hero
- TrustBar.tsx - Years in business, reviews count, licensed badges
- ServicesGrid.tsx - Card grid of services
- ReviewsSection.tsx - Testimonial carousel/grid
- FAQSection.tsx - Accordion FAQ component
- CTASection.tsx - Call-to-action with phone number
- MapSection.tsx - Google Maps embed
- ServiceAreas.tsx - Neighborhood links grid
- ProcessSteps.tsx - How it works section

#### UI Components (src/components/ui/)
- Button.tsx - Primary, secondary, outline variants
- Card.tsx - Service/review cards
- Input.tsx - Form input with validation states
- Select.tsx - Dropdown select
- Textarea.tsx - Multi-line input
- Accordion.tsx - FAQ accordion
- StarRating.tsx - Review stars display
- PhoneLink.tsx - Clickable phone number

#### Form Components (src/components/forms/)
- ContactForm.tsx - Full contact form with Zod validation
- QuoteForm.tsx - Quote request form
- FormSuccess.tsx - Success message component

#### SEO Components (src/components/seo/)
- SchemaMarkup.tsx - JSON-LD script injector
- LocalBusinessSchema.tsx - Business schema
- ServiceSchema.tsx - Service schema
- FAQSchema.tsx - FAQ page schema
- BreadcrumbSchema.tsx - Breadcrumb schema
- ReviewSchema.tsx - Aggregate review schema

#### Hooks (src/hooks/)
- useScrollHeader.ts - Header scroll behavior
- useMobileMenu.ts - Mobile menu state

### App Router Pages (src/app/)

#### Root Layout & Pages
- layout.tsx - Root layout with Header, Footer, LocalBusiness schema
- page.tsx - Homepage (2500+ words of content)
- not-found.tsx - 404 page
- globals.css - Tailwind imports, CSS variables, component classes

#### Static Pages
- about/page.tsx - About us page (2000+ words)
- contact/page.tsx - Contact page with form and map
- reviews/page.tsx - Reviews page with schema

#### Service Pages
- services/page.tsx - Service hub page
- services/[serviceSlug]/page.tsx - Individual service pages with generateStaticParams

#### Location Pages
- locations/page.tsx - Locations hub
- locations/[neighborhoodSlug]/page.tsx - Individual neighborhood pages with generateStaticParams

#### City + Service Pages (HIGH PRIORITY for SEO)
- [citySlug]-[serviceSlug]/page.tsx - Combined city + service pages (e.g., /seattle-plumber/)

#### Blog Pages
- blog/page.tsx - Blog listing
- blog/[postSlug]/page.tsx - Individual blog posts

#### API Routes
- api/lead/route.ts - Lead form submission handler
- api/contact/route.ts - Contact form handler
- api/health/route.ts - Health check for Cloud Run

#### Sitemap
- sitemap.ts - Dynamic sitemap generation

### Environment Files
- .env.example - Template with all required vars
- .gitignore - Standard Next.js ignores

## CONTENT REQUIREMENTS

### Each page must have:
- 2,000-3,500 words of unique, SEO-optimized content
- Primary keyword in H1 (include city name)
- 3-6 H2 sections with secondary keywords
- FAQ section with 5-10 questions
- Internal links to related pages (service pages link to neighborhoods, etc.)
- Schema markup appropriate for page type
- Meta title (50-60 chars) and description (150-160 chars)

### Service pages must include:
- Service introduction (300-400 words)
- What's included (500-700 words with H3s)
- Why choose us for this service (300-400 words)
- Our process steps (300-400 words)
- Service areas with neighborhood links
- Pricing factors guide (300-400 words)
- Related services
- FAQ section (400-500 words, 5-8 questions)

### Neighborhood pages must include:
- Area introduction (300-400 words)
- About the neighborhood (300-400 words)
- Services offered in area (400-500 words)
- Why local service matters (300-400 words)
- Nearby areas with links
- FAQ section (300-400 words)

### Blog posts must include:
- SEO title with primary keyword
- Table of contents
- Key takeaways (3-5 points)
- Main content (1500-2500 words)
- FAQ section
- Related services links
- Author bio

## INTERNAL LINKING RULES

1. Homepage links to: all service pages, locations hub, blog hub, about, contact, reviews
2. Service pages link to: related services (2-3), relevant neighborhoods, blog posts
3. Neighborhood pages link to: service pages, nearby neighborhoods (2-3), homepage
4. Blog posts link to: relevant service page, related posts, homepage

## SCHEMA MARKUP REQUIREMENTS

Every page includes:
- LocalBusiness schema (in layout.tsx)
- BreadcrumbList schema

Service pages add:
- Service schema
- FAQ schema

Reviews page adds:
- AggregateRating schema
- Individual Review schemas

Blog posts add:
- Article schema
- Author schema

## COMPONENT STYLING GUIDELINES

Use Tailwind CSS with:
- CSS custom properties for colors (--color-primary-500, etc.)
- Container class: max-w-7xl mx-auto px-4 sm:px-6 lg:px-8
- Section padding: py-16 md:py-24
- Responsive design: mobile-first approach
- Accessible focus states
- Semantic HTML (article, section, nav, main)

## IMPORTANT CONSTRAINTS

1. All TypeScript must be strict-mode compliant
2. Use Next.js 14 App Router patterns (not Pages Router)
3. All imports must resolve correctly
4. Phone numbers must be clickable (tel: links)
5. Google Maps embeds must be included where specified
6. Docker must expose port 8080 for Cloud Run
7. All forms must have Zod validation
8. Content must be unique and valuable (no lorem ipsum)

Generate the complete project now. Return ONLY valid JSON with the files array.`;
}

/**
 * Get prompt for generating just the data/content files
 */
export function getContentGenerationPrompt(config: SiteConfig): string {
  return `Generate SEO-optimized content data for a ${config.niche} business website.

## BUSINESS INFO
- Name: ${config.businessName}
- Niche: ${config.niche}
- Location: ${config.city}, ${config.state}
- Phone: ${config.phone}
- Services: ${config.services.join(', ')}
- Neighborhoods: ${config.neighborhoods.join(', ')}
- Year Established: ${config.yearEstablished}

## OUTPUT FORMAT

Return a JSON object with:

{
  "services": [
    {
      "id": "service-1",
      "name": "Service Name",
      "slug": "service-name",
      "shortDescription": "Brief 1-2 sentence description",
      "description": "Full 300-400 word description with SEO keywords",
      "icon": "lucide-icon-name",
      "features": ["Feature 1", "Feature 2", ...],
      "benefits": ["Benefit 1", "Benefit 2", ...],
      "process": [
        {"step": 1, "title": "Step Title", "description": "Step description"}
      ],
      "faqs": [
        {"question": "Question?", "answer": "Detailed answer"}
      ],
      "relatedServices": ["service-2-id"],
      "metaTitle": "Service Name in City, State | Business Name",
      "metaDescription": "150-160 char description with CTA",
      "keywords": ["keyword1", "keyword2"]
    }
  ],
  "neighborhoods": [
    {
      "id": "neighborhood-1",
      "name": "Neighborhood Name",
      "slug": "neighborhood-name",
      "description": "300-400 word description of serving this area",
      "zipCodes": ["12345"],
      "nearbyNeighborhoods": ["neighborhood-2-id"],
      "landmarks": ["Local Landmark 1"],
      "metaTitle": "Niche in Neighborhood, City | Business",
      "metaDescription": "150-160 char description"
    }
  ],
  "reviews": [
    {
      "id": "review-1",
      "author": "John D.",
      "rating": 5,
      "text": "Detailed review text",
      "date": "2024-11-15",
      "source": "google",
      "serviceType": "service-id",
      "verified": true
    }
  ],
  "faqs": [
    {
      "id": "faq-1",
      "question": "Common question?",
      "answer": "Detailed helpful answer",
      "category": "general"
    }
  ],
  "blogPosts": [
    {
      "id": "post-1",
      "title": "SEO Optimized Blog Title",
      "slug": "seo-optimized-blog-title",
      "excerpt": "2-3 sentence excerpt",
      "content": "<p>Full HTML content 1500-2500 words</p>",
      "author": {"name": "Expert Name", "title": "Master Plumber", "bio": "Bio text"},
      "publishedAt": "2024-12-01",
      "category": "Tips",
      "tags": ["tag1", "tag2"],
      "relatedServices": ["service-id"],
      "metaTitle": "Blog Post SEO Title | Business",
      "metaDescription": "Meta description",
      "readingTime": 8
    }
  ],
  "homePageContent": {
    "heroTitle": "City's Most Trusted Niche",
    "heroSubtitle": "Supporting tagline",
    "introContent": "300-400 word introduction HTML",
    "whyChooseUsContent": "300-400 word why choose us HTML"
  },
  "aboutPageContent": {
    "headline": "About Our Company",
    "story": "500-700 word company story HTML",
    "mission": "Mission statement",
    "teamSection": "200-300 word team description HTML"
  }
}

## CONTENT GUIDELINES

1. All content must be unique and valuable
2. Include local keywords naturally (city name, neighborhoods)
3. Service descriptions: professional, authoritative tone
4. Reviews: realistic variety of 4-5 stars, specific details
5. Blog posts: educational, helpful, include internal linking suggestions
6. FAQs: answer real customer questions thoroughly

Generate comprehensive, SEO-optimized content now.`;
}

/**
 * Slugify helper
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
