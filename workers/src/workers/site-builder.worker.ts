import { BaseWorker } from '../lib/worker-base.js';
import {
  getDesignSystem,
  getContentIndex,
  getAllPageContent,
  getSEOResearch,
} from '../lib/supabase.js';
import type { GenerationJob, DesignSystem, PageContent } from '../lib/types.js';

export class SiteBuilderWorker extends BaseWorker {
  private currentStep: string = 'Initializing';

  constructor() {
    super({
      name: 'Site Builder',
      jobTypes: ['site_build', 'full_generation'],
      pollInterval: 5000,
      maxConcurrent: 2,
    });
  }

  protected getCurrentStep(): string {
    return this.currentStep;
  }

  protected async process(job: GenerationJob): Promise<Record<string, unknown>> {
    const totalSteps = 6;
    let completedSteps = 0;

    const business = job.input_payload.business;

    // Step 1: Load all resources
    this.currentStep = 'Loading design system and content';
    await this.progress(job.id, this.currentStep, completedSteps, totalSteps);

    const [designSystem, contentIndex, pageContents, seoResearch] = await Promise.all([
      getDesignSystem(job.website_id),
      getContentIndex(job.website_id),
      getAllPageContent(job.website_id),
      getSEOResearch(job.website_id),
    ]);

    if (!designSystem) {
      throw new Error('Design system not found. Run design generation first.');
    }

    completedSteps++;

    // Step 2: Generate project files
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

    // Components from design system
    if (designSystem.component_library) {
      for (const [componentName, variations] of Object.entries(
        designSystem.component_library as Record<string, string[]>
      )) {
        if (variations && variations.length > 0) {
          files.push({
            path: `src/components/${this.capitalize(componentName)}.tsx`,
            content: variations[0],
          });
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

    completedSteps++;

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

    completedSteps++;
    await this.progress(job.id, 'Site build complete', completedSteps, totalSteps);

    return {
      filesGenerated: files.length,
      files, // Pass files to deployment worker
      pagesGenerated: (contentIndex || []).length,
    };
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
    const locationPages = contentIndex.filter((p) => p.page_type === 'location');
    const servicePages = contentIndex.filter((p) => p.page_type === 'service');

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

    // Simulate form submission
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

  private generateDockerfile(): string {
    return `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
  }

  private generateNginxConf(): string {
    return `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
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
}
