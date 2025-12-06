/**
 * Website Generator Service
 * Orchestrates the full website generation pipeline using Gemini AI
 */

import { GoogleGenAI } from '@google/genai';

// Types for website generation
export interface BusinessInput {
  businessName: string;
  niche: string; // plumber, electrician, lawyer, etc.
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  description: string;
  services: string[];
  targetCities: Array<{
    name: string;
    county?: string;
    state: string;
  }>;
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string; // CTA button color
  };
  webhookUrl?: string;
  logoUrl?: string;
  images?: string[];
  testimonials?: Array<{
    name: string;
    text: string;
    rating: number;
    city?: string;
  }>;
  businessHours?: Record<string, string>;
  licenses?: string[];
  yearsInBusiness?: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationResult {
  files: GeneratedFile[];
  sitemap: string;
  robots: string;
  metadata: {
    totalPages: number;
    totalCities: number;
    totalServices: number;
  };
}

// System prompt for Gemini
const WEBSITE_GENERATION_SYSTEM_PROMPT = `Role:
You are a Senior Frontend Engineer and Technical SEO Strategist specializing in high-conversion local service business websites. You build pixel-perfect, accessible, and ultra-fast React applications designed to rank on Google Local Search and convert visitors into leads.

Objective:
Create a complete, multi-page Single Page Application (SPA) for a specific local service business. The site must support Programmatic SEO (generating landing pages for multiple cities/services) and include technical SEO features like Sitemaps and Schema markup.

Tech Stack:
- Framework: React 19 + TypeScript
- Styling: Tailwind CSS (via CDN script injection)
- Routing: React Router DOM v6
- Icons: Lucide React
- Deployment Target: Client-side only (SPA)

Architecture & File Structure:

1. src/constants.ts (THE SOURCE OF TRUTH):
   - Define all business logic here: Company Name, Phone, Email, Color Palette, Niche Keywords, Service List, and Target Cities
   - The rest of the app must pull data dynamically from this file
   - Do not hardcode text in components

2. src/types.ts:
   - Define interfaces for City, Service, Review, and BusinessConfig

3. src/components/SEO/MetaHead.tsx:
   - A component that updates document.title and <meta name="description"> dynamically based on the current route
   - Inject JSON-LD Schema Markup (LocalBusiness) for Google Rich Snippets

4. src/pages/CityLanding.tsx:
   - A dynamic route (/locations/:citySlug)
   - Must inject the City Name into H1s, H2s, and body copy automatically
   - Must link back to the Homepage and other nearby cities (Internal Linking Hub)

5. src/utils/sitemapGenerator.ts:
   - A utility function that generates a standard XML sitemap string by iterating over all Cities and Services

6. src/pages/Sitemap.tsx & src/pages/Robots.tsx:
   - Create routes (/sitemap.xml and /robots.txt) that render raw text/xml output

Design & Conversion Rules:
- Sticky Header: Always visible with prominent "Call Now" button with tel: link
- Lead Form: Highly visible LeadForm.tsx component
  - Must accept a webhookUrl prop
  - Must provide instant visual feedback (Loading -> Success State)
  - Placement: Above the fold on Desktop, Sticky Bottom Bar on Mobile
- Trust Signals: Display "Licensed & Insured," "5-Star Rated," and Testimonials prominently
- Color Psychology: Use primary brand color for headlines/accents, use high-contrast complementary color (Orange, Red, or Bright Blue) exclusively for CTA buttons

Output Format:
Return a JSON object with a "files" array. Each file object must have:
- "path": the file path (e.g., "src/constants.ts")
- "content": the complete file contents

Generate ALL files needed for a complete, working React application.`;

/**
 * Generate website files using Gemini AI
 */
export async function generateWebsiteWithAI(
  input: BusinessInput,
  apiKey: string
): Promise<GenerationResult> {
  const genAI = new GoogleGenAI({ apiKey });

  const userPrompt = buildUserPrompt(input);
  const fullPrompt = `${WEBSITE_GENERATION_SYSTEM_PROMPT}\n\n${userPrompt}`;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: fullPrompt,
    config: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 100000,
    },
  });

  const text = response.text;

  // Parse the JSON response
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) ||
                    text.match(/\{[\s\S]*"files"[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error('Failed to parse AI response - no valid JSON found');
  }

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

  return {
    files: parsed.files,
    sitemap: generateSitemap(input),
    robots: generateRobots(input.businessName),
    metadata: {
      totalPages: 2 + input.targetCities.length + input.services.length,
      totalCities: input.targetCities.length,
      totalServices: input.services.length,
    },
  };
}

/**
 * Build the user prompt with business details
 */
function buildUserPrompt(input: BusinessInput): string {
  return `Generate a complete React website for the following business:

## Business Information
- **Business Name:** ${input.businessName}
- **Niche/Industry:** ${input.niche}
- **Phone:** ${input.phone}
- **Email:** ${input.email}
- **Address:** ${input.address.street}, ${input.address.city}, ${input.address.state} ${input.address.zip}
- **Description:** ${input.description}

## Services Offered
${input.services.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Target Cities/Locations
${input.targetCities.map((c) => `- ${c.name}, ${c.state}${c.county ? ` (${c.county} County)` : ''}`).join('\n')}

## Color Scheme
- Primary Color: ${input.colorScheme.primary}
- Secondary Color: ${input.colorScheme.secondary}
- CTA/Accent Color: ${input.colorScheme.accent}

## Form Webhook URL
${input.webhookUrl || 'https://hooks.example.com/lead-form'}

${input.testimonials && input.testimonials.length > 0 ? `
## Testimonials
${input.testimonials.map((t) => `- "${t.text}" - ${t.name}${t.city ? `, ${t.city}` : ''} (${t.rating}/5 stars)`).join('\n')}
` : ''}

${input.yearsInBusiness ? `## Years in Business: ${input.yearsInBusiness}` : ''}

${input.licenses && input.licenses.length > 0 ? `
## Licenses & Certifications
${input.licenses.map((l) => `- ${l}`).join('\n')}
` : ''}

Generate ALL files for a complete, production-ready React SPA. Include:
1. src/constants.ts - All business data
2. src/types.ts - TypeScript interfaces
3. src/App.tsx - Main app with routing
4. src/index.tsx - Entry point
5. src/components/Header.tsx - Sticky header with call button
6. src/components/Footer.tsx - Footer with links and contact
7. src/components/LeadForm.tsx - Lead capture form
8. src/components/Features.tsx - Service features grid
9. src/components/Testimonials.tsx - Reviews carousel
10. src/components/SEO/MetaHead.tsx - Dynamic meta tags + Schema
11. src/pages/Home.tsx - Homepage with hero, features, CTA
12. src/pages/CityLanding.tsx - Dynamic city pages
13. src/pages/ServiceLanding.tsx - Service detail pages
14. src/pages/Contact.tsx - Contact page with form
15. src/pages/Sitemap.tsx - XML sitemap route
16. src/pages/Robots.tsx - Robots.txt route
17. src/utils/sitemapGenerator.ts - Sitemap utility
18. index.html - HTML template with Tailwind CDN
19. package.json - Dependencies
20. tsconfig.json - TypeScript config
21. vite.config.ts - Vite configuration

Return as a JSON object with a "files" array containing objects with "path" and "content" properties.`;
}

/**
 * Generate XML sitemap
 */
function generateSitemap(input: BusinessInput): string {
  const baseUrl = `https://${input.businessName.toLowerCase().replace(/\s+/g, '')}.com`;
  const today = new Date().toISOString().split('T')[0];

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/contact</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

  // Add city pages
  for (const city of input.targetCities) {
    const slug = city.name.toLowerCase().replace(/\s+/g, '-');
    sitemap += `
  <url>
    <loc>${baseUrl}/locations/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;
  }

  // Add service pages
  for (const service of input.services) {
    const slug = service.toLowerCase().replace(/\s+/g, '-');
    sitemap += `
  <url>
    <loc>${baseUrl}/services/${slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  sitemap += `
</urlset>`;

  return sitemap;
}

/**
 * Generate robots.txt
 */
function generateRobots(businessName: string): string {
  const baseUrl = `https://${businessName.toLowerCase().replace(/\s+/g, '')}.com`;
  return `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
}

/**
 * Generate static website files (fallback if AI fails)
 */
export function generateStaticWebsiteFiles(input: BusinessInput): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const slug = input.businessName.toLowerCase().replace(/\s+/g, '-');

  // package.json
  files.push({
    path: 'package.json',
    content: JSON.stringify({
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
        'react': '^19.0.0',
        'react-dom': '^19.0.0',
        'react-router-dom': '^6.20.0',
        'lucide-react': '^0.400.0',
      },
      devDependencies: {
        '@types/react': '^18.2.0',
        '@types/react-dom': '^18.2.0',
        '@vitejs/plugin-react': '^4.2.0',
        'typescript': '^5.3.0',
        'vite': '^5.0.0',
      },
    }, null, 2),
  });

  // tsconfig.json
  files.push({
    path: 'tsconfig.json',
    content: JSON.stringify({
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
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
      include: ['src'],
    }, null, 2),
  });

  // vite.config.ts
  files.push({
    path: 'vite.config.ts',
    content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})`,
  });

  // index.html
  files.push({
    path: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${input.businessName} | ${input.niche} Services</title>
  <meta name="description" content="${input.description}" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '${input.colorScheme.primary}',
            secondary: '${input.colorScheme.secondary}',
            accent: '${input.colorScheme.accent}',
          }
        }
      }
    }
  </script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>`,
  });

  // src/constants.ts
  files.push({
    path: 'src/constants.ts',
    content: `export const BUSINESS_CONFIG = {
  name: '${input.businessName}',
  niche: '${input.niche}',
  phone: '${input.phone}',
  email: '${input.email}',
  address: {
    street: '${input.address.street}',
    city: '${input.address.city}',
    state: '${input.address.state}',
    zip: '${input.address.zip}',
  },
  description: \`${input.description}\`,
  tagline: 'Your Trusted ${input.niche} Professionals',
  webhookUrl: '${input.webhookUrl || ''}',
  colors: {
    primary: '${input.colorScheme.primary}',
    secondary: '${input.colorScheme.secondary}',
    accent: '${input.colorScheme.accent}',
  },
  yearsInBusiness: ${input.yearsInBusiness || 10},
};

export const SERVICES = ${JSON.stringify(input.services, null, 2)};

export const TARGET_CITIES = ${JSON.stringify(input.targetCities, null, 2)};

export const TESTIMONIALS = ${JSON.stringify(input.testimonials || [
  { name: 'John D.', text: 'Excellent service! Highly recommended.', rating: 5, city: input.address.city },
  { name: 'Sarah M.', text: 'Professional and reliable. Will use again.', rating: 5, city: input.address.city },
  { name: 'Mike R.', text: 'Fast response and fair pricing.', rating: 5, city: input.address.city },
], null, 2)};

export const TRUST_BADGES = [
  'Licensed & Insured',
  '5-Star Rated',
  '24/7 Emergency Service',
  'Free Estimates',
];`,
  });

  // src/types.ts
  files.push({
    path: 'src/types.ts',
    content: `export interface City {
  name: string;
  county?: string;
  state: string;
  slug?: string;
}

export interface Service {
  name: string;
  slug: string;
  description: string;
  icon?: string;
}

export interface Review {
  name: string;
  text: string;
  rating: number;
  city?: string;
  date?: string;
}

export interface BusinessConfig {
  name: string;
  niche: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  description: string;
  tagline: string;
  webhookUrl: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  yearsInBusiness: number;
}`,
  });

  // src/main.tsx
  files.push({
    path: 'src/main.tsx',
    content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)`,
  });

  // src/App.tsx
  files.push({
    path: 'src/App.tsx',
    content: `import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import CityLanding from './pages/CityLanding'
import Contact from './pages/Contact'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/locations/:citySlug" element={<CityLanding />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}`,
  });

  // src/components/Header.tsx
  files.push({
    path: 'src/components/Header.tsx',
    content: `import { Link } from 'react-router-dom'
import { Phone, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { BUSINESS_CONFIG } from '../constants'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-xl font-bold text-gray-900">
            {BUSINESS_CONFIG.name}
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-gray-900">Home</Link>
            <Link to="/contact" className="text-gray-700 hover:text-gray-900">Contact</Link>
            <a
              href={\`tel:\${BUSINESS_CONFIG.phone}\`}
              className="inline-flex items-center gap-2 px-6 py-2 bg-accent text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              <Phone size={18} />
              Call Now
            </a>
          </nav>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-4 space-y-4">
            <Link to="/" className="block text-gray-700">Home</Link>
            <Link to="/contact" className="block text-gray-700">Contact</Link>
            <a
              href={\`tel:\${BUSINESS_CONFIG.phone}\`}
              className="block w-full text-center px-6 py-3 bg-accent text-white font-semibold rounded-lg"
            >
              Call {BUSINESS_CONFIG.phone}
            </a>
          </div>
        </div>
      )}
    </header>
  )
}`,
  });

  // src/components/Footer.tsx
  files.push({
    path: 'src/components/Footer.tsx',
    content: `import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin } from 'lucide-react'
import { BUSINESS_CONFIG, TARGET_CITIES } from '../constants'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold mb-4">{BUSINESS_CONFIG.name}</h3>
            <p className="text-gray-400 mb-4">{BUSINESS_CONFIG.tagline}</p>
            <div className="space-y-2">
              <a href={\`tel:\${BUSINESS_CONFIG.phone}\`} className="flex items-center gap-2 text-gray-300 hover:text-white">
                <Phone size={16} /> {BUSINESS_CONFIG.phone}
              </a>
              <a href={\`mailto:\${BUSINESS_CONFIG.email}\`} className="flex items-center gap-2 text-gray-300 hover:text-white">
                <Mail size={16} /> {BUSINESS_CONFIG.email}
              </a>
              <p className="flex items-center gap-2 text-gray-300">
                <MapPin size={16} /> {BUSINESS_CONFIG.address.city}, {BUSINESS_CONFIG.address.state}
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Service Areas</h4>
            <ul className="space-y-2">
              {TARGET_CITIES.slice(0, 6).map((city) => (
                <li key={city.name}>
                  <Link
                    to={\`/locations/\${city.name.toLowerCase().replace(/\\s+/g, '-')}\`}
                    className="text-gray-400 hover:text-white"
                  >
                    {city.name}, {city.state}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><Link to="/" className="text-gray-400 hover:text-white">Home</Link></li>
              <li><Link to="/contact" className="text-gray-400 hover:text-white">Contact Us</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
          <p>&copy; {new Date().getFullYear()} {BUSINESS_CONFIG.name}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}`,
  });

  // src/components/LeadForm.tsx
  files.push({
    path: 'src/components/LeadForm.tsx',
    content: `import { useState } from 'react'
import { Loader2, CheckCircle } from 'lucide-react'
import { BUSINESS_CONFIG } from '../constants'

interface LeadFormProps {
  title?: string
  cityName?: string
}

export default function LeadForm({ title = 'Get Your Free Quote', cityName }: LeadFormProps) {
  const [formState, setFormState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
    city: cityName || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormState('loading')

    try {
      if (BUSINESS_CONFIG.webhookUrl) {
        await fetch(BUSINESS_CONFIG.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
      }
      setFormState('success')
    } catch (error) {
      setFormState('error')
    }
  }

  if (formState === 'success') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-green-800">Thank You!</h3>
        <p className="text-green-600 mt-2">We'll contact you shortly.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
      <h3 className="text-xl font-bold text-gray-900 mb-6">{title}</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Your Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
        <input
          type="tel"
          placeholder="Phone Number"
          required
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
        <input
          type="email"
          placeholder="Email Address"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
        />
        <textarea
          placeholder="How can we help?"
          rows={3}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
        />
        <button
          type="submit"
          disabled={formState === 'loading'}
          className="w-full py-4 bg-accent text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {formState === 'loading' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            'Get Free Quote'
          )}
        </button>
      </form>
    </div>
  )
}`,
  });

  // src/pages/Home.tsx
  files.push({
    path: 'src/pages/Home.tsx',
    content: `import { Link } from 'react-router-dom'
import { Phone, Star, Shield, Clock, CheckCircle } from 'lucide-react'
import LeadForm from '../components/LeadForm'
import { BUSINESS_CONFIG, SERVICES, TARGET_CITIES, TESTIMONIALS, TRUST_BADGES } from '../constants'

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary to-secondary text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                {BUSINESS_CONFIG.tagline}
              </h1>
              <p className="text-xl text-white/90 mb-8">
                {BUSINESS_CONFIG.description}
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                {TRUST_BADGES.map((badge) => (
                  <span key={badge} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm">
                    <CheckCircle size={16} /> {badge}
                  </span>
                ))}
              </div>
              <a
                href={\`tel:\${BUSINESS_CONFIG.phone}\`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-white font-bold rounded-lg text-lg hover:opacity-90 transition-opacity"
              >
                <Phone size={24} />
                Call {BUSINESS_CONFIG.phone}
              </a>
            </div>
            <div>
              <LeadForm />
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Our Services</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {SERVICES.map((service) => (
              <div key={service} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{service}</h3>
                <p className="text-gray-600">Professional {service.toLowerCase()} services for residential and commercial properties.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Service Areas</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TARGET_CITIES.map((city) => (
              <Link
                key={city.name}
                to={\`/locations/\${city.name.toLowerCase().replace(/\\s+/g, '-')}\`}
                className="p-4 bg-gray-100 rounded-lg text-center hover:bg-primary hover:text-white transition-colors"
              >
                {city.name}, {city.state}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">What Our Customers Say</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((review, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-600 mb-4">"{review.text}"</p>
                <p className="font-semibold text-gray-900">{review.name}</p>
                {review.city && <p className="text-sm text-gray-500">{review.city}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Get Started?</h2>
          <p className="text-xl text-white/90 mb-8">Contact us today for a free estimate!</p>
          <a
            href={\`tel:\${BUSINESS_CONFIG.phone}\`}
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-white font-bold rounded-lg text-lg hover:opacity-90 transition-opacity"
          >
            <Phone size={24} />
            Call Now: {BUSINESS_CONFIG.phone}
          </a>
        </div>
      </section>
    </>
  )
}`,
  });

  // src/pages/CityLanding.tsx
  files.push({
    path: 'src/pages/CityLanding.tsx',
    content: `import { useParams, Link } from 'react-router-dom'
import { Phone, MapPin, CheckCircle } from 'lucide-react'
import LeadForm from '../components/LeadForm'
import { BUSINESS_CONFIG, SERVICES, TARGET_CITIES, TRUST_BADGES } from '../constants'

export default function CityLanding() {
  const { citySlug } = useParams()
  const city = TARGET_CITIES.find(
    (c) => c.name.toLowerCase().replace(/\\s+/g, '-') === citySlug
  )

  if (!city) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">City not found</h1>
        <Link to="/" className="text-primary hover:underline mt-4 block">Return to Home</Link>
      </div>
    )
  }

  const nearbyCities = TARGET_CITIES.filter((c) => c.name !== city.name).slice(0, 4)

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary to-secondary text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-2 text-white/80 mb-4">
                <MapPin size={20} />
                <span>{city.name}, {city.state}</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                {BUSINESS_CONFIG.niche} in {city.name}
              </h1>
              <p className="text-xl text-white/90 mb-8">
                Looking for a reliable {BUSINESS_CONFIG.niche.toLowerCase()} in {city.name}? {BUSINESS_CONFIG.name} provides professional services to residential and commercial customers throughout {city.name} and surrounding areas.
              </p>
              <div className="flex flex-wrap gap-4 mb-8">
                {TRUST_BADGES.slice(0, 3).map((badge) => (
                  <span key={badge} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm">
                    <CheckCircle size={16} /> {badge}
                  </span>
                ))}
              </div>
              <a
                href={\`tel:\${BUSINESS_CONFIG.phone}\`}
                className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-white font-bold rounded-lg text-lg hover:opacity-90 transition-opacity"
              >
                <Phone size={24} />
                Call Now
              </a>
            </div>
            <div>
              <LeadForm title={\`Get a Free Quote in \${city.name}\`} cityName={city.name} />
            </div>
          </div>
        </div>
      </section>

      {/* Services in City */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Our Services in {city.name}
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {SERVICES.map((service) => (
              <div key={service} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{service}</h3>
                <p className="text-gray-600">
                  Professional {service.toLowerCase()} services available in {city.name} and nearby areas.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nearby Cities */}
      {nearbyCities.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
              Also Serving Nearby Areas
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {nearbyCities.map((c) => (
                <Link
                  key={c.name}
                  to={\`/locations/\${c.name.toLowerCase().replace(/\\s+/g, '-')}\`}
                  className="px-6 py-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow text-gray-700 hover:text-primary"
                >
                  {c.name}, {c.state}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}`,
  });

  // src/pages/Contact.tsx
  files.push({
    path: 'src/pages/Contact.tsx',
    content: `import { Phone, Mail, MapPin, Clock } from 'lucide-react'
import LeadForm from '../components/LeadForm'
import { BUSINESS_CONFIG } from '../constants'

export default function Contact() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-center text-gray-900 mb-4">Contact Us</h1>
        <p className="text-xl text-center text-gray-600 mb-12">
          Get in touch for a free estimate or to schedule service
        </p>

        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Get In Touch</h2>
            <div className="space-y-6">
              <a
                href={\`tel:\${BUSINESS_CONFIG.phone}\`}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Phone</p>
                  <p className="text-gray-600">{BUSINESS_CONFIG.phone}</p>
                </div>
              </a>

              <a
                href={\`mailto:\${BUSINESS_CONFIG.email}\`}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Email</p>
                  <p className="text-gray-600">{BUSINESS_CONFIG.email}</p>
                </div>
              </a>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Location</p>
                  <p className="text-gray-600">
                    {BUSINESS_CONFIG.address.city}, {BUSINESS_CONFIG.address.state}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Hours</p>
                  <p className="text-gray-600">24/7 Emergency Service Available</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <LeadForm title="Send Us a Message" />
          </div>
        </div>
      </div>
    </section>
  )
}`,
  });

  // Dockerfile
  files.push({
    path: 'Dockerfile',
    content: `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
  });

  // nginx.conf for SPA routing
  files.push({
    path: 'nginx.conf',
    content: `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`,
  });

  // cloudbuild.yaml
  files.push({
    path: 'cloudbuild.yaml',
    content: `steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/\$PROJECT_ID/\${_SERVICE_NAME}', '.']

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/\$PROJECT_ID/\${_SERVICE_NAME}']

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - '\${_SERVICE_NAME}'
      - '--image'
      - 'gcr.io/\$PROJECT_ID/\${_SERVICE_NAME}'
      - '--region'
      - '\${_REGION}'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'

substitutions:
  _SERVICE_NAME: ${slug}
  _REGION: us-central1

images:
  - 'gcr.io/\$PROJECT_ID/\${_SERVICE_NAME}'`,
  });

  return files;
}
