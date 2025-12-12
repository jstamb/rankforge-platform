import React, { useState, useEffect } from 'react';
import {
  Building2, MapPin, Search, ArrowRight, ArrowLeft, Loader2, Check,
  Palette, Globe, Plus, X, Phone, Mail, Sparkles, CreditCard,
  AlertTriangle, Github, Cloud, ExternalLink
} from 'lucide-react';
import { generateSeoStrategy } from '../services/geminiService';
import { SeoPreview } from './SeoPreview';
import { SeoConfig } from '../types';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Business } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createGenerationJob, subscribeToJobProgress, JobProgress } from '../services/jobQueue';
import { BusinessInput } from '../services/websiteGenerator';

const WEBSITE_PRICE = 97; // $97 per website generation

const STEPS = [
  { id: 1, title: 'Business Info', icon: Building2 },
  { id: 2, title: 'Locations', icon: MapPin },
  { id: 3, title: 'Design & SEO', icon: Palette },
  { id: 4, title: 'Payment', icon: CreditCard },
  { id: 5, title: 'Generate', icon: Sparkles },
];


const COLOR_PRESETS = [
  { name: 'Professional Blue', primary: '#1e40af', secondary: '#3b82f6', accent: '#f97316' },
  { name: 'Trust Green', primary: '#166534', secondary: '#22c55e', accent: '#ef4444' },
  { name: 'Modern Purple', primary: '#6b21a8', secondary: '#a855f7', accent: '#f59e0b' },
  { name: 'Classic Navy', primary: '#1e3a5f', secondary: '#3b82f6', accent: '#dc2626' },
  { name: 'Warm Red', primary: '#991b1b', secondary: '#ef4444', accent: '#2563eb' },
];

interface FormData {
  // Business Info
  businessName: string;
  niche: string;
  phone: string;
  email: string;
  description: string;
  services: string[];

  // Address
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;

  // Target Cities
  targetCities: Array<{ name: string; state: string; county?: string }>;

  // Design
  colorScheme: { primary: string; secondary: string; accent: string };

  // Optional
  webhookUrl: string;
  yearsInBusiness: number;

  // Generated
  seoConfig: SeoConfig | null;
}

export const WebsiteWizard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const businessIdFromUrl = searchParams.get('business');

  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [newCityInput, setNewCityInput] = useState({ name: '', state: '' });
  const [newServiceInput, setNewServiceInput] = useState('');
  const [createdWebsiteId, setCreatedWebsiteId] = useState<string | null>(null);
  const [createdBusinessId, setCreatedBusinessId] = useState<string | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(businessIdFromUrl);
  const [loadingBusiness, setLoadingBusiness] = useState(!!businessIdFromUrl);

  // Integration readiness state
  const [integrationsReady, setIntegrationsReady] = useState<{
    loading: boolean;
    github: boolean;
    gcloud: boolean;
    gcpRolesVerified: boolean;
    missingRoles: string[];
  }>({
    loading: true,
    github: false,
    gcloud: false,
    gcpRolesVerified: false,
    missingRoles: [],
  });

  const [formData, setFormData] = useState<FormData>({
    businessName: '',
    niche: '',
    phone: '',
    email: '',
    description: '',
    services: [],
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    targetCities: [],
    colorScheme: COLOR_PRESETS[0],
    webhookUrl: '',
    yearsInBusiness: 10,
    seoConfig: null,
  });

  useEffect(() => {
    loadUser();
    loadBusinesses();
    checkIntegrations();
  }, []);

  // Load business data if businessId is in URL
  useEffect(() => {
    if (businessIdFromUrl && businesses.length > 0) {
      const business = businesses.find(b => b.id === businessIdFromUrl);
      if (business) {
        prefillFromBusiness(business);
      }
      setLoadingBusiness(false);
    }
  }, [businessIdFromUrl, businesses]);

  const loadUser = async () => {
    if (!isSupabaseConfigured()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      setProfile(profileData);
    }
  };

  const loadBusinesses = async () => {
    if (!isSupabaseConfigured()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBusinesses(data);
      }
    } catch (error) {
      console.error('Error loading businesses:', error);
    }
  };

  const checkIntegrations = async () => {
    if (!isSupabaseConfigured()) {
      setIntegrationsReady({
        loading: false,
        github: false,
        gcloud: false,
        gcpRolesVerified: false,
        missingRoles: [],
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIntegrationsReady({
          loading: false,
          github: false,
          gcloud: false,
          gcpRolesVerified: false,
          missingRoles: [],
        });
        return;
      }

      // Fetch user profile to check integrations
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('github_access_token, github_username, gcloud_service_account_key, gcloud_project_id')
        .eq('id', user.id)
        .single();

      if (profileError || !profileData) {
        setIntegrationsReady({
          loading: false,
          github: false,
          gcloud: false,
          gcpRolesVerified: false,
          missingRoles: [],
        });
        return;
      }

      const githubConnected = !!(profileData.github_access_token && profileData.github_username);
      const gcloudConnected = !!(profileData.gcloud_service_account_key && profileData.gcloud_project_id);

      // If GCloud is connected, verify roles
      let gcpRolesVerified = false;
      let missingRoles: string[] = [];

      if (gcloudConnected) {
        try {
          const { data: roleResult, error: roleError } = await supabase.functions.invoke('verify-gcp-roles', {
            body: { userId: user.id },
          });

          if (!roleError && roleResult?.success && roleResult?.allRolesFound) {
            gcpRolesVerified = true;
          } else if (roleResult?.missingRoles) {
            missingRoles = roleResult.missingRoles;
          }
        } catch (err) {
          console.error('Error verifying GCP roles:', err);
        }
      }

      setIntegrationsReady({
        loading: false,
        github: githubConnected,
        gcloud: gcloudConnected,
        gcpRolesVerified,
        missingRoles,
      });
    } catch (error) {
      console.error('Error checking integrations:', error);
      setIntegrationsReady({
        loading: false,
        github: false,
        gcloud: false,
        gcpRolesVerified: false,
        missingRoles: [],
      });
    }
  };

  const prefillFromBusiness = (business: Business) => {
    // Use business_type directly as the niche value
    const nicheValue = business.business_type || '';

    setFormData(prev => ({
      ...prev,
      businessName: business.business_name || '',
      niche: nicheValue,
      phone: business.phone || '',
      email: business.email || '',
      description: business.description || '',
      services: business.services || [],
      addressStreet: business.address_street || '',
      addressCity: business.address_city || '',
      addressState: business.address_state || '',
      addressZip: business.address_zip || '',
      targetCities: business.target_cities || [],
    }));
    setCreatedBusinessId(business.id);
  };

  const handleBusinessSelect = (businessId: string) => {
    setSelectedBusinessId(businessId);
    if (businessId) {
      const business = businesses.find(b => b.id === businessId);
      if (business) {
        prefillFromBusiness(business);
      }
    } else {
      // Clear form if "New Business" is selected
      setFormData({
        businessName: '',
        niche: '',
        phone: '',
        email: '',
        description: '',
        services: [],
        addressStreet: '',
        addressCity: '',
        addressState: '',
        addressZip: '',
        targetCities: [],
        colorScheme: COLOR_PRESETS[0],
        webhookUrl: '',
        yearsInBusiness: 10,
        seoConfig: null,
      });
      setCreatedBusinessId(null);
    }
  };

  const addService = () => {
    if (newServiceInput.trim() && !formData.services.includes(newServiceInput.trim())) {
      setFormData(prev => ({
        ...prev,
        services: [...prev.services, newServiceInput.trim()]
      }));
      setNewServiceInput('');
    }
  };

  const removeService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter(s => s !== service)
    }));
  };

  const addCity = () => {
    if (newCityInput.name.trim() && newCityInput.state.trim()) {
      const exists = formData.targetCities.some(
        c => c.name.toLowerCase() === newCityInput.name.toLowerCase() &&
             c.state.toLowerCase() === newCityInput.state.toLowerCase()
      );
      if (!exists) {
        setFormData(prev => ({
          ...prev,
          targetCities: [...prev.targetCities, { ...newCityInput }]
        }));
        setNewCityInput({ name: '', state: '' });
      }
    }
  };

  const removeCity = (index: number) => {
    setFormData(prev => ({
      ...prev,
      targetCities: prev.targetCities.filter((_, i) => i !== index)
    }));
  };

  const handleGenerateSEO = async () => {
    setIsGenerating(true);
    try {
      const config = await generateSeoStrategy(
        formData.businessName,
        formData.niche,
        formData.addressCity,
        formData.services
      );
      setFormData(prev => ({ ...prev, seoConfig: config }));
    } catch (error) {
      console.error('SEO generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Admin emails that skip payment
  const ADMIN_EMAILS = ['pyfooty@gmail.com'];
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  // Step 1: Create website/business records and proceed to payment (or skip for admins)
  const handleProceedToPayment = async () => {
    if (!user) {
      alert('Please sign in to generate a website');
      navigate('/login');
      return;
    }

    setIsCreatingCheckout(true);

    try {
      let businessId = createdBusinessId;

      // Only create business if we don't already have one (from pre-fill)
      if (!businessId) {
        const { data: business, error: businessError } = await supabase
          .from('businesses')
          .insert({
            user_id: user.id,
            business_name: formData.businessName,
            business_type: formData.niche.toLowerCase(),
            phone: formData.phone,
            email: formData.email,
            address_street: formData.addressStreet,
            address_city: formData.addressCity,
            address_state: formData.addressState,
            address_zip: formData.addressZip,
            description: formData.description,
            services: formData.services,
            target_keywords: formData.seoConfig?.keywords || [],
            target_cities: formData.targetCities,
          })
          .select()
          .single();

        if (businessError) throw businessError;
        businessId = business.id;
        setCreatedBusinessId(business.id);
      }

      // Create website record with unique slug (add timestamp suffix to prevent duplicates)
      const baseSlug = formData.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const uniqueSuffix = Date.now().toString(36).slice(-4); // Short unique suffix
      const slug = `${baseSlug}-${uniqueSuffix}`;

      const { data: website, error: websiteError } = await supabase
        .from('websites')
        .insert({
          user_id: user.id,
          business_id: businessId,
          name: `${formData.businessName} Website`,
          slug,
          status: 'draft', // Will be updated when generation starts
          template: 'modern',
          payment_status: isAdmin ? 'paid' : 'unpaid', // Admins skip payment
        })
        .select()
        .single();

      if (websiteError) throw websiteError;

      setCreatedWebsiteId(website.id);

      // If admin, skip payment and redirect to website settings page
      // The settings page will show the Generate button and any errors clearly
      if (isAdmin) {
        navigate(`/websites/${website.id}/settings?autostart=true`);
        return;
      } else {
        // Move to payment step for non-admins
        setStep(4);
      }
      setIsCreatingCheckout(false);

    } catch (error: any) {
      console.error('Failed to create website:', error);
      alert('Failed to create website: ' + error.message);
      setIsCreatingCheckout(false);
    }
  };

  // Step 2: Redirect to Stripe checkout
  const handleCheckout = async () => {
    if (!createdWebsiteId || !user) return;

    setIsCreatingCheckout(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          websiteId: createdWebsiteId,
          userId: user.id,
          websiteName: formData.businessName,
          returnUrl: window.location.origin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.checkoutUrl;

    } catch (error: any) {
      console.error('Checkout failed:', error);
      alert('Failed to start checkout: ' + error.message);
      setIsCreatingCheckout(false);
    }
  };

  // Start generation - creates job and lets workers handle the multi-step process
  // Workers generate 50+ pages with AI content, deploy to GitHub, and deploy to Cloud Run
  const handleStartGeneration = async () => {
    if (!user || !createdWebsiteId) {
      return;
    }

    setIsGenerating(true);
    setStep(5);

    try {
      // Build business input for generator
      const businessInput: BusinessInput = {
        businessName: formData.businessName,
        niche: formData.niche,
        phone: formData.phone,
        email: formData.email,
        address: {
          street: formData.addressStreet,
          city: formData.addressCity,
          state: formData.addressState,
          zip: formData.addressZip,
        },
        description: formData.description || `Professional ${formData.niche.toLowerCase()} services in ${formData.addressCity}`,
        services: formData.services,
        targetCities: formData.targetCities.length > 0
          ? formData.targetCities
          : [{ name: formData.addressCity, state: formData.addressState }],
        colorScheme: formData.colorScheme,
        webhookUrl: formData.webhookUrl,
        yearsInBusiness: formData.yearsInBusiness,
      };

      // Create job in queue - workers will pick this up automatically
      const { jobId, queuePosition: pos } = await createGenerationJob(
        user.id,
        createdWebsiteId,
        businessInput,
        {
          useAI: true,
          deployToGithub: true,
          deployToCloudRun: true,
        }
      );

      setQueuePosition(pos);
      setJobProgress({
        jobId,
        status: 'pending',
        currentStep: 'Queued for processing...',
        progress: 0,
        queuePosition: pos,
      });

      // Subscribe to real-time updates from the workers
      // Workers will update the job status as they progress through:
      // 1. Planning site architecture (hub-and-spoke model)
      // 2. Creating design system
      // 3. Generating 50+ pages of content with AI
      // 4. Building static files
      // 5. Deploying to GitHub
      // 6. Deploying to Cloud Run
      const channel = subscribeToJobProgress(jobId, (progress) => {
        setJobProgress(progress);
        setQueuePosition(progress.queuePosition || null);

        if (progress.status === 'completed' || progress.status === 'failed') {
          setIsGenerating(false);
        }
      });

      // Store channel reference for cleanup (handled by real-time subscription)
      // The subscription will automatically update UI as workers progress

    } catch (error: any) {
      console.error('Generation failed:', error);
      setJobProgress({
        jobId: '',
        status: 'failed',
        currentStep: 'Failed to create generation job',
        progress: 0,
        error: error.message,
      });
      setIsGenerating(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.businessName && formData.niche && formData.phone && formData.services.length > 0;
      case 2:
        return formData.addressCity && formData.addressState;
      case 3:
        return formData.seoConfig !== null;
      default:
        return true;
    }
  };

  // Check if all integrations are ready
  const allIntegrationsReady = integrationsReady.github && integrationsReady.gcloud && integrationsReady.gcpRolesVerified;

  // Integration Gate - Show when integrations aren't ready
  if (!integrationsReady.loading && !allIntegrationsReady) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-amber-100">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Setup Required</h2>
          <p className="text-slate-500 mt-2">
            Connect your integrations to enable automatic website deployment
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Required Integrations</h3>
          <p className="text-sm text-slate-600 mb-6">
            To generate and deploy your website automatically, we need access to GitHub (for code storage)
            and Google Cloud (for hosting). Complete these steps to continue.
          </p>

          <div className="space-y-4">
            {/* GitHub Status */}
            <div className={`flex items-center justify-between p-4 rounded-lg border ${
              integrationsReady.github
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  integrationsReady.github ? 'bg-emerald-100' : 'bg-slate-200'
                }`}>
                  <Github size={20} className={integrationsReady.github ? 'text-emerald-600' : 'text-slate-500'} />
                </div>
                <div>
                  <p className="font-medium text-slate-900">GitHub</p>
                  <p className="text-sm text-slate-500">
                    {integrationsReady.github ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              {integrationsReady.github ? (
                <Check size={20} className="text-emerald-600" />
              ) : (
                <Link
                  to="/integrations"
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Connect
                </Link>
              )}
            </div>

            {/* Google Cloud Status */}
            <div className={`flex items-center justify-between p-4 rounded-lg border ${
              integrationsReady.gcloud
                ? integrationsReady.gcpRolesVerified
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  integrationsReady.gcloud
                    ? integrationsReady.gcpRolesVerified
                      ? 'bg-emerald-100'
                      : 'bg-amber-100'
                    : 'bg-slate-200'
                }`}>
                  <Cloud size={20} className={
                    integrationsReady.gcloud
                      ? integrationsReady.gcpRolesVerified
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                      : 'text-slate-500'
                  } />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Google Cloud</p>
                  <p className="text-sm text-slate-500">
                    {!integrationsReady.gcloud
                      ? 'Not connected'
                      : integrationsReady.gcpRolesVerified
                        ? 'Connected & verified'
                        : 'Missing required roles'}
                  </p>
                </div>
              </div>
              {integrationsReady.gcloud && integrationsReady.gcpRolesVerified ? (
                <Check size={20} className="text-emerald-600" />
              ) : (
                <Link
                  to="/integrations"
                  className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  {integrationsReady.gcloud ? 'Fix Roles' : 'Connect'}
                </Link>
              )}
            </div>

            {/* Missing Roles Warning */}
            {integrationsReady.gcloud && !integrationsReady.gcpRolesVerified && integrationsReady.missingRoles.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm font-medium text-amber-800 mb-2">Missing GCP Roles:</p>
                <ul className="text-sm text-amber-700 space-y-1">
                  {integrationsReady.missingRoles.map((role, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <X size={14} className="text-amber-500" />
                      {role}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-amber-600 mt-2">
                  Add these roles to your service account in the Google Cloud Console.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Why We Need These */}
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-6 mb-6">
          <h3 className="font-semibold text-indigo-900 mb-3">Why do I need these?</h3>
          <ul className="space-y-2 text-sm text-indigo-700">
            <li className="flex items-start gap-2">
              <Github size={16} className="mt-0.5 flex-shrink-0" />
              <span><strong>GitHub</strong> stores your website code and enables version control for updates.</span>
            </li>
            <li className="flex items-start gap-2">
              <Cloud size={16} className="mt-0.5 flex-shrink-0" />
              <span><strong>Google Cloud</strong> hosts your website with automatic deployments and SSL.</span>
            </li>
          </ul>
        </div>

        <div className="flex justify-center">
          <Link
            to="/integrations"
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Go to Integrations
            <ExternalLink size={18} />
          </Link>
        </div>
      </div>
    );
  }

  // Loading state while checking integrations
  if (integrationsReady.loading) {
    return (
      <div className="max-w-3xl mx-auto py-12 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-600">Checking integrations...</p>
      </div>
    );
  }

  // Payment Step View
  if (step === 4) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-indigo-100">
            <CreditCard className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Complete Your Purchase</h2>
          <p className="text-slate-500 mt-2">
            One-time payment for your AI-generated website
          </p>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Order Summary</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium text-slate-900">{formData.businessName} Website</p>
                <p className="text-sm text-slate-500">AI-powered SEO website generation</p>
              </div>
              <span className="text-lg font-semibold text-slate-900">${WEBSITE_PRICE}</span>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>${WEBSITE_PRICE}.00</span>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="flex justify-between font-semibold text-slate-900">
                <span>Total</span>
                <span>${WEBSITE_PRICE}.00</span>
              </div>
            </div>
          </div>
        </div>

        {/* What's Included */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">What's Included</h3>
          <ul className="space-y-2">
            {[
              'AI-generated SEO-optimized content',
              'Professional responsive design',
              'Location-specific landing pages',
              'Schema markup for local SEO',
              'GitHub repository deployment',
              'Cloud Run hosting setup',
              'Unlimited future content changes',
            ].map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
                <Check size={16} className="text-emerald-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={() => setStep(3)}
            className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={16} className="inline mr-2" />
            Back
          </button>
          <button
            onClick={handleCheckout}
            disabled={isCreatingCheckout}
            className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isCreatingCheckout ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard size={18} />
                Pay ${WEBSITE_PRICE} & Generate
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Secure payment powered by Stripe. Your card details are never stored on our servers.
        </p>
      </div>
    );
  }

  // Generation Progress View
  if (step === 5) {
    const isPending = jobProgress?.status === 'pending' || jobProgress?.status === 'queued';
    const isProcessing = jobProgress?.status === 'processing';
    const isCompleted = jobProgress?.status === 'completed';
    const isFailed = jobProgress?.status === 'failed';

    return (
      <div className="max-w-3xl mx-auto py-12">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isCompleted ? 'bg-emerald-100' :
            isFailed ? 'bg-red-100' :
            isPending ? 'bg-amber-100' :
            'bg-indigo-100'
          }`}>
            {isCompleted ? <Check className="w-8 h-8 text-emerald-600" /> :
             isFailed ? <X className="w-8 h-8 text-red-600" /> :
             isPending ? <Loader2 className="w-8 h-8 text-amber-600 animate-spin" /> :
             <Sparkles className="w-8 h-8 text-indigo-600" />}
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isCompleted ? 'Website Generated!' :
             isFailed ? 'Generation Failed' :
             isPending ? 'In Queue' :
             'Building Your Website'}
          </h2>
          <p className="text-slate-500 mt-2">
            {isCompleted
              ? 'Your website is ready to go!'
              : isFailed
              ? jobProgress?.error
              : isPending && queuePosition
              ? `Position ${queuePosition} in queue - waiting for available worker`
              : jobProgress?.currentStep || 'Initializing...'}
          </p>
        </div>

        {/* Queue Position (for pending jobs) */}
        {isPending && queuePosition && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold text-amber-700">#{queuePosition}</span>
              </div>
              <div>
                <p className="font-medium text-amber-800">Queue Position</p>
                <p className="text-sm text-amber-600">
                  Your job will start automatically when a worker is available.
                  You can close this tab - we'll notify you when it's done.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Progress</span>
            <span className="text-sm font-medium text-indigo-600">{jobProgress?.progress || 0}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isFailed ? 'bg-red-500' :
                isCompleted ? 'bg-emerald-500' :
                isPending ? 'bg-amber-500' :
                'bg-indigo-500'
              }`}
              style={{ width: `${jobProgress?.progress || 0}%` }}
            />
          </div>
        </div>

        {/* Current Step */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isCompleted ? 'bg-emerald-100 text-emerald-600' :
              isFailed ? 'bg-red-100 text-red-600' :
              'bg-indigo-100 text-indigo-600'
            }`}>
              {isCompleted ? <Check size={20} /> :
               isFailed ? <X size={20} /> :
               <Loader2 size={20} className="animate-spin" />}
            </div>
            <div>
              <p className="font-medium text-slate-900">{jobProgress?.currentStep || 'Waiting...'}</p>
              <p className="text-sm text-slate-500">
                {isProcessing ? 'Processing...' :
                 isPending ? 'Waiting in queue' :
                 isCompleted ? 'All steps completed' :
                 'Check error details below'}
              </p>
            </div>
          </div>
        </div>

        {/* Results */}
        {isCompleted && jobProgress?.result && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-emerald-800 mb-4">Generation Results</h3>
            <div className="space-y-2 text-sm">
              {jobProgress.result.repoUrl && (
                <p><span className="text-emerald-700 font-medium">GitHub:</span>{' '}
                  <a href={jobProgress.result.repoUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                    {jobProgress.result.repoUrl}
                  </a>
                </p>
              )}
              {jobProgress.result.deploymentUrl && (
                <p><span className="text-emerald-700 font-medium">Live URL:</span>{' '}
                  <a href={jobProgress.result.deploymentUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                    {jobProgress.result.deploymentUrl}
                  </a>
                </p>
              )}
              {jobProgress.result.filesGenerated && (
                <p><span className="text-emerald-700 font-medium">Files Generated:</span> {jobProgress.result.filesGenerated}</p>
              )}
              {jobProgress.result.pagesGenerated && (
                <p><span className="text-emerald-700 font-medium">Pages Created:</span> {jobProgress.result.pagesGenerated}</p>
              )}
            </div>
          </div>
        )}

        {/* Error Details */}
        {isFailed && jobProgress?.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-red-800 mb-2">Error Details</h3>
            <p className="text-sm text-red-700">{jobProgress.error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={() => navigate('/websites')}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
          >
            View All Websites
          </button>
          {isCompleted && jobProgress?.result?.deploymentUrl && (
            <a
              href={jobProgress.result.deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              View Live Site
            </a>
          )}
          {isFailed && (
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10" />
          {STEPS.slice(0, 4).map((s) => (
            <div key={s.id} className="flex flex-col items-center bg-slate-50 px-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                  step >= s.id
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white border-slate-300 text-slate-400'
                }`}
              >
                <s.icon size={20} />
              </div>
              <span className={`mt-2 text-sm font-medium ${step >= s.id ? 'text-indigo-600' : 'text-slate-500'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8">
          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Tell us about your business</h2>
                <p className="text-slate-500 mt-1">We'll use this to create your SEO-optimized website.</p>
              </div>

              {/* Business Selector */}
              {businesses.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-indigo-900 mb-2">
                    <Building2 size={16} className="inline mr-2" />
                    Use an existing business or create new
                  </label>
                  <select
                    className="w-full px-4 py-2.5 rounded-lg border border-indigo-300 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    value={selectedBusinessId || ''}
                    onChange={e => handleBusinessSelect(e.target.value)}
                  >
                    <option value="">+ Create New Business</option>
                    {businesses.map(business => (
                      <option key={business.id} value={business.id}>
                        {business.business_name} ({business.business_type})
                      </option>
                    ))}
                  </select>
                  {selectedBusinessId && (
                    <p className="text-xs text-indigo-600 mt-2">
                      Business info will be pre-filled. You can still edit below.
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Name *</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="e.g. Seattle Plumbing Pro"
                      value={formData.businessName}
                      onChange={e => setFormData({...formData, businessName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Business Type/Niche *</label>
                    <input
                      type="text"
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="e.g. Plumber, Electrician, Lawyer, Dentist"
                      value={formData.niche}
                      onChange={e => setFormData({...formData, niche: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="tel"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="email"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        placeholder="info@business.com"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Business Description</label>
                  <textarea
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                    rows={3}
                    placeholder="Tell us about your business, specialties, and what makes you unique..."
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Services Offered *</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="e.g. Drain Cleaning"
                      value={newServiceInput}
                      onChange={e => setNewServiceInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addService())}
                    />
                    <button
                      onClick={addService}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.services.map(service => (
                      <span key={service} className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
                        {service}
                        <button onClick={() => removeService(service)} className="hover:text-indigo-900">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                    {formData.services.length === 0 && (
                      <span className="text-sm text-slate-400">Add at least one service</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Locations */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Service Locations</h2>
                <p className="text-slate-500 mt-1">Where does your business operate?</p>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary Address</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none mb-3"
                    placeholder="Street Address"
                    value={formData.addressStreet}
                    onChange={e => setFormData({...formData, addressStreet: e.target.value})}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="City *"
                      value={formData.addressCity}
                      onChange={e => setFormData({...formData, addressCity: e.target.value})}
                    />
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="State *"
                      value={formData.addressState}
                      onChange={e => setFormData({...formData, addressState: e.target.value})}
                    />
                    <input
                      type="text"
                      className="px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="ZIP"
                      value={formData.addressZip}
                      onChange={e => setFormData({...formData, addressZip: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Additional Target Cities</label>
                  <p className="text-sm text-slate-500 mb-3">Add more cities to generate location-specific landing pages for better local SEO.</p>

                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="City name"
                      value={newCityInput.name}
                      onChange={e => setNewCityInput({...newCityInput, name: e.target.value})}
                    />
                    <input
                      type="text"
                      className="w-20 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="State"
                      value={newCityInput.state}
                      onChange={e => setNewCityInput({...newCityInput, state: e.target.value})}
                    />
                    <button
                      onClick={addCity}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {formData.targetCities.map((city, index) => (
                      <span key={index} className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm">
                        <MapPin size={14} />
                        {city.name}, {city.state}
                        <button onClick={() => removeCity(index)} className="ml-1 hover:text-red-600">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                <h4 className="text-sm font-semibold text-indigo-900 mb-2">Programmatic SEO</h4>
                <p className="text-sm text-indigo-700">
                  We'll generate dedicated landing pages for each city you add,
                  optimized with local keywords like "{formData.niche || 'your service'} in {formData.targetCities[0]?.name || formData.addressCity || 'City'}"
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Design & SEO */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Design & SEO Strategy</h2>
                <p className="text-slate-500 mt-1">Choose colors and generate your SEO content.</p>
              </div>

              {/* Color Scheme */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Color Scheme</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => setFormData({...formData, colorScheme: preset})}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.colorScheme.primary === preset.primary
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex gap-1 mb-2">
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.primary }} />
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.secondary }} />
                        <div className="w-6 h-6 rounded" style={{ backgroundColor: preset.accent }} />
                      </div>
                      <span className="text-xs text-slate-600">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Webhook URL (Optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lead Form Webhook URL <span className="text-slate-400">(optional)</span>
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="url"
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="https://hooks.zapier.com/... or webhook URL"
                    value={formData.webhookUrl}
                    onChange={e => setFormData({...formData, webhookUrl: e.target.value})}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Lead form submissions will POST to this URL</p>
              </div>

              {/* SEO Generation */}
              <div className="pt-4 border-t border-slate-200">
                <h3 className="font-medium text-slate-900 mb-4">AI SEO Strategy</h3>

                {!formData.seoConfig ? (
                  <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                    <Search className="text-indigo-600 mb-4" size={40} />
                    <h4 className="text-lg font-medium text-slate-900 mb-2">Generate SEO Content</h4>
                    <p className="text-slate-500 text-center max-w-md mb-4">
                      Our AI will create optimized titles, descriptions, and keywords for your website.
                    </p>
                    <button
                      onClick={handleGenerateSEO}
                      disabled={isGenerating}
                      className="flex items-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-70"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={18} />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2" size={18} />
                          Generate SEO Strategy
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <SeoPreview
                      config={formData.seoConfig}
                      url={`www.${formData.businessName.toLowerCase().replace(/\s+/g, '')}.com`}
                    />

                    <div className="bg-slate-50 p-4 rounded-lg">
                      <h4 className="text-sm font-semibold text-slate-900 mb-3">Target Keywords</h4>
                      <div className="flex flex-wrap gap-2">
                        {formData.seoConfig.keywords.map((kw, i) => (
                          <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-sm text-slate-600">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateSEO}
                      disabled={isGenerating}
                      className="text-indigo-600 text-sm font-medium hover:underline"
                    >
                      {isGenerating ? 'Regenerating...' : 'Regenerate SEO'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-between items-center">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center px-4 py-2 text-slate-600 hover:text-slate-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </button>

          <button
            onClick={() => {
              if (step === 3) handleProceedToPayment();
              else setStep(s => s + 1);
            }}
            disabled={!canProceed() || isCreatingCheckout}
            className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreatingCheckout ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Processing...
              </>
            ) : step === 3 ? (
              <>
                <CreditCard size={16} className="mr-2" />
                Continue to Payment
              </>
            ) : (
              <>
                Continue
                <ArrowRight size={16} className="ml-2" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
