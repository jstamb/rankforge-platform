/**
 * Comprehensive Next.js 14 Lead Generation Website Builder Prompts
 *
 * This file contains complete code templates and prompts for generating production-ready
 * Next.js 14 applications optimized for local SEO and Google Maps ranking.
 *
 * Based on the Lead Gen Website Builder specification (2751 lines).
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
 * Generate hex color variations from a base color
 */
function generateColorScale(baseColor: string): Record<string, string> {
  // Simple color scale generation - in production you'd use a proper color library
  return {
    '50': adjustLightness(baseColor, 0.95),
    '100': adjustLightness(baseColor, 0.9),
    '200': adjustLightness(baseColor, 0.8),
    '300': adjustLightness(baseColor, 0.6),
    '400': adjustLightness(baseColor, 0.4),
    '500': baseColor,
    '600': adjustLightness(baseColor, -0.1),
    '700': adjustLightness(baseColor, -0.2),
    '800': adjustLightness(baseColor, -0.3),
    '900': adjustLightness(baseColor, -0.4),
  };
}

function adjustLightness(hex: string, percent: number): string {
  // Simple lightness adjustment - returns same color for simplicity
  // Gemini will generate proper color scales
  return hex;
}

// ============================================
// STEP 1: CONFIGURATION FILES
// ============================================

export function getConfigFilesTemplate(config: SiteConfig): GeneratedFile[] {
  const businessSlug = slugify(config.businessName);
  const domain = config.domain || `${businessSlug}.com`;

  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: `${businessSlug}-website`,
        version: '1.0.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start -p $PORT',
          lint: 'next lint',
          postbuild: 'next-sitemap',
        },
        dependencies: {
          next: '14.2.0',
          react: '^18.3.0',
          'react-dom': '^18.3.0',
          'react-hook-form': '^7.51.0',
          '@hookform/resolvers': '^3.3.4',
          zod: '^3.22.4',
          clsx: '^2.1.0',
          'tailwind-merge': '^2.2.0',
          'lucide-react': '^0.356.0',
        },
        devDependencies: {
          '@types/node': '^20.11.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          autoprefixer: '^10.4.18',
          eslint: '^8.57.0',
          'eslint-config-next': '14.2.0',
          'next-sitemap': '^4.2.3',
          postcss: '^8.4.35',
          tailwindcss: '^3.4.1',
          typescript: '^5.4.0',
        },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          plugins: [{ name: 'next' }],
          paths: {
            '@/*': ['./src/*'],
            '@/components/*': ['./src/components/*'],
            '@/lib/*': ['./src/lib/*'],
            '@/data/*': ['./src/data/*'],
            '@/types/*': ['./src/types/*'],
            '@/hooks/*': ['./src/hooks/*'],
          },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      }, null, 2),
    },
    {
      path: 'next.config.js',
      content: `/** @type {import('next').NextConfig} */
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
        source: '/:path((?!api|_next|.*\\\\..*).*[^\\/])',
        destination: '/:path/',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
`,
    },
    {
      path: 'tailwind.config.ts',
      content: `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          300: 'var(--color-primary-300)',
          400: 'var(--color-primary-400)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          800: 'var(--color-primary-800)',
          900: 'var(--color-primary-900)',
        },
        secondary: {
          50: 'var(--color-secondary-50)',
          500: 'var(--color-secondary-500)',
          600: 'var(--color-secondary-600)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-heading)', 'system-ui', 'sans-serif'],
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
        },
      },
    },
  },
  plugins: [],
};

export default config;
`,
    },
    {
      path: 'postcss.config.js',
      content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
    },
    {
      path: 'next-sitemap.config.js',
      content: `/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.SITE_URL || 'https://${domain}',
  generateRobotsTxt: true,
  generateIndexSitemap: false,
  changefreq: 'weekly',
  priority: 0.7,
  sitemapSize: 5000,

  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/_next/'],
      },
    ],
  },

  transform: async (config, path) => {
    let priority = 0.7;
    let changefreq = 'weekly';

    if (path === '/') {
      priority = 1.0;
      changefreq = 'daily';
    } else if (path.startsWith('/services/')) {
      priority = 0.9;
    } else if (path.startsWith('/locations/')) {
      priority = 0.8;
    } else if (path.startsWith('/blog/')) {
      priority = 0.6;
      changefreq = 'monthly';
    }

    return {
      loc: path,
      changefreq,
      priority,
      lastmod: new Date().toISOString(),
    };
  },
};
`,
    },
  ];
}

// ============================================
// STEP 2: DOCKER & CI/CD FILES
// ============================================

export function getDockerCICDTemplate(config: SiteConfig): GeneratedFile[] {
  const businessSlug = slugify(config.businessName);
  const serviceName = config.cloudRunServiceName || `${businessSlug}-website`;
  const domain = config.domain || `${businessSlug}.com`;
  const gcpProjectId = config.gcpProjectId || 'PROJECT_ID';
  const gcpRegion = config.gcpRegion || 'us-central1';

  return [
    {
      path: 'Dockerfile',
      content: `# ============================================
# STAGE 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ============================================
# STAGE 2: Builder
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ============================================
# STAGE 3: Runner (Production)
# ============================================
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
`,
    },
    {
      path: '.dockerignore',
      content: `# Dependencies
node_modules
npm-debug.log*

# Build outputs
.next
out
build
dist

# Environment files
.env
.env.*
!.env.example

# IDE
.idea
.vscode
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Git
.git
.gitignore

# Docker
Dockerfile*
docker-compose*
.docker

# CI/CD
.github
cloudbuild.yaml

# Testing
coverage
.nyc_output

# Misc
README.md
*.md
`,
    },
    {
      path: 'cloudbuild.yaml',
      content: `# Google Cloud Build configuration for Cloud Run deployment

substitutions:
  _SERVICE_NAME: '${serviceName}'
  _REGION: '${gcpRegion}'
  _NEXT_PUBLIC_SITE_URL: 'https://${domain}'
  _NEXT_PUBLIC_GA_ID: ''

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'

steps:
  - name: 'gcr.io/cloud-builders/docker'
    id: 'build'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/\${_SERVICE_NAME}:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/\${_SERVICE_NAME}:latest'
      - '--build-arg'
      - 'NEXT_PUBLIC_SITE_URL=\${_NEXT_PUBLIC_SITE_URL}'
      - '--build-arg'
      - 'NEXT_PUBLIC_GA_ID=\${_NEXT_PUBLIC_GA_ID}'
      - '--cache-from'
      - 'gcr.io/$PROJECT_ID/\${_SERVICE_NAME}:latest'
      - '.'
    timeout: '600s'

  - name: 'gcr.io/cloud-builders/docker'
    id: 'push'
    args:
      - 'push'
      - '--all-tags'
      - 'gcr.io/$PROJECT_ID/\${_SERVICE_NAME}'
    waitFor: ['build']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'deploy'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - '\${_SERVICE_NAME}'
      - '--image'
      - 'gcr.io/$PROJECT_ID/\${_SERVICE_NAME}:$COMMIT_SHA'
      - '--region'
      - '\${_REGION}'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--port'
      - '8080'
      - '--cpu'
      - '1'
      - '--memory'
      - '512Mi'
      - '--min-instances'
      - '0'
      - '--max-instances'
      - '10'
      - '--concurrency'
      - '80'
      - '--timeout'
      - '300s'
      - '--set-env-vars'
      - 'NODE_ENV=production'
    waitFor: ['push']

images:
  - 'gcr.io/$PROJECT_ID/\${_SERVICE_NAME}:$COMMIT_SHA'
  - 'gcr.io/$PROJECT_ID/\${_SERVICE_NAME}:latest'

timeout: '1200s'
`,
    },
    {
      path: '.github/workflows/deploy.yml',
      content: `name: Build and Deploy to Cloud Run

on:
  push:
    branches:
      - main
      - master
  pull_request:
    branches:
      - main
      - master

env:
  PROJECT_ID: \${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: ${serviceName}
  REGION: ${gcpRegion}

jobs:
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run TypeScript check
        run: npx tsc --noEmit

  deploy:
    name: Build & Deploy
    needs: lint
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: \${{ env.PROJECT_ID }}

      - name: Configure Docker
        run: gcloud auth configure-docker --quiet

      - name: Build Docker image
        run: |
          docker build \\
            --build-arg NEXT_PUBLIC_SITE_URL=\${{ secrets.SITE_URL }} \\
            --build-arg NEXT_PUBLIC_GA_ID=\${{ secrets.GA_ID }} \\
            --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=\${{ secrets.GOOGLE_MAPS_API_KEY }} \\
            -t gcr.io/\${{ env.PROJECT_ID }}/\${{ env.SERVICE_NAME }}:\${{ github.sha }} \\
            -t gcr.io/\${{ env.PROJECT_ID }}/\${{ env.SERVICE_NAME }}:latest \\
            .

      - name: Push Docker image
        run: |
          docker push gcr.io/\${{ env.PROJECT_ID }}/\${{ env.SERVICE_NAME }}:\${{ github.sha }}
          docker push gcr.io/\${{ env.PROJECT_ID }}/\${{ env.SERVICE_NAME }}:latest

      - name: Deploy to Cloud Run
        id: deploy
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: \${{ env.SERVICE_NAME }}
          region: \${{ env.REGION }}
          image: gcr.io/\${{ env.PROJECT_ID }}/\${{ env.SERVICE_NAME }}:\${{ github.sha }}
          flags: |
            --allow-unauthenticated
            --port=8080
            --cpu=1
            --memory=512Mi
            --min-instances=0
            --max-instances=10
            --concurrency=80

      - name: Show deployment URL
        run: echo "Deployed to \${{ steps.deploy.outputs.url }}"
`,
    },
    {
      path: '.gitignore',
      content: `# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage

# Next.js
.next/
out/

# Production
build
dist

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# IDE
.idea
.vscode
*.swp
*.swo
`,
    },
    {
      path: '.env.example',
      content: `# Site Configuration
NEXT_PUBLIC_SITE_URL=https://${domain}

# Google Maps
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here

# Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

# Lead Handling
LEAD_WEBHOOK_URL=https://hooks.zapier.com/xxxxx

# GCP Configuration (for CI/CD)
GCP_PROJECT_ID=${gcpProjectId}
CLOUD_RUN_SERVICE_NAME=${serviceName}
`,
    },
  ];
}

// ============================================
// STEP 3: CORE TYPES
// ============================================

export function getCoreTypesTemplate(config: SiteConfig): GeneratedFile[] {
  return [
    {
      path: 'src/types/index.ts',
      content: `// ============================================
// Site Configuration Types
// ============================================

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
  address: Address;
  coordinates: Coordinates;
  googleMapsEmbedUrl: string;
  googleMapsApiKey?: string;
  googlePlaceId?: string;
  domain: string;
  yearEstablished: number;
  licenseNumber?: string;
  businessHours: BusinessHours;
  socialLinks: SocialLinks;
  branding: Branding;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  full: string;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export type DayHours = { open: string; close: string } | 'closed';

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  yelp?: string;
  googleBusiness?: string;
}

export interface Branding {
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
}

// ============================================
// Service Types
// ============================================

export interface Service {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  icon: string;
  features: string[];
  benefits: string[];
  process: ProcessStep[];
  faqs: FAQ[];
  relatedServices: string[];
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
}

export interface ProcessStep {
  step: number;
  title: string;
  description: string;
  icon?: string;
}

// ============================================
// Location Types
// ============================================

export interface Neighborhood {
  id: string;
  name: string;
  slug: string;
  city: string;
  description: string;
  coordinates: Coordinates;
  zipCodes: string[];
  nearbyNeighborhoods: string[];
  landmarks?: string[];
  metaTitle: string;
  metaDescription: string;
}

// ============================================
// Content Types
// ============================================

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  source: 'google' | 'yelp' | 'facebook' | 'direct';
  serviceType?: string;
  neighborhood?: string;
  verified: boolean;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: Author;
  publishedAt: string;
  updatedAt: string;
  featuredImage: string;
  category: string;
  tags: string[];
  relatedServices: string[];
  relatedPosts: string[];
  metaTitle: string;
  metaDescription: string;
  readingTime: number;
}

export interface Author {
  name: string;
  title: string;
  bio: string;
  image?: string;
}

// ============================================
// Form Types
// ============================================

export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  preferredContact: 'phone' | 'email';
  preferredTime?: string;
}

export interface QuoteFormData extends ContactFormData {
  address: string;
  projectTimeline: string;
  budget?: string;
}

// ============================================
// SEO Types
// ============================================

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  openGraph: OpenGraphMeta;
  keywords?: string[];
  robots?: string;
}

export interface OpenGraphMeta {
  title: string;
  description: string;
  url: string;
  siteName: string;
  images: OGImage[];
  locale: string;
  type: string;
}

export interface OGImage {
  url: string;
  width: number;
  height: number;
  alt: string;
}

// ============================================
// Schema Types
// ============================================

export interface LocalBusinessSchema {
  '@context': 'https://schema.org';
  '@type': string;
  name: string;
  image: string;
  url: string;
  telephone: string;
  priceRange: string;
  address: PostalAddressSchema;
  geo: GeoSchema;
  openingHoursSpecification: OpeningHoursSchema[];
  sameAs: string[];
  areaServed: AreaServedSchema;
}

export interface PostalAddressSchema {
  '@type': 'PostalAddress';
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  addressCountry: string;
}

export interface GeoSchema {
  '@type': 'GeoCoordinates';
  latitude: number;
  longitude: number;
}

export interface OpeningHoursSchema {
  '@type': 'OpeningHoursSpecification';
  dayOfWeek: string | string[];
  opens: string;
  closes: string;
}

export interface AreaServedSchema {
  '@type': 'City' | 'State';
  name: string;
}
`,
    },
  ];
}

// ============================================
// STEP 4: LIBRARY FILES
// ============================================

export function getLibraryFilesTemplate(config: SiteConfig): GeneratedFile[] {
  const businessSlug = slugify(config.businessName);
  const domain = config.domain || `${businessSlug}.com`;

  return [
    {
      path: 'src/lib/config.ts',
      content: `import { SiteConfig } from '@/types';

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

  coordinates: {
    lat: ${config.coordinates?.lat || 0},
    lng: ${config.coordinates?.lng || 0},
  },

  googleMapsEmbedUrl: '${config.googleMapsEmbedUrl || ''}',
  googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  googlePlaceId: '${config.googlePlaceId || ''}',

  domain: '${domain}',
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

  socialLinks: {
    facebook: '',
    instagram: '',
    yelp: '',
    googleBusiness: '',
  },

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
`,
    },
    {
      path: 'src/lib/utils.ts',
      content: `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\\w\\s-]/g, '')
    .replace(/\\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function unslugify(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function calculateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getYearsInBusiness(yearEstablished: number): number {
  return new Date().getFullYear() - yearEstablished;
}
`,
    },
    {
      path: 'src/lib/seo.ts',
      content: `import { Metadata } from 'next';
import { siteConfig, getFullUrl } from './config';

interface GenerateMetadataOptions {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  images?: { url: string; alt: string }[];
  noIndex?: boolean;
}

export function generateMetadata({
  title,
  description,
  path,
  keywords = [],
  images = [],
  noIndex = false,
}: GenerateMetadataOptions): Metadata {
  const url = getFullUrl(path);
  const fullTitle = \`\${title} | \${siteConfig.businessName}\`;

  const defaultImage = {
    url: getFullUrl('/images/og-image.jpg'),
    width: 1200,
    height: 630,
    alt: siteConfig.businessName,
  };

  return {
    title: fullTitle,
    description,
    keywords: [...keywords, siteConfig.niche, siteConfig.city, siteConfig.state],
    authors: [{ name: siteConfig.businessName }],

    metadataBase: new URL(getFullUrl('/')),

    alternates: {
      canonical: url,
    },

    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: siteConfig.businessName,
      images: images.length > 0
        ? images.map(img => ({ ...img, width: 1200, height: 630 }))
        : [defaultImage],
      locale: 'en_US',
      type: 'website',
    },

    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: images.length > 0 ? images.map(img => img.url) : [defaultImage.url],
    },

    robots: noIndex ? {
      index: false,
      follow: true,
    } : {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },

    other: {
      'geo.region': \`US-\${siteConfig.state}\`,
      'geo.placename': siteConfig.city,
      'geo.position': \`\${siteConfig.coordinates.lat};\${siteConfig.coordinates.lng}\`,
      'ICBM': \`\${siteConfig.coordinates.lat}, \${siteConfig.coordinates.lng}\`,
    },
  };
}

export function generateTitle(
  primaryKeyword: string,
  includeCity: boolean = true,
  suffix?: string
): string {
  const parts = [primaryKeyword];

  if (includeCity) {
    parts.push(\`\${siteConfig.city}, \${siteConfig.state}\`);
  }

  if (suffix) {
    parts.push(suffix);
  }

  return parts.join(' | ');
}

export function generateDescription(
  primaryKeyword: string,
  uniqueValue: string,
  cta: string = 'Call for a free estimate!'
): string {
  const desc = \`\${primaryKeyword} in \${siteConfig.city}, \${siteConfig.state}. \${uniqueValue} \${cta}\`;
  return desc.length > 160 ? desc.slice(0, 157) + '...' : desc;
}
`,
    },
    {
      path: 'src/lib/schema.ts',
      content: `import { siteConfig } from './config';
import { Service, FAQ, Review } from '@/types';

export function generateLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': determineBusinessType(siteConfig.niche),
    name: siteConfig.businessName,
    image: \`https://\${siteConfig.domain}/images/logo.svg\`,
    url: \`https://\${siteConfig.domain}\`,
    telephone: siteConfig.phone,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: siteConfig.address.street,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.state,
      postalCode: siteConfig.address.zip,
      addressCountry: 'US',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: siteConfig.coordinates.lat,
      longitude: siteConfig.coordinates.lng,
    },
    openingHoursSpecification: generateOpeningHours(),
    sameAs: Object.values(siteConfig.socialLinks).filter(Boolean),
    areaServed: {
      '@type': 'City',
      name: siteConfig.city,
    },
  };
}

export function generateServiceSchema(service: Service) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: service.name,
    provider: {
      '@type': 'LocalBusiness',
      name: siteConfig.businessName,
    },
    areaServed: {
      '@type': 'City',
      name: siteConfig.city,
    },
    description: service.description,
  };
}

export function generateFAQSchema(faqs: FAQ[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateReviewSchema(reviews: Review[]) {
  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: siteConfig.businessName,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: avgRating.toFixed(1),
      reviewCount: reviews.length,
      bestRating: '5',
      worstRating: '1',
    },
    review: reviews.slice(0, 10).map(review => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: review.rating,
      },
      author: {
        '@type': 'Person',
        name: review.author,
      },
      reviewBody: review.text,
      datePublished: review.date,
    })),
  };
}

function determineBusinessType(niche: string): string {
  const typeMap: { [key: string]: string } = {
    plumber: 'Plumber',
    plumbing: 'Plumber',
    electrician: 'Electrician',
    electrical: 'Electrician',
    hvac: 'HVACBusiness',
    roofer: 'RoofingContractor',
    roofing: 'RoofingContractor',
    landscaper: 'LandscapingBusiness',
    landscaping: 'LandscapingBusiness',
    painter: 'HousePainter',
    painting: 'HousePainter',
    cleaner: 'CleaningService',
    cleaning: 'CleaningService',
    'water damage': 'HomeAndConstructionBusiness',
    restoration: 'HomeAndConstructionBusiness',
    default: 'HomeAndConstructionBusiness',
  };

  const lowerNiche = niche.toLowerCase();
  return typeMap[lowerNiche] || typeMap.default;
}

function generateOpeningHours() {
  const hours = siteConfig.businessHours;
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return days
    .filter(day => hours[day as keyof typeof hours] !== 'closed')
    .map(day => {
      const dayHours = hours[day as keyof typeof hours];
      if (dayHours === 'closed') return null;

      return {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: day.charAt(0).toUpperCase() + day.slice(1),
        opens: dayHours.open,
        closes: dayHours.close,
      };
    })
    .filter(Boolean);
}
`,
    },
  ];
}

// ============================================
// STEP 5: DATA FILES PROMPT (AI GENERATES CONTENT)
// ============================================

export function getDataFilesPrompt(config: SiteConfig): string {
  return `You are an expert SEO content strategist. Generate comprehensive data files for a ${config.niche} website in ${config.city}, ${config.state}.

## BUSINESS INFORMATION
- Business Name: ${config.businessName}
- Niche: ${config.niche}
- City: ${config.city}, ${config.state}
- Phone: ${config.phone}
- Services: ${config.services.join(', ')}
- Neighborhoods: ${config.neighborhoods.join(', ')}
- Year Established: ${config.yearEstablished}

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/data/services.ts", "content": "..." },
    { "path": "src/data/neighborhoods.ts", "content": "..." },
    { "path": "src/data/reviews.ts", "content": "..." },
    { "path": "src/data/faqs.ts", "content": "..." }
  ]
}

## REQUIREMENTS FOR EACH FILE

### 1. src/data/services.ts
Generate ${config.services.length} detailed service objects for: ${config.services.join(', ')}

Each service MUST include ALL of these fields with substantial content:
- id: unique slug-based ID (e.g., "water-damage-restoration")
- name: Service display name (e.g., "Water Damage Restoration")
- slug: URL-friendly slug (e.g., "water-damage-restoration")
- shortDescription: 1-2 sentences, 50-100 characters
- description: 300-500 word detailed description with local references to ${config.city}
- icon: Lucide icon name (Droplets, Flame, Wind, Wrench, Home, Shield, Zap, Thermometer, etc.)
- features: Array of 6-8 specific features as strings
- benefits: Array of 5-6 customer benefits
- process: Array of 4-6 ProcessStep objects with { step: number, title: string, description: string }
- faqs: Array of 5-8 FAQ objects with { id, question, answer, category }
- relatedServices: Array of 2-3 related service IDs
- metaTitle: 50-60 chars, keyword-optimized (e.g., "Water Damage Restoration in ${config.city}, ${config.state}")
- metaDescription: 150-160 chars with CTA
- keywords: Array of 8-12 relevant keywords

Export: services array, getServiceBySlug(slug), getServiceById(id) functions.

### 2. src/data/neighborhoods.ts
Generate ${config.neighborhoods.length} neighborhood objects for: ${config.neighborhoods.join(', ')}

Each neighborhood MUST include:
- id: unique ID
- name: Neighborhood name
- slug: URL-friendly slug
- city: "${config.city}"
- description: 200-300 word description with local knowledge, landmarks, and character
- coordinates: { lat, lng } - approximate coordinates in ${config.city} area
- zipCodes: Array of 1-3 relevant zip codes
- nearbyNeighborhoods: Array of 2-4 IDs of adjacent areas
- landmarks: Array of 3-5 local landmarks or points of interest
- metaTitle: "${config.niche} in [Neighborhood], ${config.city}"
- metaDescription: 150-160 chars

Export: neighborhoods array, getNeighborhoodBySlug(slug) function.

### 3. src/data/reviews.ts
Generate 12-15 realistic customer reviews with:
- id: unique ID
- author: Realistic first name + last initial
- rating: Mix of 4-5 stars (mostly 5)
- text: 2-4 sentence review mentioning specific services and ${config.city}
- date: ISO date string from last 2 years
- source: 'google' | 'yelp' | 'facebook' | 'direct'
- serviceType: One of the services
- neighborhood: One of the neighborhoods
- verified: true

Export: reviews array.

### 4. src/data/faqs.ts
Generate 25-30 FAQs organized by category:
Categories: general, pricing, services, process, emergency, warranty
4-6 FAQs per category with:
- id: unique ID
- question: Long-tail keyword question
- answer: 50-150 word detailed answer with ${config.city} references
- category: one of the categories

Export: faqs array, getFAQsByCategory(category) function.

IMPORTANT: Generate complete, production-ready TypeScript code with proper imports, types, and exports. All content must be SEO-optimized and locally relevant to ${config.city}.`;
}

// ============================================
// STEP 6: UI COMPONENTS PROMPT (AI GENERATES)
// ============================================

export function getUIComponentsPrompt(config: SiteConfig): string {
  return `You are an expert React/Next.js developer. Generate the UI components for a ${config.niche} website.

## DESIGN REQUIREMENTS
- Primary color: ${config.primaryColor}
- Secondary color: ${config.secondaryColor}
- Modern, professional design
- Mobile-first responsive
- Accessible (WCAG AA)

## OUTPUT FORMAT
Return a JSON object with:
{
  "files": [
    { "path": "src/components/ui/Button.tsx", "content": "..." },
    ...
  ]
}

## REQUIRED COMPONENTS

### 1. src/components/ui/Button.tsx
- Variants: primary, secondary, outline, ghost
- Sizes: sm, md, lg
- Support for icons, loading state
- Use cn() from @/lib/utils
- ForwardRef for form compatibility

### 2. src/components/ui/Card.tsx
- Header, content, footer slots
- Shadow and hover variants
- Responsive padding

### 3. src/components/ui/Input.tsx
- Label, error state, helper text
- ForwardRef for React Hook Form
- Focus ring with primary color

### 4. src/components/ui/Select.tsx
- Native select styled consistently
- Label, error state
- ForwardRef

### 5. src/components/ui/Textarea.tsx
- Multi-line with label, error
- Optional character count

### 6. src/components/ui/Badge.tsx
- Variants: default, success, warning, error

### 7. src/components/ui/Accordion.tsx
- Animated expand/collapse
- Plus/minus icons

### 8. src/components/ui/StarRating.tsx
- Display star rating (1-5)
- Props: rating, showCount?

### 9. src/components/ui/PhoneLink.tsx
- Clickable tel: link
- Optional icon

Generate complete TypeScript/React components with proper imports, types, and Tailwind CSS styling.`;
}

// ============================================
// STEP 7: LAYOUT COMPONENTS PROMPT
// ============================================

export function getLayoutComponentsPrompt(config: SiteConfig): string {
  return `You are an expert React/Next.js developer. Generate layout components for a ${config.niche} website in ${config.city}.

## BUSINESS INFO
- Business: ${config.businessName}
- Phone: ${config.phone}
- Services: ${config.services.join(', ')}
- Neighborhoods: ${config.neighborhoods.join(', ')}

## DESIGN
- Primary: ${config.primaryColor}
- Secondary: ${config.secondaryColor}
- Phone CTA always visible

## OUTPUT FORMAT
{
  "files": [
    { "path": "src/components/layout/Header.tsx", "content": "..." },
    { "path": "src/components/layout/Footer.tsx", "content": "..." },
    { "path": "src/components/layout/Navigation.tsx", "content": "..." },
    { "path": "src/components/layout/MobileMenu.tsx", "content": "..." },
    { "path": "src/components/layout/Breadcrumbs.tsx", "content": "..." }
  ]
}

## REQUIREMENTS

### Header.tsx
- Sticky header that changes on scroll
- Logo/business name on left
- Desktop navigation with dropdowns for Services and Locations
- Phone number CTA button (always visible, uses siteConfig)
- Mobile hamburger menu trigger
- Lucide icons (Phone, Menu, X, ChevronDown)

### Footer.tsx
- Contact info section (address, phone, email from siteConfig)
- Service links (import from @/data/services)
- Location links (import from @/data/neighborhoods)
- Business hours
- License info if available
- Copyright with current year
- 4-column responsive grid

### Navigation.tsx
- Desktop mega-menu style
- Services dropdown with all services
- Locations dropdown with neighborhoods
- Smooth hover transitions
- Proper accessibility

### MobileMenu.tsx
- Full-screen slide-out
- Accordion-style sections
- Phone CTA prominent
- Smooth animations
- Close on navigation

### Breadcrumbs.tsx
- Takes items array: {name, href}[]
- Schema.org BreadcrumbList markup
- Responsive (truncates on mobile)

Generate complete TypeScript/React components importing from @/lib/config, @/data/services, @/data/neighborhoods.`;
}

// ============================================
// STEP 8: SECTION COMPONENTS PROMPT
// ============================================

export function getSectionComponentsPrompt(config: SiteConfig): string {
  const yearsInBusiness = new Date().getFullYear() - config.yearEstablished;

  return `You are an expert React/Next.js developer. Generate section components for a ${config.niche} lead generation website.

## BUSINESS INFO
- Business: ${config.businessName}
- City: ${config.city}, ${config.state}
- Phone: ${config.phone}
- Years in business: ${yearsInBusiness}

## DESIGN
- Primary: ${config.primaryColor}
- Secondary: ${config.secondaryColor}
- Conversion-focused
- Phone clickable everywhere

## OUTPUT FORMAT
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

## REQUIREMENTS

### Hero.tsx
Props: title: string, subtitle: string, backgroundImage?: string, showForm?: boolean
- Full-width with gradient overlay
- Large H1 heading
- Two CTAs: "Call Now" and "Get Free Quote"
- Optional embedded HeroForm

### HeroForm.tsx
- Compact lead capture
- Fields: Name, Phone, Service dropdown, Message (optional)
- React Hook Form + Zod validation
- Submit to /api/lead
- Success/error states

### TrustBar.tsx
- Horizontal trust indicators:
  - "${yearsInBusiness}+ Years in Business"
  - "Licensed & Insured"
  - "5-Star Reviews"
  - "24/7 Emergency Service"
- Icons for each

### ServicesGrid.tsx
Props: services: Service[], compact?: boolean
- Responsive grid (1-2-3 columns)
- Service cards with icon, name, description
- Link to service page
- Import Service type from @/types

### ReviewsSection.tsx
Props: reviews: Review[], title?: string
- Section header with aggregate rating
- Review cards in grid
- Star ratings, author, date, source

### FAQSection.tsx
Props: faqs: FAQ[], title?: string
- Accordion-style expandable
- Smooth animation
- JSON-LD FAQPage schema

### CTASection.tsx
Props: title?: string, subtitle?: string
- Full-width secondary color background
- Large heading with phone number
- Primary CTA button

### MapSection.tsx
Props: title?: string, coordinates?: {lat, lng}
- Google Maps iframe embed
- Business address displayed
- "Get Directions" link

### ServiceAreas.tsx
Props: neighborhoods: Neighborhood[]
- Grid of neighborhood cards
- Links to neighborhood pages
- Map pin icons

### ProcessSteps.tsx
Props: steps: ProcessStep[], title?: string
- Numbered steps
- Icon for each
- Timeline style on desktop

Generate complete TypeScript/React components with proper imports and types.`;
}

// ============================================
// STEP 9: SEO COMPONENTS PROMPT
// ============================================

export function getSEOComponentsPrompt(config: SiteConfig): string {
  return `You are an expert SEO developer. Generate Schema.org markup components.

## OUTPUT FORMAT
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

## REQUIREMENTS

### SchemaMarkup.tsx
Props: schema: object
- Generic wrapper
- Renders JSON-LD script tag

### LocalBusinessSchema.tsx
- Imports generateLocalBusinessSchema from @/lib/schema
- Renders full LocalBusiness schema

### ServiceSchema.tsx
Props: service: Service
- Imports generateServiceSchema from @/lib/schema

### FAQSchema.tsx
Props: faqs: FAQ[]
- Imports generateFAQSchema from @/lib/schema

### BreadcrumbSchema.tsx
Props: items: {name: string, url: string}[]
- Imports generateBreadcrumbSchema from @/lib/schema

### ReviewSchema.tsx
Props: reviews: Review[]
- Imports generateReviewSchema from @/lib/schema

All components render proper JSON-LD in script tags.`;
}

// ============================================
// STEP 10: FORM COMPONENTS PROMPT
// ============================================

export function getFormComponentsPrompt(config: SiteConfig): string {
  return `You are an expert React/Next.js developer. Generate form components for lead generation.

## OUTPUT FORMAT
{
  "files": [
    { "path": "src/components/forms/ContactForm.tsx", "content": "..." },
    { "path": "src/components/forms/QuoteForm.tsx", "content": "..." },
    { "path": "src/components/forms/FormSuccess.tsx", "content": "..." }
  ]
}

## REQUIREMENTS

### ContactForm.tsx
- Fields: Name, Email, Phone, Service (dropdown), Message
- React Hook Form + Zod validation
- Submit to /api/lead
- Loading, success, error states
- Imports services from @/data/services for dropdown
- Proper accessibility

### QuoteForm.tsx
- All ContactForm fields plus:
- Address, Preferred contact method, Preferred time, Project timeline
- Submit to /api/lead with type: 'quote'

### FormSuccess.tsx
- Success message display
- Phone number to call
- Expected response time

Use proper TypeScript types and import from @/types.`;
}

// ============================================
// STEP 11: APP PAGES PROMPT
// ============================================

export function getAppPagesPrompt(config: SiteConfig): string {
  return `You are an expert Next.js developer. Generate the app pages for a ${config.niche} website in ${config.city}.

## BUSINESS INFO
- Business: ${config.businessName}
- Niche: ${config.niche}
- City: ${config.city}, ${config.state}
- Phone: ${config.phone}
- Services: ${config.services.join(', ')}
- Year Established: ${config.yearEstablished}

## OUTPUT FORMAT
{
  "files": [
    { "path": "src/app/layout.tsx", "content": "..." },
    { "path": "src/app/page.tsx", "content": "..." },
    { "path": "src/app/globals.css", "content": "..." },
    { "path": "src/app/not-found.tsx", "content": "..." },
    { "path": "src/app/about/page.tsx", "content": "..." },
    { "path": "src/app/contact/page.tsx", "content": "..." },
    { "path": "src/app/reviews/page.tsx", "content": "..." },
    { "path": "src/app/services/page.tsx", "content": "..." },
    { "path": "src/app/locations/page.tsx", "content": "..." },
    { "path": "src/app/blog/page.tsx", "content": "..." },
    { "path": "src/app/sitemap.ts", "content": "..." }
  ]
}

## REQUIREMENTS

### layout.tsx
- Root layout with HTML lang="en"
- Inter font from next/font/google
- Header and Footer components
- LocalBusinessSchema in head
- Metadata defaults

### page.tsx (Homepage)
- Export generateMetadata with:
  - Title: "#1 ${config.niche} in ${config.city}, ${config.state}"
  - Description optimized for local SEO
- Page sections:
  - Hero with form
  - TrustBar
  - ServicesGrid
  - "Why Choose Us" section (300-400 words of content)
  - ReviewsSection
  - ServiceAreas
  - MapSection
  - FAQSection (8-10 general FAQs)
  - CTASection

### globals.css
Complete Tailwind CSS with:
- CSS variables for primary (${config.primaryColor}) and secondary (${config.secondaryColor}) colors
- Full color scale (50-900)
- Base styles for html, body, headings
- Component classes: btn, btn-primary, btn-secondary, section, container, card, input, phone-link

### not-found.tsx
- Custom 404 with helpful navigation
- Links to homepage and services

### about/page.tsx
- Company story (300-400 words)
- Mission statement
- Team/expertise section
- CTASection

### contact/page.tsx
- ContactForm component
- Business info sidebar
- MapSection
- Service area summary

### reviews/page.tsx
- Aggregate rating display
- All reviews grid
- CTA to leave review

### services/page.tsx (Services Hub)
- Grid of all services
- Links to individual pages
- SEO metadata

### locations/page.tsx (Locations Hub)
- Map of service area
- Grid of neighborhoods
- SEO content

### blog/page.tsx (Blog Hub)
- Blog post grid
- Category filters

### sitemap.ts
- MetadataRoute.Sitemap
- All pages with priorities:
  - Homepage: 1.0
  - Services: 0.9
  - Locations: 0.8
  - Blog: 0.6

Generate complete TypeScript/React pages with proper imports and generateMetadata exports.`;
}

// ============================================
// STEP 12: DYNAMIC PAGES PROMPT
// ============================================

export function getDynamicPagesPrompt(config: SiteConfig): string {
  return `You are an expert Next.js developer. Generate dynamic route pages for a ${config.niche} website.

## BUSINESS INFO
- Business: ${config.businessName}
- City: ${config.city}, ${config.state}
- Services: ${config.services.join(', ')}
- Neighborhoods: ${config.neighborhoods.join(', ')}

## OUTPUT FORMAT
{
  "files": [
    { "path": "src/app/services/[serviceSlug]/page.tsx", "content": "..." },
    { "path": "src/app/locations/[neighborhoodSlug]/page.tsx", "content": "..." },
    { "path": "src/app/blog/[postSlug]/page.tsx", "content": "..." }
  ]
}

## REQUIREMENTS

### services/[serviceSlug]/page.tsx
- generateStaticParams() returning all service slugs
- generateMetadata() with service-specific SEO
- Page content (2000-3000 words):
  - Hero with service name
  - Introduction section
  - "What's Included" section
  - ProcessSteps component
  - Benefits/Features section
  - Service areas with neighborhood links
  - FAQSection with service FAQs
  - Related services
  - CTASection
- ServiceSchema and BreadcrumbSchema

### locations/[neighborhoodSlug]/page.tsx
- generateStaticParams() for all neighborhoods
- generateMetadata() with location-specific SEO
- Page content (2000-3000 words):
  - Hero with neighborhood name
  - "About [Neighborhood]" content
  - Services available
  - Local expertise
  - Nearby neighborhoods (internal links)
  - MapSection centered on neighborhood
  - FAQSection with location FAQs
  - CTASection

### blog/[postSlug]/page.tsx
- generateStaticParams() for all posts
- generateMetadata() with post SEO
- Article schema
- Layout:
  - Breadcrumbs
  - Title, author, date, reading time
  - Table of contents
  - Main content
  - Related services links
  - Related posts
  - Author bio
  - CTASection

Generate complete pages with proper imports from @/data/services, @/data/neighborhoods, @/lib/seo.`;
}

// ============================================
// STEP 13: API ROUTES TEMPLATE
// ============================================

export function getAPIRoutesTemplate(config: SiteConfig): GeneratedFile[] {
  return [
    {
      path: 'src/app/api/lead/route.ts',
      content: `import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const leadSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  phone: z.string().min(10, 'Valid phone required'),
  service: z.string().min(1, 'Please select a service'),
  message: z.string().optional(),
  source: z.string().optional(),
  page: z.string().optional(),
  type: z.enum(['contact', 'quote']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = leadSchema.parse(body);

    // Log the lead
    console.log('[Lead] New submission:', {
      ...validated,
      timestamp: new Date().toISOString(),
    });

    // Send to webhook if configured
    if (process.env.LEAD_WEBHOOK_URL) {
      try {
        await fetch(process.env.LEAD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...validated,
            timestamp: new Date().toISOString(),
            ip: request.headers.get('x-forwarded-for'),
            userAgent: request.headers.get('user-agent'),
          }),
        });
      } catch (webhookError) {
        console.error('[Lead] Webhook error:', webhookError);
      }
    }

    return NextResponse.json(
      { success: true, message: 'Thank you! We will contact you shortly.' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errors: error.errors },
        { status: 400 }
      );
    }

    console.error('[Lead] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
`,
    },
    {
      path: 'src/app/api/health/route.ts',
      content: `import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    { status: 200 }
  );
}
`,
    },
  ];
}

// ============================================
// MASTER GENERATION FUNCTIONS
// ============================================

/**
 * Get all static templates that don't need AI generation
 */
export function getStaticTemplates(config: SiteConfig): GeneratedFile[] {
  return [
    ...getConfigFilesTemplate(config),
    ...getDockerCICDTemplate(config),
    ...getCoreTypesTemplate(config),
    ...getLibraryFilesTemplate(config),
    ...getAPIRoutesTemplate(config),
  ];
}

/**
 * Get all prompts for AI-generated content in order
 */
export function getAllGenerationPrompts(config: SiteConfig): Array<{
  step: number;
  name: string;
  prompt: string;
  isStaticTemplate?: boolean;
  staticFiles?: GeneratedFile[];
}> {
  return [
    {
      step: 1,
      name: 'Configuration Files',
      prompt: '',
      isStaticTemplate: true,
      staticFiles: getConfigFilesTemplate(config),
    },
    {
      step: 2,
      name: 'Docker & CI/CD',
      prompt: '',
      isStaticTemplate: true,
      staticFiles: getDockerCICDTemplate(config),
    },
    {
      step: 3,
      name: 'Core Types',
      prompt: '',
      isStaticTemplate: true,
      staticFiles: getCoreTypesTemplate(config),
    },
    {
      step: 4,
      name: 'Library Files',
      prompt: '',
      isStaticTemplate: true,
      staticFiles: getLibraryFilesTemplate(config),
    },
    {
      step: 5,
      name: 'Data Files (Services, Neighborhoods, FAQs)',
      prompt: getDataFilesPrompt(config),
    },
    {
      step: 6,
      name: 'UI Components',
      prompt: getUIComponentsPrompt(config),
    },
    {
      step: 7,
      name: 'Layout Components',
      prompt: getLayoutComponentsPrompt(config),
    },
    {
      step: 8,
      name: 'Section Components',
      prompt: getSectionComponentsPrompt(config),
    },
    {
      step: 9,
      name: 'SEO Components',
      prompt: getSEOComponentsPrompt(config),
    },
    {
      step: 10,
      name: 'Form Components',
      prompt: getFormComponentsPrompt(config),
    },
    {
      step: 11,
      name: 'App Pages',
      prompt: getAppPagesPrompt(config),
    },
    {
      step: 12,
      name: 'Dynamic Route Pages',
      prompt: getDynamicPagesPrompt(config),
    },
    {
      step: 13,
      name: 'API Routes',
      prompt: '',
      isStaticTemplate: true,
      staticFiles: getAPIRoutesTemplate(config),
    },
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
