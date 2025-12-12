import { BaseWorker } from '../lib/worker-base.js';
import {
  supabase,
  getDesignSystem,
  getContentIndex,
  getAllPageContent,
  getSEOResearch,
} from '../lib/supabase.js';
import type { GenerationJob } from '../lib/types.js';
import {
  BusinessInput,
  PageContent,
  DesignSystem,
  SiteArchitecture,
  PageDefinition,
} from '../lib/seo-prompts.js';
import { generateNextJSProjectComprehensive } from '../lib/seo-generation.js';
import type { GeneratedFile as ComprehensiveGeneratedFile } from '../lib/nextjs-comprehensive-prompt.js';

/**
 * File Requirements Configuration
 * Defines required files for each pipeline type with validation rules
 */
interface FileRequirement {
  path: string;
  required: boolean;
  minLength?: number;
  mustContain?: string[];
  description: string;
}

const REACT_SPA_REQUIREMENTS: FileRequirement[] = [
  // Build configuration
  { path: 'package.json', required: true, minLength: 100, mustContain: ['"react"', '"vite"'], description: 'Package manifest with React/Vite deps' },
  { path: 'tsconfig.json', required: true, minLength: 50, mustContain: ['compilerOptions'], description: 'TypeScript configuration' },
  { path: 'vite.config.ts', required: true, minLength: 50, mustContain: ['defineConfig'], description: 'Vite bundler configuration' },
  { path: 'tailwind.config.js', required: true, minLength: 50, mustContain: ['content'], description: 'Tailwind CSS configuration' },
  { path: 'postcss.config.js', required: true, minLength: 30, mustContain: ['tailwindcss'], description: 'PostCSS configuration for Tailwind' },

  // Source files
  { path: 'index.html', required: true, minLength: 100, mustContain: ['<!DOCTYPE html>', '<div id="root"'], description: 'HTML entry point' },
  { path: 'src/main.tsx', required: true, minLength: 100, mustContain: ['ReactDOM', 'createRoot'], description: 'React entry point' },
  { path: 'src/App.tsx', required: true, minLength: 100, mustContain: ['export'], description: 'Root React component' },
  { path: 'src/index.css', required: true, minLength: 50, mustContain: ['@tailwind'], description: 'Tailwind CSS entry point' },
  { path: 'src/constants.ts', required: true, minLength: 50, mustContain: ['export'], description: 'Business constants' },

  // Components
  { path: 'src/components/Header.tsx', required: true, minLength: 100, description: 'Header component' },
  { path: 'src/components/Footer.tsx', required: true, minLength: 100, description: 'Footer component' },
  { path: 'src/components/LeadForm.tsx', required: true, minLength: 100, description: 'Lead capture form' },

  // Pages
  { path: 'src/pages/Home.tsx', required: true, minLength: 100, description: 'Home page component' },
  { path: 'src/pages/Contact.tsx', required: true, minLength: 100, description: 'Contact page component' },

  // Deployment
  { path: 'Dockerfile', required: true, minLength: 100, mustContain: ['FROM', 'nginx', 'npm'], description: 'Multi-stage Dockerfile' },
  { path: 'nginx.conf', required: true, minLength: 200, mustContain: ['listen 8080', 'mime.types'], description: 'Nginx configuration' },
  { path: '.github/workflows/deploy.yml', required: true, minLength: 200, mustContain: ['Cloud Run', 'docker'], description: 'GitHub Actions workflow' },
  { path: '.gitignore', required: true, minLength: 50, description: 'Git ignore file' },
];

/**
 * Next.js 14 App Router Requirements
 * Full production-ready Next.js project with SEO optimization
 */
const NEXTJS_14_REQUIREMENTS: FileRequirement[] = [
  // Configuration files
  { path: 'package.json', required: true, minLength: 200, mustContain: ['"next"', '"react"', '"typescript"'], description: 'Package manifest with Next.js dependencies' },
  { path: 'tsconfig.json', required: true, minLength: 100, mustContain: ['compilerOptions'], description: 'TypeScript configuration' },
  { path: 'next.config.js', required: true, minLength: 50, mustContain: ['nextConfig'], description: 'Next.js configuration' },
  { path: 'tailwind.config.ts', required: true, minLength: 100, mustContain: ['content'], description: 'Tailwind CSS configuration' },
  { path: 'postcss.config.js', required: true, minLength: 30, mustContain: ['tailwindcss'], description: 'PostCSS configuration' },

  // App Router structure
  { path: 'src/app/layout.tsx', required: true, minLength: 200, mustContain: ['export default'], description: 'Root layout' },
  { path: 'src/app/page.tsx', required: true, minLength: 500, mustContain: ['export default'], description: 'Homepage' },
  { path: 'src/app/globals.css', required: true, minLength: 50, mustContain: ['@tailwind'], description: 'Global styles' },

  // Core pages
  { path: 'src/app/about/page.tsx', required: true, minLength: 200, description: 'About page' },
  { path: 'src/app/contact/page.tsx', required: true, minLength: 200, description: 'Contact page' },
  { path: 'src/app/services/page.tsx', required: true, minLength: 200, description: 'Services hub' },

  // Dynamic pages
  { path: 'src/app/services/[serviceSlug]/page.tsx', required: true, minLength: 200, mustContain: ['generateStaticParams'], description: 'Dynamic service pages' },
  { path: 'src/app/locations/[neighborhoodSlug]/page.tsx', required: true, minLength: 200, mustContain: ['generateStaticParams'], description: 'Dynamic location pages' },

  // Core components
  { path: 'src/components/layout/Header.tsx', required: true, minLength: 100, description: 'Header component' },
  { path: 'src/components/layout/Footer.tsx', required: true, minLength: 100, description: 'Footer component' },
  { path: 'src/components/forms/ContactForm.tsx', required: true, minLength: 100, description: 'Contact form component' },

  // Data files
  { path: 'src/data/services.ts', required: true, minLength: 200, description: 'Services data' },
  { path: 'src/data/neighborhoods.ts', required: true, minLength: 100, description: 'Neighborhoods data' },

  // Config
  { path: 'src/lib/config.ts', required: true, minLength: 100, description: 'Site configuration' },

  // API routes
  { path: 'src/app/api/lead/route.ts', required: true, minLength: 50, mustContain: ['POST'], description: 'Lead form API' },
  { path: 'src/app/api/health/route.ts', required: true, minLength: 30, description: 'Health check API' },

  // Deployment
  { path: 'Dockerfile', required: true, minLength: 100, mustContain: ['FROM', 'npm', 'standalone'], description: 'Next.js Dockerfile' },
  { path: '.github/workflows/deploy.yml', required: true, minLength: 200, mustContain: ['Cloud Run'], description: 'GitHub Actions workflow' },
  { path: '.gitignore', required: true, minLength: 50, mustContain: ['node_modules', '.next'], description: 'Git ignore file' },
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fileCount: number;
  missingRequired: string[];
}

/**
 * Enhanced Site Builder Worker
 *
 * Converts SEO-optimized content into production-ready static HTML files.
 * Generates:
 * - Static HTML pages with proper schema markup
 * - CSS stylesheet with design system variables
 * - JavaScript for interactions
 * - sitemap.xml
 * - robots.txt
 */
export class SiteBuilderWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'Site Builder',
      jobTypes: ['site_build'],
      pollInterval: 5000,
      maxConcurrent: 2,
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const totalSteps = 5;
    let completedSteps = 0;

    const inputPayload = job.input_payload as any;

    // Check for project type - default to 'nextjs' for new sites
    const projectType = inputPayload?.projectType || 'nextjs';

    // Step 1: Load all resources
    this.currentStep = 'Loading site configuration';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Route to appropriate build method based on project type
    // Default to Next.js for all new sites (static HTML removed)
    if (projectType === 'nextjs' || projectType === 'static') {
      console.log('[SiteBuilder] Using Next.js 14 App Router pipeline');
      return await this.buildNextJSProject(job, inputPayload, completedSteps, totalSteps);
    }

    // Fall back to legacy React SPA pipeline (for backwards compatibility only)
    console.log('[SiteBuilder] Using legacy React SPA pipeline');
    return await this.buildFromLegacyData(job, inputPayload, completedSteps, totalSteps);
  }

  /**
   * Build Next.js 14 App Router project
   *
   * Uses Gemini 2.5 Pro to generate a complete, production-ready Next.js project with:
   * - Full SEO optimization
   * - TypeScript strict mode
   * - Tailwind CSS styling
   * - React Hook Form + Zod validation
   * - Docker + GitHub Actions for Cloud Run deployment
   */
  private async buildNextJSProject(
    job: GenerationJob,
    inputPayload: any,
    completedSteps: number,
    totalSteps: number
  ): Promise<Record<string, unknown>> {
    // Get business data from input or fetch from database
    let businessInput = inputPayload?.business as BusinessInput | undefined;

    if (!businessInput) {
      const { data: website } = await supabase
        .from('websites')
        .select('*, businesses(*)')
        .eq('id', job.website_id)
        .single();

      if (website?.businesses) {
        const b = website.businesses as any;
        businessInput = {
          business_name: b.business_name,
          niche: b.business_type,
          city: b.address_city,
          state: b.address_state,
          phone: b.phone,
          address: `${b.address_street}, ${b.address_city}, ${b.address_state} ${b.address_zip}`,
          neighborhoods: inputPayload?.neighborhoods || [],
          services: b.services || [],
          business_hours: inputPayload?.businessHours || 'Mon-Fri 8am-6pm, Sat 9am-4pm',
          year_established: inputPayload?.yearEstablished || (new Date().getFullYear() - 10),
          license_number: inputPayload?.licenseNumber,
          email: b.email,
          google_maps_embed_url: inputPayload?.googleMapsEmbedUrl,
        };
      }
    }

    if (!businessInput) {
      throw new Error('Business data not found');
    }

    completedSteps++;
    this.currentStep = 'Generating Next.js project with Gemini AI';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Generate the complete Next.js project using Gemini 2.5 Pro
    console.log(`[SiteBuilder] Generating Next.js project for ${businessInput.business_name}...`);

    let projectResult: { files: ComprehensiveGeneratedFile[]; stats: { totalFiles: number; generationTime: string; stepsCompleted: number } };

    try {
      // Use comprehensive multi-step generation with detailed progress tracking
      projectResult = await generateNextJSProjectComprehensive(
        businessInput,
        async (step, totalSteps, stepName, detail) => {
          this.currentStep = `Step ${step}/${totalSteps}: ${stepName}`;
          console.log(`[SiteBuilder] ${this.currentStep} - ${detail}`);
          // Update progress in database for real-time UI updates
          await this.progress(job.id, this.currentStep, completedSteps, totalSteps + 3);
        }
      );
    } catch (error: any) {
      console.error('[SiteBuilder] Comprehensive Next.js generation failed:', error);
      throw new Error(`Failed to generate Next.js project: ${error.message}`);
    }

    const files = projectResult.files;
    console.log(`[SiteBuilder] Generated ${files.length} Next.js project files`);

    completedSteps++;
    this.currentStep = 'Adding deployment configuration';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Ensure critical deployment files exist
    const serviceName = businessInput.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    // Check and add missing deployment files
    if (!files.find(f => f.path === '.github/workflows/deploy.yml')) {
      files.push({
        path: '.github/workflows/deploy.yml',
        content: this.generateNextJSWorkflow(serviceName),
      });
    }

    if (!files.find(f => f.path === 'Dockerfile')) {
      files.push({
        path: 'Dockerfile',
        content: this.generateNextJSDockerfile(),
      });
    }

    if (!files.find(f => f.path === '.dockerignore')) {
      files.push({
        path: '.dockerignore',
        content: this.generateDockerignore(),
      });
    }

    if (!files.find(f => f.path === '.gitignore')) {
      files.push({
        path: '.gitignore',
        content: this.generateNextJSGitignore(),
      });
    }

    if (!files.find(f => f.path === 'cloudbuild.yaml')) {
      files.push({
        path: 'cloudbuild.yaml',
        content: this.generateNextJSCloudBuild(serviceName),
      });
    }

    // Add public folder files for static assets
    const domain = inputPayload?.domain || `${serviceName}.com`;

    // robots.txt in public folder
    if (!files.find(f => f.path === 'public/robots.txt')) {
      files.push({
        path: 'public/robots.txt',
        content: this.generateRobotsTxt(domain),
      });
    }

    // sitemap.xml in public folder (static version, Next.js also has dynamic)
    if (!files.find(f => f.path === 'public/sitemap.xml')) {
      files.push({
        path: 'public/sitemap.xml',
        content: this.generateSitemapXml(domain, businessInput),
      });
    }

    // Placeholder for images directory
    if (!files.find(f => f.path === 'public/images/.gitkeep')) {
      files.push({
        path: 'public/images/.gitkeep',
        content: '# Placeholder for images directory\n',
      });
    }

    // Favicon placeholder
    if (!files.find(f => f.path === 'public/favicon.ico')) {
      files.push({
        path: 'public/favicon.ico',
        content: '', // Empty placeholder - should be replaced with actual favicon
      });
    }

    // OG image placeholder
    if (!files.find(f => f.path === 'public/og-image.jpg')) {
      files.push({
        path: 'public/images/og-image.jpg',
        content: '', // Placeholder - should be generated or uploaded
      });
    }

    completedSteps++;
    this.currentStep = 'Validating generated files';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Validate files
    const validation = this.validateFiles(files, NEXTJS_14_REQUIREMENTS, 'nextjs-14');

    if (!validation.valid) {
      console.warn(`[SiteBuilder] Next.js validation has ${validation.errors.length} errors, ${validation.warnings.length} warnings`);
      // Log warnings but don't fail - some optional files may be missing
      validation.errors.forEach(err => console.warn(`[SiteBuilder] Validation: ${err}`));
    }

    completedSteps++;
    await this.progress(job.id, 'Next.js project build complete', completedSteps, totalSteps);

    // Calculate stats
    const tsxFiles = files.filter(f => f.path.endsWith('.tsx')).length;
    const tsFiles = files.filter(f => f.path.endsWith('.ts')).length;
    const pageFiles = files.filter(f => f.path.includes('/app/') && f.path.endsWith('page.tsx')).length;

    return {
      filesGenerated: files.length,
      files,
      projectType: 'nextjs',
      stats: {
        totalFiles: files.length,
        tsxComponents: tsxFiles,
        tsFiles: tsFiles,
        pages: pageFiles,
        generationTime: projectResult.stats.generationTime,
      },
      validation: {
        passed: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
      },
    };
  }

  /**
   * Generate Next.js 14 Dockerfile (standalone output mode)
   */
  private generateNextJSDockerfile(): string {
    return `# Next.js 14 Production Dockerfile
# Multi-stage build for standalone output

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

CMD ["node", "server.js"]`;
  }

  /**
   * Generate GitHub Actions workflow for Next.js
   */
  private generateNextJSWorkflow(serviceName: string): string {
    return `name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

env:
  PROJECT_ID: \${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: ${serviceName}
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: \${{ secrets.GCP_PROJECT_ID }}

      - name: Create Artifact Registry repository (if not exists)
        run: |
          gcloud artifacts repositories describe cloud-run-source-deploy \\
            --location=\${{ env.REGION }} \\
            --project=\${{ env.PROJECT_ID }} 2>/dev/null || \\
          gcloud artifacts repositories create cloud-run-source-deploy \\
            --repository-format=docker \\
            --location=\${{ env.REGION }} \\
            --project=\${{ env.PROJECT_ID }} \\
            --description="Docker images for Cloud Run deployments"

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker \${{ env.REGION }}-docker.pkg.dev --quiet

      - name: Build Docker image
        run: |
          docker build -t \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} .
          docker tag \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} \\
            \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:latest

      - name: Push Docker image
        run: |
          docker push \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }}
          docker push \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy \${{ env.SERVICE_NAME }} \\
            --image \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} \\
            --region \${{ env.REGION }} \\
            --platform managed \\
            --allow-unauthenticated \\
            --port 8080 \\
            --memory 1Gi \\
            --cpu 1 \\
            --min-instances 0 \\
            --max-instances 10 \\
            --cpu-throttling

      - name: Get Service URL
        run: |
          URL=\$(gcloud run services describe \${{ env.SERVICE_NAME }} --region \${{ env.REGION }} --format 'value(status.url)')
          echo "## 🚀 Deployment Successful!" >> \$GITHUB_STEP_SUMMARY
          echo "" >> \$GITHUB_STEP_SUMMARY
          echo "**Service URL:** \$URL" >> \$GITHUB_STEP_SUMMARY
          echo "Service deployed to: \$URL"`;
  }

  /**
   * Generate Cloud Build config for Next.js
   */
  private generateNextJSCloudBuild(serviceName: string): string {
    return `# Cloud Build configuration for Next.js deployment
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'
      - '.'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${serviceName}'
      - '--image'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'
      - '--region'
      - '\$_REGION'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--port'
      - '8080'
      - '--memory'
      - '1Gi'
      - '--cpu'
      - '1'
      - '--min-instances'
      - '0'
      - '--max-instances'
      - '10'
      - '--cpu-throttling'

images:
  - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'

substitutions:
  _REGION: us-central1

options:
  logging: CLOUD_LOGGING_ONLY`;
  }

  /**
   * Generate .dockerignore for Next.js
   */
  private generateDockerignore(): string {
    return `# Dependencies
node_modules
.pnp
.pnp.js

# Build output
.next
out
build
dist

# Testing
coverage

# Environment
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.idea
.vscode
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Git
.git
.gitignore

# Docker
Dockerfile
.dockerignore
docker-compose*.yml`;
  }

  /**
   * Generate .gitignore for Next.js
   */
  private generateNextJSGitignore(): string {
    return `# Dependencies
node_modules
.pnp
.pnp.js

# Next.js build output
.next
out
build

# Testing
coverage

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.idea
.vscode
*.swp
*.swo
*.sublime-*

# OS
.DS_Store
Thumbs.db
*.log

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Misc
.vercel`;
  }

  /**
   * Generate robots.txt for SEO
   */
  private generateRobotsTxt(domain: string): string {
    return `# robots.txt for ${domain}
User-agent: *
Allow: /

# Sitemap location
Sitemap: https://${domain}/sitemap.xml

# Disallow admin/private areas (if any)
Disallow: /api/
Disallow: /_next/
Disallow: /admin/

# Allow all search engine crawlers
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Slurp
Allow: /

# Crawl-delay for polite crawling (optional)
# Crawl-delay: 10
`;
  }

  /**
   * Generate sitemap.xml for SEO
   */
  private generateSitemapXml(domain: string, businessInput: BusinessInput): string {
    const today = new Date().toISOString().split('T')[0];

    // Build list of URLs
    const urls: Array<{ loc: string; priority: string; changefreq: string }> = [
      { loc: `https://${domain}/`, priority: '1.0', changefreq: 'weekly' },
      { loc: `https://${domain}/about`, priority: '0.8', changefreq: 'monthly' },
      { loc: `https://${domain}/services`, priority: '0.9', changefreq: 'weekly' },
      { loc: `https://${domain}/contact`, priority: '0.8', changefreq: 'monthly' },
    ];

    // Add service pages
    if (businessInput.services && businessInput.services.length > 0) {
      businessInput.services.forEach((service: string) => {
        const slug = service.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        urls.push({
          loc: `https://${domain}/services/${slug}`,
          priority: '0.8',
          changefreq: 'monthly',
        });
      });
    }

    // Add neighborhood/location pages
    if (businessInput.neighborhoods && businessInput.neighborhoods.length > 0) {
      businessInput.neighborhoods.forEach((neighborhood: string) => {
        const slug = neighborhood.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        urls.push({
          loc: `https://${domain}/locations/${slug}`,
          priority: '0.7',
          changefreq: 'monthly',
        });
      });
    }

    // Generate XML
    const urlsXml = urls
      .map(
        (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`
      )
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;
  }

  /**
   * Build site from legacy unified generation pipeline (backwards compatibility)
   */
  private async buildFromLegacyData(
    job: GenerationJob,
    inputPayload: any,
    completedSteps: number,
    totalSteps: number
  ): Promise<Record<string, unknown>> {
    // Design system can come from input_payload (unified worker) or database
    let designSystem = inputPayload?.designSystem;
    if (!designSystem) {
      designSystem = await getDesignSystem(job.website_id);
    }

    if (!designSystem) {
      console.log('[SiteBuilder] Design system not found, waiting 3s for save...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      designSystem = await getDesignSystem(job.website_id);
    }

    if (!designSystem) {
      throw new Error('Design system not found. Run design generation first.');
    }

    // Convert unified worker format to expected format if needed
    if (designSystem.colorPalette && !designSystem.tailwind_config) {
      designSystem = {
        tailwind_config: {
          colors: designSystem.colorPalette,
          fontFamily: {
            heading: [designSystem.typography?.headingFont || 'Inter', 'sans-serif'],
            body: [designSystem.typography?.bodyFont || 'Inter', 'sans-serif'],
          },
        },
        color_palette: designSystem.colorPalette,
        typography: designSystem.typography,
        component_library: designSystem.componentStyles || {},
      };
    }

    const [contentIndex, pageContents, seoResearch] = await Promise.all([
      getContentIndex(job.website_id),
      getAllPageContent(job.website_id),
      getSEOResearch(job.website_id),
    ]);

    // Get business from input or fetch from website
    let business = inputPayload?.business;
    if (!business) {
      const { data: website } = await supabase
        .from('websites')
        .select('*, businesses(*)')
        .eq('id', job.website_id)
        .single();

      if (website?.businesses) {
        const b = website.businesses;
        business = {
          businessName: b.business_name,
          niche: b.business_type,
          businessType: b.business_type,
          phone: b.phone,
          email: b.email,
          description: b.description,
          services: b.services || [],
          yearsInBusiness: 10,
          address: {
            street: b.address_street,
            city: b.address_city,
            state: b.address_state,
            zip: b.address_zip,
          },
          targetCities: inputPayload?.businessInput?.targetCities || [
            { name: b.address_city, state: b.address_state }
          ],
        };
      }
    }

    if (!business) {
      throw new Error('Business data not found');
    }

    completedSteps++;

    // Step 2: Generate project files (React SPA - legacy mode)
    this.currentStep = 'Generating project structure';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const files: Array<{ path: string; content: string }> = [];

    // package.json
    files.push({
      path: 'package.json',
      content: this.generatePackageJson(business.businessName),
    });

    // tsconfig.json
    files.push({
      path: 'tsconfig.json',
      content: this.generateTsConfig(),
    });

    // vite.config.ts
    files.push({
      path: 'vite.config.ts',
      content: this.generateViteConfig(),
    });

    // tailwind.config.js with custom design
    files.push({
      path: 'tailwind.config.js',
      content: this.generateTailwindConfig(designSystem),
    });

    // postcss.config.js - REQUIRED for Tailwind CSS processing
    files.push({
      path: 'postcss.config.js',
      content: this.generatePostcssConfig(),
    });

    // src/index.css - Tailwind CSS entry point
    files.push({
      path: 'src/index.css',
      content: this.generateIndexCss(designSystem),
    });

    completedSteps++;

    // Step 3: Generate index.html
    this.currentStep = 'Generating HTML template';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    files.push({
      path: 'index.html',
      content: this.generateIndexHtml(business, seoResearch),
    });

    completedSteps++;

    // Step 4: Generate React components
    this.currentStep = 'Generating React components';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Main entry files
    files.push({
      path: 'src/main.tsx',
      content: this.generateMainTsx(),
    });

    files.push({
      path: 'src/App.tsx',
      content: this.generateAppTsx(contentIndex || []),
    });

    // Constants
    files.push({
      path: 'src/constants.ts',
      content: this.generateConstants(business, seoResearch),
    });

    // Components from design system (with validation)
    if (designSystem.component_library) {
      for (const [componentName, variations] of Object.entries(
        designSystem.component_library as Record<string, string[]>
      )) {
        if (variations && variations.length > 0) {
          const content = variations[0];
          // Validate component content: must be at least 50 chars and look like React code
          const isValidComponent = content &&
            content.length >= 50 &&
            (content.includes('export') || content.includes('function') || content.includes('const'));

          if (isValidComponent) {
            files.push({
              path: `src/components/${this.capitalize(componentName)}.tsx`,
              content,
            });
          } else {
            console.warn(`[SiteBuilder] Skipping invalid component ${componentName}: content too short or invalid (${content?.length || 0} chars)`);
          }
        }
      }
    }

    // Generate default components if not in design system
    files.push({
      path: 'src/components/Header.tsx',
      content: this.generateHeader(business, designSystem),
    });

    files.push({
      path: 'src/components/Footer.tsx',
      content: this.generateFooter(business, designSystem),
    });

    files.push({
      path: 'src/components/LeadForm.tsx',
      content: this.generateLeadForm(business),
    });

    completedSteps++;

    // Step 5: Generate page components from content
    this.currentStep = 'Generating page components';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // Generate pages directory
    files.push({
      path: 'src/pages/Home.tsx',
      content: this.generateHomePage(business, pageContents || [], designSystem),
    });

    files.push({
      path: 'src/pages/Contact.tsx',
      content: this.generateContactPage(business),
    });

    // Generate dynamic page templates
    files.push({
      path: 'src/pages/LocationPage.tsx',
      content: this.generateLocationPage(business),
    });

    files.push({
      path: 'src/pages/ServicePage.tsx',
      content: this.generateServicePage(business),
    });

    // Step 6: Generate deployment files
    this.currentStep = 'Generating deployment files';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    files.push({
      path: 'Dockerfile',
      content: this.generateDockerfile(),
    });

    files.push({
      path: 'nginx.conf',
      content: this.generateNginxConf(),
    });

    files.push({
      path: '.gitignore',
      content: this.generateGitignore(),
    });

    // Add GitHub Actions workflow for automatic Cloud Run deployment (legacy pipeline)
    const serviceName = business.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    files.push({
      path: '.github/workflows/deploy.yml',
      content: this.generateGitHubActionsWorkflow(serviceName),
    });

    // Add cloudbuild.yaml as backup build config
    files.push({
      path: 'cloudbuild.yaml',
      content: this.generateCloudBuildYaml(serviceName),
    });

    // Add README
    const domain = `${serviceName}.com`;
    files.push({
      path: 'README.md',
      content: this.generateReadme({
        business_name: business.businessName,
        niche: business.niche || business.businessType,
        city: business.address.city,
        state: business.address.state,
      } as BusinessInput, domain),
    });

    // Step 6: Validate and auto-fix if needed
    this.currentStep = 'Validating generated files';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    // First validation pass
    let validation = this.validateFiles(files, REACT_SPA_REQUIREMENTS, 'react-spa');

    // Attempt to auto-fix missing files
    let finalFiles = files;
    if (!validation.valid && validation.missingRequired.length > 0) {
      console.log(`[SiteBuilder] Attempting to auto-fix ${validation.missingRequired.length} missing files...`);
      finalFiles = this.autoFixMissingFiles(files, validation.missingRequired, designSystem);

      // Re-validate after fixes
      validation = this.validateFiles(finalFiles, REACT_SPA_REQUIREMENTS, 'react-spa');
    }

    if (!validation.valid) {
      console.error(`[SiteBuilder] React SPA validation failed with ${validation.errors.length} errors after auto-fix attempt`);
      throw new Error(
        `Site build validation failed:\n${validation.errors.join('\n')}\n\nGenerated ${finalFiles.length} files but validation still failing.`
      );
    }

    completedSteps++;
    await this.progress(job.id, 'Site build complete', completedSteps, totalSteps);

    return {
      filesGenerated: finalFiles.length,
      files: finalFiles,
      pagesGenerated: (contentIndex || []).length,
      validation: {
        passed: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        autoFixed: finalFiles.length > files.length,
      },
    };
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private generateReadme(business: BusinessInput, domain: string): string {
    return `# ${business.business_name}

Website for ${business.business_name} - ${business.niche} services in ${business.city}, ${business.state}.

Generated by RankForge.

## Deployment

This is a static HTML website optimized for SEO. Deploy to any static hosting:

### GitHub Pages
1. Enable GitHub Pages in repository settings
2. Set source to root directory

### Netlify
1. Connect repository to Netlify
2. Set publish directory to root

### CloudFlare Pages
1. Connect repository to CloudFlare Pages
2. Set build command: (leave empty - static files)
3. Set output directory: /

### Docker
\`\`\`bash
docker build -t ${domain} .
docker run -p 80:80 ${domain}
\`\`\`

## Structure

\`\`\`
├── index.html           # Homepage
├── services/            # Service pages
├── ${business.city.toLowerCase()}/              # Location/neighborhood pages
├── blog/                # Blog posts
├── contact/             # Contact page
├── about/               # About page
├── assets/
│   ├── css/styles.css   # Stylesheet
│   └── js/main.js       # JavaScript
├── sitemap.xml          # XML Sitemap
├── robots.txt           # Robots file
├── Dockerfile           # Docker config
└── nginx.conf           # Nginx config
\`\`\`

## SEO Features

- Schema markup (LocalBusiness, Service, FAQPage, BreadcrumbList)
- Optimized meta titles and descriptions
- Internal linking strategy
- Mobile-responsive design
- Fast page load times
- XML sitemap

---
Generated with ❤️ by [RankForge](https://rankforge.io)
`;
  }

  private generatePackageJson(businessName: string): string {
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return JSON.stringify(
      {
        name: slug,
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          'react-router-dom': '^6.20.0',
          'lucide-react': '^0.400.0',
        },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.2.0',
          autoprefixer: '^10.4.0',
          postcss: '^8.4.0',
          tailwindcss: '^3.4.0',
          typescript: '^5.3.0',
          vite: '^5.0.0',
        },
      },
      null,
      2
    );
  }

  private generateTsConfig(): string {
    return JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
        },
        include: ['src'],
      },
      null,
      2
    );
  }

  private generateViteConfig(): string {
    return `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`;
  }

  private generateTailwindConfig(designSystem: any): string {
    const config = designSystem.tailwind_config || {};
    return `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: ${JSON.stringify(config.colors || {}, null, 8)},
      fontFamily: ${JSON.stringify(config.fontFamily || {}, null, 8)},
    },
  },
  plugins: [],
}`;
  }

  private generateIndexHtml(business: any, seoResearch: any): string {
    const keywords = seoResearch?.keywords?.primary?.join(', ') || '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${business.businessName} | ${business.niche || business.businessType} in ${business.address.city}</title>
  <meta name="description" content="${business.description}" />
  <meta name="keywords" content="${keywords}" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;
  }

  private generateMainTsx(): string {
    return `import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)`;
  }

  private generateAppTsx(contentIndex: any[]): string {
    return `import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import Contact from './pages/Contact'
import LocationPage from './pages/LocationPage'
import ServicePage from './pages/ServicePage'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/locations/:slug" element={<LocationPage />} />
          <Route path="/services/:slug" element={<ServicePage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}`;
  }

  private generateConstants(business: any, seoResearch: any): string {
    return `export const BUSINESS = {
  name: '${business.businessName}',
  niche: '${business.niche || business.businessType}',
  phone: '${business.phone}',
  email: '${business.email}',
  address: ${JSON.stringify(business.address)},
  description: \`${business.description}\`,
  yearsInBusiness: ${business.yearsInBusiness || 10},
};

export const SERVICES = ${JSON.stringify(business.services || [])};

export const TARGET_CITIES = ${JSON.stringify(business.targetCities || [])};

export const SEO_KEYWORDS = ${JSON.stringify(seoResearch?.keywords?.primary || [])};

export const TRUST_BADGES = [
  'Licensed & Insured',
  '5-Star Rated',
  'Satisfaction Guaranteed',
  'Free Estimates',
];`;
  }

  private generateHeader(business: any, designSystem: any): string {
    return `import { Link } from 'react-router-dom'
import { Phone, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { BUSINESS } from '../constants'

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold text-primary">
          {BUSINESS.name}
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link to="/" className="text-gray-700 hover:text-primary font-medium">Home</Link>
          <Link to="/contact" className="text-gray-700 hover:text-primary font-medium">Contact</Link>
          <a
            href={\`tel:\${BUSINESS.phone}\`}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Phone size={18} />
            Call Now
          </a>
        </nav>

        <button
          className="md:hidden p-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden px-4 pb-4 space-y-3 border-t">
          <Link to="/" className="block py-2 text-gray-700">Home</Link>
          <Link to="/contact" className="block py-2 text-gray-700">Contact</Link>
          <a
            href={\`tel:\${BUSINESS.phone}\`}
            className="block py-3 bg-accent text-white text-center rounded-lg font-semibold"
          >
            Call {BUSINESS.phone}
          </a>
        </div>
      )}
    </header>
  )
}`;
  }

  private generateFooter(business: any, designSystem: any): string {
    return `import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin } from 'lucide-react'
import { BUSINESS, TARGET_CITIES } from '../constants'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-12">
        <div>
          <h3 className="text-2xl font-bold mb-4">{BUSINESS.name}</h3>
          <p className="text-gray-400 mb-6">{BUSINESS.description}</p>
          <div className="space-y-3 text-gray-400">
            <a href={\`tel:\${BUSINESS.phone}\`} className="flex items-center gap-3 hover:text-white">
              <Phone size={18} />
              {BUSINESS.phone}
            </a>
            <a href={\`mailto:\${BUSINESS.email}\`} className="flex items-center gap-3 hover:text-white">
              <Mail size={18} />
              {BUSINESS.email}
            </a>
            <div className="flex items-center gap-3">
              <MapPin size={18} />
              {BUSINESS.address.city}, {BUSINESS.address.state}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-lg font-semibold mb-4">Service Areas</h4>
          <ul className="space-y-2 text-gray-400">
            {TARGET_CITIES.slice(0, 6).map((city: any) => (
              <li key={city.name}>
                <Link
                  to={\`/locations/\${city.name.toLowerCase().replace(/\\s+/g, '-')}\`}
                  className="hover:text-white"
                >
                  {city.name}, {city.state}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
          <ul className="space-y-2 text-gray-400">
            <li><Link to="/" className="hover:text-white">Home</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact Us</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500">
        <p>&copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
      </div>
    </footer>
  )
}`;
  }

  private generateLeadForm(business: any): string {
    return `import { useState } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'

interface LeadFormProps {
  title?: string
  city?: string
}

export default function LeadForm({ title = 'Get Your Free Quote', city = '' }: LeadFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '', city })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    await new Promise(resolve => setTimeout(resolve, 1000))
    setStatus('success')
  }

  if (status === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-green-800">Thank You!</h3>
        <p className="text-green-600 mt-2">We'll contact you shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold mb-6">{title}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Your Name"
          required
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
        />
        <input
          type="tel"
          placeholder="Phone Number"
          required
          value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
        />
        <input
          type="email"
          placeholder="Email Address"
          required
          value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
        />
        <textarea
          placeholder="How can we help?"
          rows={3}
          value={form.message}
          onChange={e => setForm({ ...form, message: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full py-4 bg-accent text-white font-bold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {status === 'loading' ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={20} />
              Sending...
            </span>
          ) : (
            'Get Free Quote'
          )}
        </button>
      </form>
    </div>
  )
}`;
  }

  private generateHomePage(business: any, pageContents: any[], designSystem: any): string {
    return `import { Link } from 'react-router-dom'
import { Phone, CheckCircle, Star, Shield, Clock } from 'lucide-react'
import LeadForm from '../components/LeadForm'
import { BUSINESS, SERVICES, TARGET_CITIES, TRUST_BADGES } from '../constants'

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary to-primary-dark text-white py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-6 leading-tight">
              Your Trusted {BUSINESS.niche} Professionals in {BUSINESS.address.city}
            </h1>
            <p className="text-xl text-white/90 mb-8">
              {BUSINESS.description}
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              {TRUST_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm"
                >
                  <CheckCircle size={16} />
                  {badge}
                </span>
              ))}
            </div>

            <a
              href={\`tel:\${BUSINESS.phone}\`}
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent text-white font-bold rounded-lg text-lg hover:bg-accent/90 transition-colors shadow-lg"
            >
              <Phone size={24} />
              Call {BUSINESS.phone}
            </a>
          </div>

          <div className="lg:pl-8">
            <LeadForm />
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Our Services</h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            We offer comprehensive {BUSINESS.niche.toLowerCase()} services for residential and commercial properties.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((service: string) => (
              <div
                key={service}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-semibold mb-3">{service}</h3>
                <p className="text-gray-600">
                  Professional {service.toLowerCase()} services with guaranteed satisfaction.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose {BUSINESS.name}?</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{BUSINESS.yearsInBusiness}+ Years Experience</h3>
              <p className="text-gray-600">Trusted by thousands of customers in {BUSINESS.address.city}.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">Licensed & Insured</h3>
              <p className="text-gray-600">Fully licensed, bonded, and insured for your protection.</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-2">24/7 Availability</h3>
              <p className="text-gray-600">Emergency services available around the clock.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Service Areas</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TARGET_CITIES.map((city: any) => (
              <Link
                key={city.name}
                to={\`/locations/\${city.name.toLowerCase().replace(/\\s+/g, '-')}\`}
                className="p-4 bg-white rounded-lg text-center hover:bg-primary hover:text-white transition-colors shadow-sm"
              >
                {city.name}, {city.state}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-white/90 mb-8">
            Contact us today for a free estimate. No obligation, no pressure.
          </p>
          <a
            href={\`tel:\${BUSINESS.phone}\`}
            className="inline-flex items-center gap-3 px-8 py-4 bg-accent text-white font-bold rounded-lg text-lg hover:bg-accent/90 transition-colors"
          >
            <Phone size={24} />
            Call Now: {BUSINESS.phone}
          </a>
        </div>
      </section>
    </>
  )
}`;
  }

  private generateContactPage(business: any): string {
    return `import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import LeadForm from '../components/LeadForm'
import { BUSINESS } from '../constants'

export default function Contact() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-4">Contact Us</h1>
        <p className="text-xl text-gray-600 text-center mb-12">
          Get in touch for a free estimate
        </p>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Get In Touch</h2>

            <a
              href={\`tel:\${BUSINESS.phone}\`}
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Phone className="text-primary" size={24} />
              </div>
              <div>
                <p className="font-semibold">Phone</p>
                <p className="text-gray-600">{BUSINESS.phone}</p>
              </div>
            </a>

            <a
              href={\`mailto:\${BUSINESS.email}\`}
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Mail className="text-primary" size={24} />
              </div>
              <div>
                <p className="font-semibold">Email</p>
                <p className="text-gray-600">{BUSINESS.email}</p>
              </div>
            </a>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <MapPin className="text-primary" size={24} />
              </div>
              <div>
                <p className="font-semibold">Location</p>
                <p className="text-gray-600">{BUSINESS.address.city}, {BUSINESS.address.state}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Clock className="text-primary" size={24} />
              </div>
              <div>
                <p className="font-semibold">Hours</p>
                <p className="text-gray-600">24/7 Emergency Service Available</p>
              </div>
            </div>
          </div>

          <LeadForm title="Send Us a Message" />
        </div>
      </div>
    </section>
  )
}`;
  }

  private generateLocationPage(business: any): string {
    return `import { useParams, Link } from 'react-router-dom'
import { Phone, MapPin, CheckCircle } from 'lucide-react'
import LeadForm from '../components/LeadForm'
import { BUSINESS, SERVICES, TARGET_CITIES, TRUST_BADGES } from '../constants'

export default function LocationPage() {
  const { slug } = useParams()

  const city = TARGET_CITIES.find(
    (c: any) => c.name.toLowerCase().replace(/\\s+/g, '-') === slug
  )

  if (!city) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Location Not Found</h1>
        <Link to="/" className="text-primary hover:underline">Return Home</Link>
      </div>
    )
  }

  const nearbyAreas = TARGET_CITIES.filter((c: any) => c.name !== city.name).slice(0, 4)

  return (
    <>
      <section className="bg-gradient-to-br from-primary to-primary-dark text-white py-20">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-2 text-white/80 mb-4">
              <MapPin size={20} />
              {city.name}, {city.state}
            </div>

            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              {BUSINESS.niche} in {city.name}
            </h1>

            <p className="text-xl text-white/90 mb-8">
              Looking for reliable {BUSINESS.niche.toLowerCase()} services in {city.name}?
              {BUSINESS.name} provides professional solutions throughout {city.name} and surrounding areas.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              {TRUST_BADGES.slice(0, 3).map((badge) => (
                <span key={badge} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm">
                  <CheckCircle size={16} />
                  {badge}
                </span>
              ))}
            </div>

            <a
              href={\`tel:\${BUSINESS.phone}\`}
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent text-white font-bold rounded-lg text-lg"
            >
              <Phone size={24} />
              Call Now
            </a>
          </div>

          <LeadForm title={\`Get a Free Quote in \${city.name}\`} city={city.name} />
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Services in {city.name}</h2>

          <div className="grid md:grid-cols-3 gap-6">
            {SERVICES.map((service: string) => (
              <div key={service} className="bg-white p-6 rounded-xl shadow-sm border">
                <h3 className="text-xl font-semibold mb-2">{service}</h3>
                <p className="text-gray-600">
                  Professional {service.toLowerCase()} services in {city.name} and nearby areas.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {nearbyAreas.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-8">Also Serving Nearby Areas</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {nearbyAreas.map((area: any) => (
                <Link
                  key={area.name}
                  to={\`/locations/\${area.name.toLowerCase().replace(/\\s+/g, '-')}\`}
                  className="px-6 py-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                >
                  {area.name}, {area.state}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}`;
  }

  private generateServicePage(business: any): string {
    return `import { useParams, Link } from 'react-router-dom'
import { Phone, CheckCircle } from 'lucide-react'
import LeadForm from '../components/LeadForm'
import { BUSINESS, SERVICES, TRUST_BADGES } from '../constants'

export default function ServicePage() {
  const { slug } = useParams()

  const serviceName = SERVICES.find(
    (s: string) => s.toLowerCase().replace(/\\s+/g, '-') === slug
  )

  if (!serviceName) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Service Not Found</h1>
        <Link to="/" className="text-primary hover:underline">Return Home</Link>
      </div>
    )
  }

  const otherServices = SERVICES.filter((s: string) => s !== serviceName).slice(0, 4)

  return (
    <>
      <section className="bg-gradient-to-br from-primary to-primary-dark text-white py-20">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              {serviceName} Services
            </h1>

            <p className="text-xl text-white/90 mb-8">
              Professional {serviceName.toLowerCase()} services by {BUSINESS.name}.
              Serving {BUSINESS.address.city} and surrounding areas with quality workmanship.
            </p>

            <div className="flex flex-wrap gap-3 mb-8">
              {TRUST_BADGES.map((badge) => (
                <span key={badge} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm">
                  <CheckCircle size={16} />
                  {badge}
                </span>
              ))}
            </div>

            <a
              href={\`tel:\${BUSINESS.phone}\`}
              className="inline-flex items-center gap-3 px-8 py-4 bg-accent text-white font-bold rounded-lg text-lg"
            >
              <Phone size={24} />
              Get a Quote
            </a>
          </div>

          <LeadForm title={\`Request \${serviceName} Service\`} />
        </div>
      </section>

      {otherServices.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-center mb-8">Our Other Services</h2>
            <div className="grid md:grid-cols-4 gap-4">
              {otherServices.map((service: string) => (
                <Link
                  key={service}
                  to={\`/services/\${service.toLowerCase().replace(/\\s+/g, '-')}\`}
                  className="p-4 bg-white rounded-lg text-center shadow-sm hover:shadow-md transition-shadow"
                >
                  {service}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}`;
  }

  /**
   * Generate PostCSS config - REQUIRED for Tailwind CSS processing
   */
  private generatePostcssConfig(): string {
    return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
  }

  /**
   * Generate Tailwind CSS entry point
   */
  private generateIndexCss(designSystem: any): string {
    const colors = designSystem?.tailwind_config?.colors || designSystem?.colorPalette || {};
    const primaryColor = colors.primary || '#3b82f6';
    const accentColor = colors.accent || '#10b981';

    return `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom base styles */
@layer base {
  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  /* Focus styles for accessibility */
  *:focus {
    outline: 2px solid ${primaryColor};
    outline-offset: 2px;
  }

  *:focus:not(:focus-visible) {
    outline: none;
  }
}

/* Custom component classes */
@layer components {
  .btn-primary {
    @apply bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200;
  }

  .btn-secondary {
    @apply bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors duration-200;
  }

  .btn-accent {
    @apply bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200;
  }
}

/* Custom utilities */
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
`;
  }

  /**
   * Generate Dockerfile for Vite/React SPA build
   * Multi-stage build: npm install -> vite build -> nginx serve
   */
  private generateDockerfile(): string {
    return `# Build stage - compile React/Vite app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (npm install for flexibility, works with or without lock file)
RUN npm install

# Copy source code
COPY . .

# Build the Vite project
RUN npm run build

# Production stage - serve with nginx
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config for Cloud Run (port 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Ensure proper file permissions
RUN chmod -R 755 /usr/share/nginx/html

# Cloud Run requires port 8080
ENV PORT=8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]`;
  }

  /**
   * Generate Dockerfile for static HTML sites (no build step)
   * Used by the SEO pipeline which generates pre-built HTML files
   */
  private generateStaticDockerfile(): string {
    return `# Static HTML site container
FROM nginx:alpine

# Copy all static files to nginx html directory
COPY . /usr/share/nginx/html

# Copy nginx config for Cloud Run (port 8080)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove unnecessary files from the image
RUN rm -f /usr/share/nginx/html/Dockerfile \\
    && rm -f /usr/share/nginx/html/nginx.conf \\
    && rm -f /usr/share/nginx/html/cloudbuild.yaml \\
    && rm -rf /usr/share/nginx/html/.github \\
    && rm -f /usr/share/nginx/html/.gitignore \\
    && rm -f /usr/share/nginx/html/README.md

# Ensure proper file permissions
RUN chmod -R 755 /usr/share/nginx/html

# Cloud Run requires port 8080
ENV PORT=8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]`;
  }

  /**
   * Generate nginx.conf for static HTML sites
   * Handles clean URLs (directory-style) for SEO
   */
  private generateStaticNginxConf(): string {
    return `server {
    # Cloud Run requires port 8080
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Hide nginx version
    server_tokens off;

    # MIME Types - ensure proper content-type headers
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Additional MIME types
    types {
        application/javascript js mjs;
        text/css css;
        image/svg+xml svg svgz;
        font/woff woff;
        font/woff2 woff2;
        application/json json;
        text/html html htm;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        text/xml
        image/svg+xml;

    # Handle clean URLs for static HTML (directory-style URLs)
    location / {
        try_files $uri $uri/ $uri/index.html $uri.html =404;
    }

    # Cache static assets aggressively
    location ~* \\.(?:css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
    }

    # Cache images and fonts
    location ~* \\.(?:png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Health check endpoint for Cloud Run
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}`;
  }

  private generateNginxConf(): string {
    return `server {
    # Cloud Run requires port 8080
    listen 8080;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Hide nginx version
    server_tokens off;

    # MIME Types - ensure proper content-type headers
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Additional MIME types for modern web assets
    types {
        application/javascript js mjs;
        text/css css;
        image/svg+xml svg svgz;
        font/woff woff;
        font/woff2 woff2;
        application/json json;
        text/html html htm;
    }

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression for better performance
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        text/xml
        image/svg+xml
        font/woff
        font/woff2;

    # SPA routing - all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache Vite-built assets (fingerprinted files) aggressively
    location ~* \\.(?:css|js|mjs)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
    }

    # Cache images and fonts
    location ~* \\.(?:png|jpg|jpeg|gif|ico|svg|webp|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
    }

    # Don't cache HTML (for SPA updates)
    location ~* \\.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    # Deny access to hidden files
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Deny access to sensitive files
    location ~* \\.(env|git|gitignore|dockerignore|md|yml|yaml|lock|log)$ {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Health check endpoint for Cloud Run
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}`;
  }

  private generateGitignore(): string {
    return `# Dependencies
node_modules/
.pnp/
.pnp.js

# Build
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# TypeScript
*.tsbuildinfo`;
  }

  /**
   * Generate GitHub Actions workflow for automatic Cloud Run deployment
   * This enables auto-deploy on every push to main branch
   */
  private generateGitHubActionsWorkflow(serviceName: string): string {
    return `name: Deploy to Cloud Run

on:
  push:
    branches:
      - main

env:
  PROJECT_ID: \${{ secrets.GCP_PROJECT_ID }}
  SERVICE_NAME: ${serviceName}
  REGION: us-central1

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: \${{ secrets.GCP_PROJECT_ID }}

      - name: Create Artifact Registry repository (if not exists)
        run: |
          gcloud artifacts repositories describe cloud-run-source-deploy \\
            --location=\${{ env.REGION }} \\
            --project=\${{ env.PROJECT_ID }} 2>/dev/null || \\
          gcloud artifacts repositories create cloud-run-source-deploy \\
            --repository-format=docker \\
            --location=\${{ env.REGION }} \\
            --project=\${{ env.PROJECT_ID }} \\
            --description="Docker images for Cloud Run deployments"

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker \${{ env.REGION }}-docker.pkg.dev --quiet

      - name: Build Docker image
        run: |
          docker build -t \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} .
          docker tag \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} \\
            \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:latest

      - name: Push Docker image
        run: |
          docker push \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }}
          docker push \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:latest

      - name: Deploy to Cloud Run
        id: deploy
        run: |
          gcloud run deploy \${{ env.SERVICE_NAME }} \\
            --image \${{ env.REGION }}-docker.pkg.dev/\${{ env.PROJECT_ID }}/cloud-run-source-deploy/\${{ env.SERVICE_NAME }}:\${{ github.sha }} \\
            --region \${{ env.REGION }} \\
            --platform managed \\
            --allow-unauthenticated \\
            --port 8080 \\
            --memory 512Mi \\
            --cpu 1 \\
            --min-instances 0 \\
            --max-instances 2 \\
            --cpu-throttling

      - name: Get Service URL
        run: |
          URL=\$(gcloud run services describe \${{ env.SERVICE_NAME }} --region \${{ env.REGION }} --format 'value(status.url)')
          echo "## 🚀 Deployment Successful!" >> \$GITHUB_STEP_SUMMARY
          echo "" >> \$GITHUB_STEP_SUMMARY
          echo "**Service URL:** \$URL" >> \$GITHUB_STEP_SUMMARY
          echo "" >> \$GITHUB_STEP_SUMMARY
          echo "Service deployed to: \$URL"
`;
  }

  /**
   * Generate cloudbuild.yaml for Cloud Build deployments
   */
  private generateCloudBuildYaml(serviceName: string): string {
    return `# Cloud Build configuration for automatic deployments
# Triggered by GitHub pushes when connected via Cloud Build

steps:
  # Build the Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'
      - '.'

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '${serviceName}'
      - '--image'
      - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'
      - '--region'
      - '\$_REGION'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--port'
      - '8080'
      - '--memory'
      - '512Mi'
      - '--cpu'
      - '1'
      - '--min-instances'
      - '0'
      - '--max-instances'
      - '2'
      - '--cpu-throttling'

images:
  - '\$_REGION-docker.pkg.dev/\$PROJECT_ID/cloud-run-source-deploy/${serviceName}:\$COMMIT_SHA'

substitutions:
  _REGION: us-central1

options:
  logging: CLOUD_LOGGING_ONLY
`;
  }

  /**
   * Validate generated files against requirements
   * Ensures all critical files are present and properly formatted
   */
  private validateFiles(
    files: Array<{ path: string; content: string }>,
    requirements: FileRequirement[],
    pipelineType: 'react-spa' | 'static-html' | 'nextjs-14'
  ): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      fileCount: files.length,
      missingRequired: [],
    };

    const fileMap = new Map(files.map(f => [f.path, f.content]));

    console.log(`[SiteBuilder] Validating ${files.length} files for ${pipelineType} pipeline...`);

    for (const req of requirements) {
      const content = fileMap.get(req.path);

      // Check if file exists
      if (!content) {
        if (req.required) {
          result.errors.push(`MISSING REQUIRED: ${req.path} - ${req.description}`);
          result.missingRequired.push(req.path);
          result.valid = false;
        } else {
          result.warnings.push(`Missing optional: ${req.path}`);
        }
        continue;
      }

      // Check minimum length
      if (req.minLength && content.length < req.minLength) {
        result.errors.push(
          `TOO SHORT: ${req.path} is ${content.length} chars, minimum ${req.minLength} - may be corrupted or incomplete`
        );
        result.valid = false;
        continue;
      }

      // Check required content patterns
      if (req.mustContain) {
        for (const pattern of req.mustContain) {
          if (!content.includes(pattern)) {
            result.errors.push(
              `INVALID CONTENT: ${req.path} missing required pattern "${pattern}"`
            );
            result.valid = false;
          }
        }
      }
    }

    // Log validation results
    if (result.valid) {
      console.log(`[SiteBuilder] ✓ Validation PASSED - All ${requirements.length} required files present and valid`);
    } else {
      console.error(`[SiteBuilder] ✗ Validation FAILED:`);
      result.errors.forEach(err => console.error(`  - ${err}`));
    }

    if (result.warnings.length > 0) {
      console.warn(`[SiteBuilder] Warnings:`);
      result.warnings.forEach(warn => console.warn(`  - ${warn}`));
    }

    return result;
  }

  /**
   * Auto-fix common missing files by generating them
   * Returns the fixed files array
   */
  private autoFixMissingFiles(
    files: Array<{ path: string; content: string }>,
    missingFiles: string[],
    designSystem: any
  ): Array<{ path: string; content: string }> {
    const fixedFiles = [...files];

    for (const missingPath of missingFiles) {
      console.log(`[SiteBuilder] Auto-fixing missing file: ${missingPath}`);

      switch (missingPath) {
        case 'postcss.config.js':
          fixedFiles.push({
            path: 'postcss.config.js',
            content: this.generatePostcssConfig(),
          });
          break;

        case 'src/index.css':
          fixedFiles.push({
            path: 'src/index.css',
            content: this.generateIndexCss(designSystem),
          });
          break;

        case 'Dockerfile':
          fixedFiles.push({
            path: 'Dockerfile',
            content: this.generateDockerfile(),
          });
          break;

        case 'nginx.conf':
          fixedFiles.push({
            path: 'nginx.conf',
            content: this.generateNginxConf(),
          });
          break;

        case '.gitignore':
          fixedFiles.push({
            path: '.gitignore',
            content: this.generateGitignore(),
          });
          break;

        default:
          console.warn(`[SiteBuilder] Cannot auto-fix: ${missingPath} - manual intervention required`);
      }
    }

    return fixedFiles;
  }
}
