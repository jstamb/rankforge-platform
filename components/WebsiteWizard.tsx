import React, { useState, useEffect } from 'react';
import {
  Building2, MapPin, Search, ArrowRight, ArrowLeft, Loader2, Check,
  Palette, Globe, Plus, X, Phone, Mail, Sparkles
} from 'lucide-react';
import { generateSeoStrategy } from '../services/geminiService';
import { SeoPreview } from './SeoPreview';
import { SeoConfig } from '../types';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { createGenerationJob, subscribeToJobProgress, JobProgress } from '../services/jobQueue';
import { BusinessInput } from '../services/websiteGenerator';

const STEPS = [
  { id: 1, title: 'Business Info', icon: Building2 },
  { id: 2, title: 'Locations', icon: MapPin },
  { id: 3, title: 'Design & SEO', icon: Palette },
  { id: 4, title: 'Generate', icon: Sparkles },
];

const NICHE_OPTIONS = [
  'Plumber', 'Electrician', 'HVAC', 'Roofer', 'Landscaper',
  'Lawyer', 'Dentist', 'Chiropractor', 'Real Estate Agent',
  'Contractor', 'Painter', 'Locksmith', 'Pest Control', 'Other'
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
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobProgress, setJobProgress] = useState<JobProgress | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [newCityInput, setNewCityInput] = useState({ name: '', state: '' });
  const [newServiceInput, setNewServiceInput] = useState('');

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
  }, []);

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

  const handleStartGeneration = async () => {
    if (!user) {
      alert('Please sign in to generate a website');
      navigate('/login');
      return;
    }

    setIsGenerating(true);
    setStep(4);

    try {
      // Create business record
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
        })
        .select()
        .single();

      if (businessError) throw businessError;

      // Create website record
      const slug = formData.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: website, error: websiteError } = await supabase
        .from('websites')
        .insert({
          user_id: user.id,
          business_id: business.id,
          name: `${formData.businessName} Website`,
          slug,
          status: 'generating',
          template: 'modern',
        })
        .select()
        .single();

      if (websiteError) throw websiteError;

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

      // Create job in queue (N8N will process it)
      const { jobId, queuePosition: pos } = await createGenerationJob(
        user.id,
        website.id,
        businessInput,
        {
          useAI: true,
          deployToGithub: !!profile?.github_access_token,
          deployToCloudRun: true,
        }
      );

      setQueuePosition(pos);
      setJobProgress({
        jobId,
        status: 'pending',
        currentStep: 'Queued for processing',
        progress: 0,
        queuePosition: pos,
      });

      // Subscribe to real-time updates
      const channel = subscribeToJobProgress(jobId, (progress) => {
        setJobProgress(progress);
        setQueuePosition(progress.queuePosition || null);

        if (progress.status === 'completed' || progress.status === 'failed') {
          setIsGenerating(false);
        }
      });

      // Cleanup subscription when component unmounts
      return () => {
        channel.unsubscribe();
      };

    } catch (error: any) {
      console.error('Job creation failed:', error);
      setJobProgress({
        jobId: '',
        status: 'failed',
        currentStep: 'Failed to create job',
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

  // Generation Progress View
  if (step === 4) {
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
                {isProcessing ? 'Processing by N8N worker' :
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
          {STEPS.slice(0, 3).map((s) => (
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
                    <select
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      value={formData.niche}
                      onChange={e => setFormData({...formData, niche: e.target.value})}
                    >
                      <option value="">Select your niche...</option>
                      {NICHE_OPTIONS.map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
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
                    placeholder="https://hooks.zapier.com/... or N8N webhook"
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
              if (step === 3) handleStartGeneration();
              else setStep(s => s + 1);
            }}
            disabled={!canProceed() || isGenerating}
            className="flex items-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 3 ? (
              <>
                <Sparkles size={16} className="mr-2" />
                Start Generation
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
