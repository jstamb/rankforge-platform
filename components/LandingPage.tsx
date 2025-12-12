import React from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, Globe, Github, Cloud, Shield, Sparkles, Check, ArrowRight,
  Code2, Palette, Search, Rocket, Clock, DollarSign, Bot, Lock,
  ChevronRight, Play, Star, Users, TrendingUp, MessageSquare
} from 'lucide-react';

const FEATURES = [
  {
    icon: Search,
    title: 'AI-Powered SEO Research',
    description: 'Claude AI analyzes your industry, competitors, and target keywords to build a comprehensive SEO strategy automatically.'
  },
  {
    icon: Code2,
    title: 'Full Static Site Generation',
    description: 'Generate complete HTML, CSS, and JavaScript websites optimized for performance. No frameworks, no bloat.'
  },
  {
    icon: Palette,
    title: 'Custom Design Systems',
    description: 'AI creates unique color palettes, typography, and component designs tailored to your brand and industry.'
  },
  {
    icon: Globe,
    title: 'Location Pages at Scale',
    description: 'Generate hundreds of SEO-optimized location pages for service area businesses with unique, quality content.'
  },
  {
    icon: Github,
    title: 'GitHub Integration',
    description: 'Sites are automatically pushed to your GitHub repo. Full version control, CI/CD ready, and you own the code.'
  },
  {
    icon: Cloud,
    title: 'Cloud Run Deployment',
    description: 'One-click deployment to Google Cloud Run. Preview URLs, custom domains, and enterprise-grade infrastructure.'
  },
  {
    icon: Shield,
    title: 'Cloudflare DNS',
    description: 'Automatic DNS configuration with Cloudflare. SSL, CDN, and DDoS protection included.'
  },
  {
    icon: Bot,
    title: 'AI Website Editor',
    description: 'Chat with Claude to make changes to your site. Describe what you want in plain English and watch it happen.'
  },
];

// Single pricing model - $250 per website

const TESTIMONIALS = [
  {
    quote: "RankForge cut our website development time from weeks to minutes. The SEO optimization is incredible.",
    author: "Sarah Chen",
    role: "Founder, Digital Growth Agency",
    avatar: "SC"
  },
  {
    quote: "We've generated over 200 location pages that actually rank. The AI content quality blew us away.",
    author: "Mike Rodriguez",
    role: "Marketing Director, ServicePro",
    avatar: "MR"
  },
  {
    quote: "Finally, a tool that understands local SEO. Our clients are seeing 3x more organic traffic.",
    author: "Amanda Foster",
    role: "SEO Consultant",
    avatar: "AF"
  },
];

const STATS = [
  { value: '10,000+', label: 'Websites Generated' },
  { value: '500K+', label: 'Pages Deployed' },
  { value: '94%', label: 'Avg. SEO Score' },
  { value: '~8-10 min', label: 'Generation Time' },
];

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/rank-forge-logo.svg" alt="RankForge" className="h-8 w-auto" />
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Pricing</a>
              <a href="#testimonials" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Testimonials</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Sign In
              </Link>
              <Link
                to="/login"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-sm text-indigo-700 mb-6">
              <Sparkles className="w-4 h-4" />
              <span>Powered by Claude AI</span>
              <ChevronRight className="w-4 h-4" />
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-tight">
              Generate SEO-Optimized
              <span className="block bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                Websites in Minutes
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              The only AI website generator that deploys to <strong>your infrastructure</strong>.
              Connect GitHub, Cloudflare, and Cloud Run. No AI usage fees. You own everything.
            </p>

            {/* CTA Buttons */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group"
              >
                Start Building Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-900 font-semibold rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                Watch Demo
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-500" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-500" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Hero Image / Dashboard Preview */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
            <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-2xl shadow-slate-200/50 bg-slate-900">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xs text-slate-400">app.rankforge.io</span>
                </div>
              </div>
              <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <Rocket className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">Generating Website...</div>
                        <div className="text-sm text-slate-500">SEO Research Complete</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>75% Complete</span>
                        <span>~45s remaining</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="text-sm font-medium text-slate-500 mb-2">Pages Generated</div>
                    <div className="text-3xl font-bold text-slate-900">24</div>
                    <div className="text-xs text-emerald-600 mt-1">+8 location pages</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl font-bold text-slate-900">{stat.value}</div>
                <div className="text-sm text-slate-500 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Different Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Why RankForge is Different
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Other tools generate code you can't use. We deploy to your infrastructure.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <DollarSign className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No AI Usage Fees</h3>
              <p className="text-slate-600">
                Unlike vibe coding tools that charge per token, your subscription includes all AI generation.
                Unlimited Claude AI usage for SEO research and content generation.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">You Own Everything</h3>
              <p className="text-slate-600">
                Sites deploy to your GitHub, your Cloud Run, your Cloudflare.
                Cancel anytime and keep all your code. No vendor lock-in.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-4">
                <Rocket className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Seamless Deployment</h3>
              <p className="text-slate-600">
                Connect once, deploy forever. OAuth integrations with GitHub, Cloudflare, and Google Cloud
                mean one-click deployments every time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Everything You Need to Rank
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              From SEO research to deployment, RankForge handles the entire pipeline.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="w-10 h-10 bg-slate-100 group-hover:bg-indigo-100 rounded-lg flex items-center justify-center mb-4 transition-colors">
                  <feature.icon className="w-5 h-5 text-slate-600 group-hover:text-indigo-600 transition-colors" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Three steps to a fully deployed, SEO-optimized website.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Enter Your Business Info',
                description: 'Add your business name, services, and target locations. Our AI does the rest.',
                icon: Users,
              },
              {
                step: '02',
                title: 'AI Generates Everything',
                description: 'Claude AI researches keywords, writes content, designs pages, and builds your site.',
                icon: Sparkles,
              },
              {
                step: '03',
                title: 'Deploy to Your Infrastructure',
                description: 'One click pushes to GitHub, deploys to Cloud Run, and configures your domain.',
                icon: Rocket,
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-7xl font-bold text-slate-100 absolute -top-4 -left-2">{item.step}</div>
                <div className="relative pt-8">
                  <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
              Pay per website. No subscriptions. No AI usage fees. You own the code forever.
            </p>
          </div>

          {/* Single Pricing Card */}
          <div className="max-w-lg mx-auto">
            <div className="relative bg-white rounded-2xl border-2 border-indigo-500 shadow-xl shadow-indigo-100">
              {/* Free Trial Badge */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold rounded-full">
                  1 Free Website to Try
                </span>
              </div>

              <div className="p-8 pt-10">
                {/* Price */}
                <div className="text-center mb-8">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold text-slate-900">$250</span>
                    <span className="text-xl text-slate-500">per website</span>
                  </div>
                  <p className="mt-2 text-slate-600">One-time payment. Yours forever.</p>
                </div>

                {/* Features */}
                <div className="space-y-4 mb-8">
                  <h4 className="font-semibold text-slate-900 text-center">Everything included:</h4>
                  <ul className="space-y-3">
                    {[
                      'Full SEO-optimized website generation',
                      'Up to 100+ pages (location & service pages)',
                      'Custom AI-generated design system',
                      'GitHub repository deployment',
                      'Google Cloud Run hosting setup',
                      'Cloudflare DNS configuration',
                      'AI website editor for changes',
                      'Claude AI content generation',
                      'Schema markup & meta tags',
                      'Mobile-responsive design',
                      'Lifetime code ownership',
                    ].map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA */}
                <Link
                  to="/login"
                  className="w-full py-4 rounded-xl font-semibold text-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                >
                  Start Your Free Website
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <p className="mt-4 text-center text-sm text-slate-500">
                  No credit card required for your first website
                </p>
              </div>
            </div>

            {/* Value Props */}
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              <div className="p-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-slate-900">No AI Fees</p>
                <p className="text-xs text-slate-500">Unlimited Claude usage</p>
              </div>
              <div className="p-4">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Lock className="w-5 h-5 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-slate-900">You Own It</p>
                <p className="text-xs text-slate-500">Full code ownership</p>
              </div>
              <div className="p-4">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Rocket className="w-5 h-5 text-violet-600" />
                </div>
                <p className="text-sm font-medium text-slate-900">Your Infra</p>
                <p className="text-xs text-slate-500">Deploy anywhere</p>
              </div>
            </div>
          </div>

          {/* Bulk Pricing */}
          <div className="mt-12 text-center">
            <p className="text-slate-600">
              Building multiple websites?{' '}
              <a href="#" className="text-indigo-600 font-medium hover:text-indigo-700">
                Contact us for volume pricing
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Loved by Agencies & Marketers
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Join thousands of professionals generating high-ranking websites.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((testimonial, i) => (
              <div key={i} className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-6">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-sm font-semibold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-medium text-slate-900">{testimonial.author}</div>
                    <div className="text-sm text-slate-500">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-600 to-violet-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Ready to Generate Your First Website?
          </h2>
          <p className="mt-4 text-lg text-indigo-100">
            Start your 14-day free trial. No credit card required.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-indigo-600 font-semibold rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/rank-forge-logo.svg" alt="RankForge" className="h-8 w-auto brightness-0 invert" />
              </div>
              <p className="text-sm text-slate-400">
                AI-powered website generation with seamless deployment to your infrastructure.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-center text-sm text-slate-400">
            <p>&copy; {new Date().getFullYear()} RankForge. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
