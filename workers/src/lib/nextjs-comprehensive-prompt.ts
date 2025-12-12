/**
 * Comprehensive Next.js 14 Lead Generation Website Builder Prompts
 *
 * This file contains the complete system prompt for generating production-ready
 * Next.js 14 applications optimized for local SEO and Google Maps ranking.
 *
 * Based on the comprehensive Lead Gen Website Builder specification.
 */

export interface SiteConfig {
  businessName: string;
  niche: string;
  nicheSlug: string;
  city: string;
  citySlug: string;
  state: string;
  phone: string;
  phoneFormatted: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    full: string;
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
  gcpProjectId?: string;
  gcpRegion?: string;
  cloudRunServiceName?: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

/**
 * Helper to slugify strings
 */
function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/**
 * Generate business context string for prompts
 */
function getBusinessContext(config: SiteConfig): string {
  return `## BUSINESS INFORMATION
- Business Name: ${config.businessName}
- Niche: ${config.niche}
- City: ${config.city}, ${config.state}
- Phone: ${config.phone}
- Email: ${config.email}
- Address: ${config.address.full}
- Services: ${config.services.join(', ')}
- Neighborhoods: ${config.neighborhoods.join(', ')}
- Year Established: ${config.yearEstablished}
- Business Hours: ${config.businessHours}
${config.licenseNumber ? `- License: ${config.licenseNumber}` : ''}
${config.googleMapsEmbedUrl ? `- Google Maps Embed: ${config.googleMapsEmbedUrl}` : ''}
${config.coordinates ? `- Coordinates: ${config.coordinates.lat}, ${config.coordinates.lng}` : ''}

## BRANDING
- Primary Color: ${config.primaryColor}
- Secondary Color: ${config.secondaryColor}
- Domain: ${config.domain || slugify(config.businessName) + '.com'}`;
}

/**
 * STEP 1: Configuration Files Prompt
 *
 * Generates: package.json, tsconfig.json, next.config.js, tailwind.config.ts,
 * postcss.config.js, next-sitemap.config.js
 */
export function getConfigFilesPrompt(config: SiteConfig): string {
  const businessSlug = slugify(config.businessName);
  const domain = config.domain || `${businessSlug}.com`;

  return `You are an expert full-stack developer. Generate the configuration files for a Next.js 14 local lead generation website.

${getBusinessContext(config)}

## TECH STACK
- Framework: Next.js 14+ (App Router)
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS
- Forms: React Hook Form + Zod validation
- Icons: Lucide React
- Deployment: Google Cloud Run via GitHub Actions

## OUTPUT FORMAT
Return a JSON object with this exact structure:
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "tsconfig.json", "content": "..." },
    ...
  ]
}

## REQUIRED FILES

### 1. package.json
Generate with these exact dependencies:
\`\`\`json
{
  "name": "${businessSlug}-website",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start -p $PORT",
    "lint": "next lint",
    "postbuild": "next-sitemap"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.3.4",
    "zod": "^3.22.4",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.356.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.18",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.0",
    "next-sitemap": "^4.2.3",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.0"
  }
}
\`\`\`

### 2. tsconfig.json
\`\`\`json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/data/*": ["./src/data/*"],
      "@/types/*": ["./src/types/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
\`\`\`

### 3. next.config.js
\`\`\`javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['${domain}', 'maps.googleapis.com'],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:path((?!api|_next|.*\\\\..*).*[^/])',
        destination: '/:path/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
\`\`\`

### 4. tailwind.config.ts
Generate with custom colors based on primary (${config.primaryColor}) and secondary (${config.secondaryColor}) colors.
Include a full color scale (50-900) for primary color.
Use Inter font family.

### 5. postcss.config.js
\`\`\`javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
\`\`\`

### 6. next-sitemap.config.js
Configure for domain: ${domain}
Set proper priorities: homepage 1.0, services 0.9, locations 0.8, blog 0.6

Generate all 6 files with complete, production-ready content.`;
}

/**
 * STEP 2: Docker & CI/CD Files Prompt
 */
export function getDockerCICDPrompt(config: SiteConfig): string {
  const businessSlug = slugify(config.businessName);
  const serviceName = config.cloudRunServiceName || `${businessSlug}-website`;
  const domain = config.domain || `${businessSlug}.com`;

  return `You are an expert DevOps engineer. Generate Docker and CI/CD configuration files for deploying a Next.js 14 application to Google Cloud Run.

${getBusinessContext(config)}

## DEPLOYMENT CONFIGURATION
- Service Name: ${serviceName}
- GCP Project: ${config.gcpProjectId || 'PROJECT_ID'}
- GCP Region: ${config.gcpRegion || 'us-central1'}
- Domain: ${domain}

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "Dockerfile", "content": "..." },
    { "path": ".dockerignore", "content": "..." },
    { "path": "cloudbuild.yaml", "content": "..." },
    { "path": ".github/workflows/deploy.yml", "content": "..." },
    { "path": ".gitignore", "content": "..." }
  ]
}

## REQUIRED FILES

### 1. Dockerfile (Multi-stage build for Next.js standalone)
\`\`\`dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1

CMD ["node", "server.js"]
\`\`\`

### 2. .dockerignore
Include: node_modules, .next, .git, .env files, etc.

### 3. cloudbuild.yaml
Google Cloud Build config for building and deploying to Cloud Run.

### 4. .github/workflows/deploy.yml
Complete GitHub Actions workflow that:
- Runs on push to main/master
- Authenticates to GCP using secrets.GCP_SA_KEY
- Builds Docker image with build args
- Pushes to GCR
- Deploys to Cloud Run with:
  - Port 8080
  - 1 CPU, 512Mi memory
  - Min 0, Max 10 instances
  - 80 concurrency

### 5. .gitignore
Standard Next.js gitignore with node_modules, .next, .env files, IDE files, etc.

Generate all 5 files with complete, production-ready content.`;
}

/**
 * STEP 3: Core Types and Library Files Prompt
 */
export function getCoreLibraryPrompt(config: SiteConfig): string {
  const domain = config.domain || `${slugify(config.businessName)}.com`;

  return `You are an expert TypeScript developer. Generate the core type definitions and library files for a Next.js 14 local lead generation website.

${getBusinessContext(config)}

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/types/index.ts", "content": "..." },
    { "path": "src/lib/config.ts", "content": "..." },
    { "path": "src/lib/utils.ts", "content": "..." },
    { "path": "src/lib/seo.ts", "content": "..." },
    { "path": "src/lib/schema.ts", "content": "..." }
  ]
}

## REQUIRED FILES

### 1. src/types/index.ts
Define these TypeScript interfaces:
- SiteConfig (business configuration)
- Address, Coordinates, BusinessHours, DayHours
- Service (id, name, slug, shortDescription, description, icon, features, benefits, process, faqs, relatedServices, metaTitle, metaDescription, keywords)
- ProcessStep (step, title, description, icon)
- Neighborhood (id, name, slug, city, description, coordinates, zipCodes, nearbyNeighborhoods, landmarks, metaTitle, metaDescription)
- FAQ (id, question, answer, category)
- Review (id, author, rating, text, date, source, serviceType, neighborhood, verified)
- BlogPost (id, title, slug, excerpt, content, author, publishedAt, updatedAt, featuredImage, category, tags, relatedServices, relatedPosts, metaTitle, metaDescription, readingTime)
- Author (name, title, bio, image)
- ContactFormData, QuoteFormData
- PageMeta, OpenGraphMeta, OGImage
- LocalBusinessSchema, PostalAddressSchema, GeoSchema, OpeningHoursSchema, AreaServedSchema

### 2. src/lib/config.ts
Export siteConfig constant with all business info:
\`\`\`typescript
import { SiteConfig } from '@/types';

export const siteConfig: SiteConfig = {
  businessName: '${config.businessName}',
  niche: '${config.niche}',
  nicheSlug: '${config.nicheSlug}',
  city: '${config.city}',
  citySlug: '${config.citySlug}',
  state: '${config.state}',
  phone: '${config.phone}',
  phoneFormatted: '${config.phoneFormatted || config.phone}',
  email: '${config.email}',
  address: {
    street: '${config.address.street}',
    city: '${config.address.city}',
    state: '${config.address.state}',
    zip: '${config.address.zip}',
    full: '${config.address.full}',
  },
  ${config.coordinates ? `coordinates: { lat: ${config.coordinates.lat}, lng: ${config.coordinates.lng} },` : ''}
  googleMapsEmbedUrl: '${config.googleMapsEmbedUrl || ''}',
  domain: '${domain}',
  yearEstablished: ${config.yearEstablished},
  ${config.licenseNumber ? `licenseNumber: '${config.licenseNumber}',` : ''}
  branding: {
    primaryColor: '${config.primaryColor}',
    secondaryColor: '${config.secondaryColor}',
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

export const getPhoneLink = (): string => \`tel:\${formatPhone(siteConfig.phone)}\`;
\`\`\`

### 3. src/lib/utils.ts
Export these utilities:
- cn(...inputs: ClassValue[]) - merge Tailwind classes using clsx + tailwind-merge
- slugify(text: string): string
- unslugify(slug: string): string
- truncate(str: string, length: number): string
- calculateReadingTime(content: string): number
- formatDate(date: string | Date): string
- getYearsInBusiness(yearEstablished: number): number

### 4. src/lib/seo.ts
Export generateMetadata function that returns Next.js Metadata:
- Takes title, description, path, keywords, images, noIndex
- Returns proper Metadata object with:
  - title, description, keywords
  - canonical URL
  - openGraph with images
  - twitter card
  - robots config
  - geo meta tags for local SEO

Also export:
- generateTitle(primaryKeyword, includeCity, suffix): string
- generateDescription(primaryKeyword, uniqueValue, cta): string

### 5. src/lib/schema.ts
Export schema generators:
- generateLocalBusinessSchema(): LocalBusinessSchema
- generateServiceSchema(service: Service): object
- generateFAQSchema(faqs: FAQ[]): object
- generateBreadcrumbSchema(items: {name, url}[]): object
- generateReviewSchema(reviews: Review[]): object

Include helper functions:
- determineBusinessType(niche: string): string - maps niche to Schema.org type
- generateOpeningHours(): OpeningHoursSchema[]

Generate all 5 files with complete, production-ready TypeScript code.`;
}

/**
 * STEP 4: Data Files Prompt
 */
export function getDataFilesPrompt(config: SiteConfig): string {
  return `You are an expert SEO content strategist. Generate comprehensive data files for a local lead generation website.

${getBusinessContext(config)}

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/data/services.ts", "content": "..." },
    { "path": "src/data/neighborhoods.ts", "content": "..." },
    { "path": "src/data/reviews.ts", "content": "..." },
    { "path": "src/data/faqs.ts", "content": "..." },
    { "path": "src/data/blog-posts.ts", "content": "..." }
  ]
}

## CONTENT REQUIREMENTS

### 1. src/data/services.ts
Generate ${config.services.length} service objects for: ${config.services.join(', ')}

Each service MUST include:
- id: unique slug-based ID
- name: Service display name
- slug: URL-friendly slug
- shortDescription: 1-2 sentences (50-100 chars)
- description: 300-500 word detailed description with local references to ${config.city}
- icon: Lucide icon name (e.g., "Wrench", "Droplets", "Zap")
- features: 6-8 key features as strings
- benefits: 5-6 customer benefits
- process: 4-6 steps with { step: number, title: string, description: string }
- faqs: 5-8 service-specific FAQs
- relatedServices: IDs of 2-3 related services
- metaTitle: 50-60 chars, keyword-optimized
- metaDescription: 150-160 chars with CTA
- keywords: 8-12 relevant keywords

Export: services array and getServiceBySlug, getServiceById helper functions.

### 2. src/data/neighborhoods.ts
Generate ${config.neighborhoods.length} neighborhood objects for: ${config.neighborhoods.join(', ')}

Each neighborhood MUST include:
- id: unique ID
- name: Neighborhood name
- slug: URL-friendly slug
- city: "${config.city}"
- description: 200-300 word description with local knowledge, landmarks
- coordinates: approximate { lat, lng } for ${config.city} area
- zipCodes: 1-3 relevant zip codes
- nearbyNeighborhoods: IDs of 2-4 adjacent areas
- landmarks: 3-5 local landmarks or points of interest
- metaTitle: "${config.niche} in [Neighborhood], ${config.city}"
- metaDescription: 150-160 chars

Export: neighborhoods array and getNeighborhoodBySlug helper function.

### 3. src/data/reviews.ts
Generate 12-15 realistic customer reviews:
- Mix of 4 and 5 star ratings (mostly 5)
- Various service types
- Different neighborhoods
- Realistic names and dates (last 2 years)
- 2-4 sentence review text mentioning specific services and ${config.city}
- Sources: google, yelp, facebook, direct

Export: reviews array.

### 4. src/data/faqs.ts
Generate 25-30 FAQs organized by category:
- Categories: general, pricing, services, process, emergency, warranty
- 4-6 FAQs per category
- Detailed answers (50-150 words each)
- Include ${config.city} references
- Long-tail keyword questions

Export: faqs array and getFAQsByCategory helper.

### 5. src/data/blog-posts.ts
Generate 6 SEO-optimized blog post stubs:
- 2 "How To" guides
- 1 "Cost" guide
- 1 "Signs You Need" listicle
- 1 "Comparison" post
- 1 "Complete Guide"

Each post includes:
- Full metadata (title, slug, excerpt, metaTitle, metaDescription)
- author: Expert persona for ${config.niche}
- publishedAt: Recent dates
- category, tags
- relatedServices: Link to relevant services
- readingTime: 5-10 minutes
- content: Full 1500-2500 word article with proper H2/H3 structure, internal linking opportunities

Export: blogPosts array and getPostBySlug helper.

Generate all 5 files with comprehensive, SEO-optimized content.`;
}

/**
 * STEP 5: Layout Components Prompt
 */
export function getLayoutComponentsPrompt(config: SiteConfig): string {
  return `You are an expert React/Next.js developer. Generate the layout components for a professional local lead generation website.

${getBusinessContext(config)}

## DESIGN REQUIREMENTS
- Modern, professional design suitable for ${config.niche} industry
- Mobile-first responsive design
- Primary color: ${config.primaryColor}
- Secondary color (accent/CTA): ${config.secondaryColor}
- Clean typography with good hierarchy
- Prominent phone CTA always visible

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/components/layout/Header.tsx", "content": "..." },
    { "path": "src/components/layout/Footer.tsx", "content": "..." },
    { "path": "src/components/layout/Navigation.tsx", "content": "..." },
    { "path": "src/components/layout/MobileMenu.tsx", "content": "..." },
    { "path": "src/components/layout/Breadcrumbs.tsx", "content": "..." }
  ]
}

## REQUIRED COMPONENTS

### 1. Header.tsx
- Sticky header that changes on scroll
- Logo/business name on left
- Desktop navigation with dropdowns for Services and Locations
- Phone number CTA button (always visible)
- Mobile hamburger menu trigger
- Uses Lucide icons (Phone, Menu, X, ChevronDown)

### 2. Footer.tsx
- Contact information section with address, phone, email
- Service links (links to all service pages)
- Location links (links to neighborhood pages)
- Business hours
- License info if applicable
- Social links (placeholder)
- Copyright with current year
- 4-column responsive grid

### 3. Navigation.tsx
- Desktop mega-menu style navigation
- Services dropdown showing all ${config.services.length} services
- Locations dropdown showing neighborhoods
- Smooth hover transitions
- Proper accessibility (keyboard nav, aria labels)

### 4. MobileMenu.tsx
- Full-screen slide-out menu
- Accordion-style expandable sections
- Phone CTA prominently placed
- Smooth animations
- Close on navigation or overlay click

### 5. Breadcrumbs.tsx
- Renders breadcrumb navigation
- Takes items array with { name, href }
- Proper Schema.org BreadcrumbList markup
- Responsive (truncates on mobile)

All components should:
- Use TypeScript with proper types
- Import from @/lib/config for business data
- Use Tailwind CSS for styling
- Use cn() from @/lib/utils for class merging
- Be fully accessible

Generate all 5 components with complete, production-ready code.`;
}

/**
 * STEP 6: Section Components Prompt
 */
export function getSectionComponentsPrompt(config: SiteConfig): string {
  return `You are an expert React/Next.js developer. Generate the section components for a high-converting local lead generation website.

${getBusinessContext(config)}

## DESIGN REQUIREMENTS
- Conversion-focused design
- Primary color: ${config.primaryColor}
- Secondary/CTA color: ${config.secondaryColor}
- Trust signals prominently displayed
- Phone number clickable everywhere

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/components/sections/Hero.tsx", "content": "..." },
    { "path": "src/components/sections/HeroForm.tsx", "content": "..." },
    { "path": "src/components/sections/TrustBar.tsx", "content": "..." },
    { "path": "src/components/sections/ServicesGrid.tsx", "content": "..." },
    { "path": "src/components/sections/ReviewsSection.tsx", "content": "..." },
    { "path": "src/components/sections/FAQSection.tsx", "content": "..." },
    { "path": "src/components/sections/CTASection.tsx", "content": "..." },
    { "path": "src/components/sections/MapSection.tsx", "content": "..." },
    { "path": "src/components/sections/ServiceAreas.tsx", "content": "..." },
    { "path": "src/components/sections/ProcessSteps.tsx", "content": "..." }
  ]
}

## REQUIRED COMPONENTS

### 1. Hero.tsx
Props: title, subtitle, backgroundImage?, showForm?
- Full-width hero section with gradient overlay
- Large H1 heading
- Subtitle text
- Two CTAs: Primary "Call Now" button, Secondary "Get Free Quote" button
- Optional embedded lead form
- Responsive: stacked on mobile, side-by-side on desktop

### 2. HeroForm.tsx
- Compact lead capture form for embedding in hero
- Fields: Name, Phone, Service (dropdown), Message (optional)
- React Hook Form + Zod validation
- Submit to /api/lead
- Success/error states
- "Get Free Quote" or "Request Callback" CTA

### 3. TrustBar.tsx
- Horizontal bar with trust indicators:
  - ${new Date().getFullYear() - config.yearEstablished}+ Years in Business
  - Licensed & Insured
  - 5-Star Reviews
  - 24/7 Emergency Service (if applicable)
- Icons for each item
- Background slightly darker than page

### 4. ServicesGrid.tsx
Props: services: Service[], compact?: boolean
- Responsive grid (1-2-3 columns)
- Service cards with icon, name, short description
- Link to service page
- Hover effects
- Optional compact mode for less prominent display

### 5. ReviewsSection.tsx
Props: reviews: Review[], title?: string
- Section header with aggregate rating
- Review cards in grid or carousel
- Star ratings display
- Author, date, source badge
- Link to reviews page

### 6. FAQSection.tsx
Props: faqs: FAQ[], title?: string
- Accordion-style expandable questions
- Smooth open/close animation
- Only one open at a time
- Plus/minus icons
- Schema.org FAQPage markup via script tag

### 7. CTASection.tsx
Props: title?, subtitle?
- Full-width colored background section
- Large heading with phone number
- Primary CTA button
- Phone link
- Use secondary color as background

### 8. MapSection.tsx
Props: title?, coordinates?
- Google Maps embed iframe
- Business address displayed
- "Get Directions" link
- Responsive aspect ratio

### 9. ServiceAreas.tsx
Props: neighborhoods: Neighborhood[]
- Grid of neighborhood cards/links
- Each links to neighborhood page
- Map pin icons
- "We serve all of ${config.city}" header

### 10. ProcessSteps.tsx
Props: steps: ProcessStep[], title?: string
- Numbered process steps
- Icon for each step
- Timeline/connector style on desktop
- Stacked cards on mobile

Generate all 10 components with complete, production-ready code.`;
}

/**
 * STEP 7: UI and Form Components Prompt
 */
export function getUIComponentsPrompt(config: SiteConfig): string {
  return `You are an expert React/Next.js developer. Generate the UI and form components for a professional website.

${getBusinessContext(config)}

## DESIGN REQUIREMENTS
- Primary color: ${config.primaryColor}
- Secondary color: ${config.secondaryColor}
- Consistent design tokens
- Accessible (WCAG AA)

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/components/ui/Button.tsx", "content": "..." },
    { "path": "src/components/ui/Card.tsx", "content": "..." },
    { "path": "src/components/ui/Input.tsx", "content": "..." },
    { "path": "src/components/ui/Select.tsx", "content": "..." },
    { "path": "src/components/ui/Textarea.tsx", "content": "..." },
    { "path": "src/components/ui/Badge.tsx", "content": "..." },
    { "path": "src/components/ui/Accordion.tsx", "content": "..." },
    { "path": "src/components/ui/StarRating.tsx", "content": "..." },
    { "path": "src/components/ui/PhoneLink.tsx", "content": "..." },
    { "path": "src/components/forms/ContactForm.tsx", "content": "..." },
    { "path": "src/components/forms/QuoteForm.tsx", "content": "..." }
  ]
}

## REQUIRED COMPONENTS

### UI Components:

1. **Button.tsx** - Variants: primary, secondary, outline, ghost. Sizes: sm, md, lg. Support for icons, loading state.

2. **Card.tsx** - Versatile card component with header, content, footer slots. Shadow and hover variants.

3. **Input.tsx** - Form input with label, error state, helper text. ForwardRef for React Hook Form.

4. **Select.tsx** - Dropdown select with label, error state. Native select styled consistently.

5. **Textarea.tsx** - Multi-line input with label, error state, character count option.

6. **Badge.tsx** - Small badge/chip component. Variants: default, success, warning, error.

7. **Accordion.tsx** - Single accordion item with trigger and content. Animated expand/collapse.

8. **StarRating.tsx** - Displays star rating (1-5). Props: rating, showCount?

9. **PhoneLink.tsx** - Clickable phone link with tel: href. Optional icon.

### Form Components:

10. **ContactForm.tsx**
Full contact form with:
- Fields: Name, Email, Phone, Service (dropdown from services data), Message
- React Hook Form + Zod validation
- Submit to /api/lead
- Loading, success, error states
- Proper field validation messages

11. **QuoteForm.tsx**
Extended quote request form:
- All ContactForm fields plus:
- Address
- Preferred contact method
- Preferred time
- Project timeline dropdown
- Submit to /api/lead with form type

All components should use TypeScript, Tailwind CSS, and cn() utility.

Generate all 11 components with complete, production-ready code.`;
}

/**
 * STEP 8: SEO Components Prompt
 */
export function getSEOComponentsPrompt(config: SiteConfig): string {
  return `You are an expert SEO developer. Generate the Schema.org markup components for a local lead generation website.

${getBusinessContext(config)}

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/components/seo/SchemaMarkup.tsx", "content": "..." },
    { "path": "src/components/seo/LocalBusinessSchema.tsx", "content": "..." },
    { "path": "src/components/seo/ServiceSchema.tsx", "content": "..." },
    { "path": "src/components/seo/FAQSchema.tsx", "content": "..." },
    { "path": "src/components/seo/BreadcrumbSchema.tsx", "content": "..." },
    { "path": "src/components/seo/ReviewSchema.tsx", "content": "..." }
  ]
}

## REQUIRED COMPONENTS

### 1. SchemaMarkup.tsx
Generic wrapper that renders any schema as JSON-LD script tag.
Props: schema: object

### 2. LocalBusinessSchema.tsx
Renders LocalBusiness schema with:
- Business name, type (based on ${config.niche})
- Address, phone, email
- Geo coordinates
- Opening hours
- Price range
- Area served
- Same as (social links)

### 3. ServiceSchema.tsx
Props: service: Service
Renders Service schema with:
- serviceType
- Provider (LocalBusiness)
- areaServed
- Description

### 4. FAQSchema.tsx
Props: faqs: FAQ[]
Renders FAQPage schema with mainEntity array of Question/Answer.

### 5. BreadcrumbSchema.tsx
Props: items: {name: string, url: string}[]
Renders BreadcrumbList schema.

### 6. ReviewSchema.tsx
Props: reviews: Review[]
Renders LocalBusiness with aggregateRating and review array.

All components render proper JSON-LD in script tags with type="application/ld+json".

Generate all 6 components with complete, production-ready code.`;
}

/**
 * STEP 9: App Pages Prompt - Core Pages
 */
export function getCorePagePrompt(config: SiteConfig): string {
  return `You are an expert Next.js developer. Generate the core page files for a local lead generation website using Next.js 14 App Router.

${getBusinessContext(config)}

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/app/layout.tsx", "content": "..." },
    { "path": "src/app/page.tsx", "content": "..." },
    { "path": "src/app/globals.css", "content": "..." },
    { "path": "src/app/not-found.tsx", "content": "..." },
    { "path": "src/app/about/page.tsx", "content": "..." },
    { "path": "src/app/contact/page.tsx", "content": "..." },
    { "path": "src/app/reviews/page.tsx", "content": "..." }
  ]
}

## REQUIRED FILES

### 1. src/app/layout.tsx
Root layout with:
- HTML lang="en"
- Inter font from next/font/google
- Header and Footer components
- LocalBusinessSchema in head
- Proper metadata defaults

### 2. src/app/page.tsx (Homepage)
Export metadata with:
- Title: "${config.niche} in ${config.city}, ${config.state} | ${config.businessName}"
- Description optimized for local SEO

Page content (2500-3500 words equivalent):
- Hero section with form
- TrustBar
- Services overview section (ServicesGrid)
- "Why Choose Us" content section (300-400 words)
- ReviewsSection
- ServiceAreas
- MapSection
- FAQSection (8-10 general FAQs)
- CTASection

### 3. src/app/globals.css
Tailwind CSS with:
\`\`\`css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Primary color scale from ${config.primaryColor} */
  --color-primary-50: ...;
  --color-primary-500: ${config.primaryColor};
  --color-primary-600: ...;
  /* Secondary scale from ${config.secondaryColor} */
  --color-secondary-500: ${config.secondaryColor};
}

@layer base {
  html { scroll-behavior: smooth; }
  body { @apply text-gray-900 bg-white antialiased; }
  h1, h2, h3, h4, h5, h6 { @apply font-bold tracking-tight; }
}

@layer components {
  .btn { @apply inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all; }
  .btn-primary { @apply bg-primary-600 text-white hover:bg-primary-700; }
  .btn-secondary { @apply bg-secondary-500 text-white hover:bg-secondary-600; }
  .section { @apply py-16 md:py-24; }
  .container { @apply max-w-7xl mx-auto px-4 sm:px-6 lg:px-8; }
}
\`\`\`

### 4. src/app/not-found.tsx
Custom 404 page with helpful navigation.

### 5. src/app/about/page.tsx
About page with:
- Company story (300-400 words)
- Mission statement
- Team/expertise section
- Why choose us
- CTA section

### 6. src/app/contact/page.tsx
Contact page with:
- ContactForm component
- Business info sidebar (address, phone, email, hours)
- MapSection
- Service area summary

### 7. src/app/reviews/page.tsx
Reviews page with:
- Aggregate rating display
- All reviews in grid
- Filter by rating option
- CTA to leave review

Generate all 7 files with complete, production-ready code.`;
}

/**
 * STEP 10: Dynamic Route Pages Prompt
 */
export function getDynamicPagesPrompt(config: SiteConfig): string {
  return `You are an expert Next.js developer. Generate the dynamic route page files for a local lead generation website.

${getBusinessContext(config)}

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/app/services/page.tsx", "content": "..." },
    { "path": "src/app/services/[serviceSlug]/page.tsx", "content": "..." },
    { "path": "src/app/locations/page.tsx", "content": "..." },
    { "path": "src/app/locations/[neighborhoodSlug]/page.tsx", "content": "..." },
    { "path": "src/app/blog/page.tsx", "content": "..." },
    { "path": "src/app/blog/[postSlug]/page.tsx", "content": "..." },
    { "path": "src/app/sitemap.ts", "content": "..." }
  ]
}

## REQUIRED FILES

### 1. src/app/services/page.tsx (Services Hub)
- List all services with descriptions
- Links to individual service pages
- generateMetadata for SEO

### 2. src/app/services/[serviceSlug]/page.tsx
Dynamic service page with:
- generateStaticParams() returning all service slugs
- generateMetadata() with service-specific SEO
- Service page content (2000-3000 words):
  - Hero with service name
  - Introduction section
  - "What's Included" section
  - ProcessSteps component
  - Benefits/Features section
  - Service areas section with neighborhood links
  - Pricing factors section
  - FAQSection with service FAQs
  - Related services links
  - CTASection
- ServiceSchema and BreadcrumbSchema components

### 3. src/app/locations/page.tsx (Locations Hub)
- Map of service area
- Grid of all neighborhoods
- SEO content about service area

### 4. src/app/locations/[neighborhoodSlug]/page.tsx
Dynamic neighborhood page with:
- generateStaticParams() returning all neighborhood slugs
- generateMetadata() with location-specific SEO
- Page content (2000-3000 words):
  - Hero with neighborhood name
  - "About [Neighborhood]" content
  - Services available in this area
  - Local expertise content
  - Nearby neighborhoods (internal links)
  - MapSection centered on neighborhood
  - FAQSection with location FAQs
  - CTASection
- LocalBusinessSchema with areaServed

### 5. src/app/blog/page.tsx (Blog Hub)
- Blog post grid
- Category filters
- Featured post

### 6. src/app/blog/[postSlug]/page.tsx
Dynamic blog post page with:
- generateStaticParams() returning all post slugs
- generateMetadata() with post SEO
- Article schema
- Full blog post layout:
  - Breadcrumbs
  - Title, author, date, reading time
  - Table of contents
  - Main content
  - Related services links
  - Related posts
  - Author bio
  - CTASection

### 7. src/app/sitemap.ts
Next.js sitemap generator:
- Homepage priority 1.0
- Services priority 0.9
- Locations priority 0.8
- Blog priority 0.6
- Include all dynamic routes

Generate all 7 files with complete, production-ready code.`;
}

/**
 * STEP 11: API Routes Prompt
 */
export function getAPIRoutesPrompt(config: SiteConfig): string {
  return `You are an expert Next.js API developer. Generate the API route handlers for a lead generation website.

${getBusinessContext(config)}

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/app/api/lead/route.ts", "content": "..." },
    { "path": "src/app/api/health/route.ts", "content": "..." }
  ]
}

## REQUIRED FILES

### 1. src/app/api/lead/route.ts
POST endpoint for lead form submissions:
- Zod validation for: name, email, phone, service, message, source, page
- Return 400 for validation errors
- Return 200 with success message
- Optional: webhook integration via LEAD_WEBHOOK_URL env var
- Log submission details

### 2. src/app/api/health/route.ts
GET endpoint for health checks:
- Return { status: 'healthy', timestamp: ISO string }
- Used by Cloud Run health checks

Generate both files with complete, production-ready code.`;
}

/**
 * Master function to get all prompts in order
 */
export function getAllGenerationPrompts(config: SiteConfig): Array<{
  step: number;
  name: string;
  prompt: string;
}> {
  return [
    { step: 1, name: 'Configuration Files', prompt: getConfigFilesPrompt(config) },
    { step: 2, name: 'Docker & CI/CD', prompt: getDockerCICDPrompt(config) },
    { step: 3, name: 'Core Library', prompt: getCoreLibraryPrompt(config) },
    { step: 4, name: 'Data Files', prompt: getDataFilesPrompt(config) },
    { step: 5, name: 'Layout Components', prompt: getLayoutComponentsPrompt(config) },
    { step: 6, name: 'Section Components', prompt: getSectionComponentsPrompt(config) },
    { step: 7, name: 'UI & Form Components', prompt: getUIComponentsPrompt(config) },
    { step: 8, name: 'SEO Components', prompt: getSEOComponentsPrompt(config) },
    { step: 9, name: 'Core Pages', prompt: getCorePagePrompt(config) },
    { step: 10, name: 'Dynamic Pages', prompt: getDynamicPagesPrompt(config) },
    { step: 11, name: 'API Routes', prompt: getAPIRoutesPrompt(config) },
  ];
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
  coordinates?: { lat: number; lng: number };
  primary_color?: string;
  secondary_color?: string;
  domain?: string;
}): SiteConfig {
  // Parse address string into components
  const addressParts = input.address.split(',').map(p => p.trim());
  const street = addressParts[0] || '';
  const cityFromAddr = addressParts[1] || input.city;
  const stateZip = (addressParts[2] || '').split(' ').filter(Boolean);

  return {
    businessName: input.business_name,
    niche: input.niche,
    nicheSlug: slugify(input.niche),
    city: input.city,
    citySlug: slugify(input.city),
    state: input.state,
    phone: input.phone,
    phoneFormatted: input.phone,
    email: input.email || `info@${slugify(input.business_name)}.com`,
    address: {
      street,
      city: cityFromAddr,
      state: input.state,
      zip: stateZip[1] || '',
      full: input.address,
    },
    coordinates: input.coordinates,
    googleMapsEmbedUrl: input.google_maps_embed_url,
    neighborhoods: input.neighborhoods,
    services: input.services,
    businessHours: input.business_hours,
    yearEstablished: input.year_established,
    licenseNumber: input.license_number,
    primaryColor: input.primary_color || '#2563eb',
    secondaryColor: input.secondary_color || '#f59e0b',
    domain: input.domain,
  };
}
