import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Globe, Save, Loader2, Trash2, ExternalLink,
  Github, AlertTriangle, CheckCircle, RefreshCw, Cloud, Eye,
  Play, Settings2, MessageSquare
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Website, GenerationJob } from '../types';
import { JobProgress } from './JobProgress';
import { WebsiteChat } from './WebsiteChat';
import { createGenerationJob } from '../services/jobQueue';
import { BusinessInput } from '../services/websiteGenerator';

export const WebsiteSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [deployingPreview, setDeployingPreview] = useState(false);
  const [hasGoogleCloud, setHasGoogleCloud] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const autostartTriggered = useRef(false);

  // Form state
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    loadWebsite();
  }, [id]);

  // Handle autostart parameter from wizard redirect
  useEffect(() => {
    const shouldAutostart = searchParams.get('autostart') === 'true';
    if (shouldAutostart && website && !loading && !autostartTriggered.current) {
      autostartTriggered.current = true;
      // Clear the autostart param from URL
      searchParams.delete('autostart');
      setSearchParams(searchParams, { replace: true });
      // Auto-start generation
      handleStartGeneration();
    }
  }, [searchParams, website, loading]);

  const loadWebsite = async () => {
    if (!id) return;

    if (!isSupabaseConfigured()) {
      // Mock data for demo
      const mockWebsite: Website = {
        id,
        business_id: '1',
        name: 'Demo Website',
        slug: 'demo-website',
        status: 'draft',
        template: 'modern',
        created_at: new Date().toISOString(),
      };
      setWebsite(mockWebsite);
      setName(mockWebsite.name);
      setDomain(mockWebsite.domain || '');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('websites')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      setWebsite(data);
      setName(data.name);
      setDomain(data.domain || '');

      // Check for active generation job
      if (data.status === 'generating') {
        const { data: jobs } = await supabase
          .from('generation_jobs')
          .select('id')
          .eq('website_id', id)
          .in('status', ['pending', 'queued', 'processing'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (jobs && jobs.length > 0) {
          setActiveJobId(jobs[0].id);
        }
      }

      // Check if user has Google Cloud configured
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gcloud_service_account_key, gcloud_project_id')
          .eq('id', user.id)
          .single();

        setHasGoogleCloud(!!(profile?.gcloud_service_account_key && profile?.gcloud_project_id));
      }
    } catch (error) {
      console.error('Error loading website:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id || !website) return;

    setSaving(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('websites')
          .update({
            name,
            domain: domain || null,
          })
          .eq('id', id);

        if (error) throw error;
      }

      setWebsite({ ...website, name, domain: domain || undefined });
    } catch (error) {
      console.error('Error saving website:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    setDeleting(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('websites')
          .delete()
          .eq('id', id);

        if (error) throw error;
      }

      navigate('/websites');
    } catch (error) {
      console.error('Error deleting website:', error);
      setDeleting(false);
    }
  };

  const handleStartGeneration = async () => {
    if (!id || !website || isStartingGeneration) return;

    setIsStartingGeneration(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Get business info
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', website.business_id)
        .single();

      if (businessError || !business) {
        throw new Error('Business not found. Please refresh the page.');
      }

      // Build business input for generator
      const businessInput: BusinessInput = {
        businessName: business.business_name,
        niche: business.business_type,
        phone: business.phone || '',
        email: business.email || '',
        address: {
          street: business.address_street || '',
          city: business.address_city || '',
          state: business.address_state || '',
          zip: business.address_zip || '',
        },
        description: business.description || `Professional ${business.business_type?.toLowerCase()} services in ${business.address_city}`,
        services: business.services || [],
        targetCities: [{ name: business.address_city || '', state: business.address_state || '' }],
        colorScheme: { primary: '#1e40af', secondary: '#3b82f6', accent: '#f97316' },
        yearsInBusiness: business.years_in_business || 10,
      };

      // Update website status to generating
      await supabase
        .from('websites')
        .update({ status: 'generating' })
        .eq('id', id);

      setWebsite({ ...website, status: 'generating' });

      // Create generation job - workers will pick this up
      const { jobId, queuePosition } = await createGenerationJob(
        user.id,
        id,
        businessInput,
        {
          useAI: true,
          deployToGithub: true,
          deployToCloudRun: true,
        }
      );

      setActiveJobId(jobId);

    } catch (error: any) {
      console.error('Error starting generation:', error);
      alert(`Failed to start generation: ${error.message}`);
      // Reset website status on error
      if (website) {
        await supabase
          .from('websites')
          .update({ status: 'draft' })
          .eq('id', id);
        setWebsite({ ...website, status: 'draft' });
      }
    } finally {
      setIsStartingGeneration(false);
    }
  };

  const handleDeployPreview = async () => {
    if (!id || !website) return;

    setDeployingPreview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Create a deployment job - this will push to GitHub and GitHub Actions will auto-deploy to Cloud Run
      const { data: job, error } = await supabase
        .from('generation_jobs')
        .insert({
          user_id: user.id,
          website_id: id,
          job_type: 'deployment',
          priority: 10,
          status: 'pending',
          total_steps: 5,
          completed_steps: 0,
          progress_percent: 0,
          input_payload: {
            action: 'deploy_to_github',
            options: { deployToGithub: true },
          },
        })
        .select()
        .single();

      if (error) throw error;

      setActiveJobId(job.id);
      // The DeploymentWorker will pick up this job and push to GitHub
      // GitHub Actions will then automatically deploy to Cloud Run
    } catch (error: any) {
      console.error('Error deploying:', error);
      alert(`Failed to deploy: ${error.message}`);
    } finally {
      setDeployingPreview(false);
    }
  };

  const handleAnalyzeRepo = async () => {
    if (!id || !website || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('analyze-repo', {
        body: {
          websiteId: id,
          userId: user.id,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to analyze repository');
      }

      setAnalysisResult(data.message);
      // Refresh website data to get updated counts
      loadWebsite();
    } catch (error: any) {
      console.error('Error analyzing repo:', error);
      setAnalysisResult(`Error: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const statusConfig = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: RefreshCw },
    generating: { label: 'Generating', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
    deployed: { label: 'Live', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!website) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Website not found</h2>
        <p className="text-slate-500 mb-6">The website you're looking for doesn't exist or has been deleted.</p>
        <Link
          to="/websites"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium"
        >
          <ArrowLeft size={18} />
          Back to Websites
        </Link>
      </div>
    );
  }

  const status = statusConfig[website.status as keyof typeof statusConfig];
  const StatusIcon = status?.icon || RefreshCw;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          to="/websites"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Website Settings</h1>
          <p className="text-slate-500 mt-1">Manage your website configuration</p>
        </div>
      </div>

      {/* Website Info Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
            <Globe size={28} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-slate-900">{website.name}</h2>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status?.color || 'bg-slate-100 text-slate-600'}`}>
                <StatusIcon size={12} className={website.status === 'generating' ? 'animate-spin' : ''} />
                {status?.label || website.status}
              </span>
            </div>
            <p className="text-slate-500 mt-1">/{website.slug}</p>

            {website.github_repo_url && (
              <a
                href={website.github_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 text-sm text-indigo-600 hover:underline"
              >
                <Github size={16} />
                View Repository
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Preview & Deployment */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Eye size={20} />
          Preview & Deployment
        </h3>

        {/* Cloud Run Preview URL */}
        {website.cloud_run_service_url ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-800 mb-1">Preview URL</p>
                <a
                  href={website.cloud_run_service_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  {website.cloud_run_service_url}
                  <ExternalLink size={14} />
                </a>
              </div>
              <a
                href={website.cloud_run_service_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
              >
                <Eye size={16} />
                View Site
              </a>
            </div>
          </div>
        ) : website.github_repo_url ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">GitHub Pages Preview</p>
                <a
                  href={`https://${website.github_repo_url.split('/').slice(-2, -1)[0]}.github.io/${website.github_repo_url.split('/').pop()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  {`${website.github_repo_url.split('/').slice(-2, -1)[0]}.github.io/${website.github_repo_url.split('/').pop()}`}
                  <ExternalLink size={14} />
                </a>
                <p className="text-xs text-blue-600 mt-1">
                  Note: Enable GitHub Pages in repository settings to view
                </p>
              </div>
              <a
                href={`https://${website.github_repo_url.split('/').slice(-2, -1)[0]}.github.io/${website.github_repo_url.split('/').pop()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Eye size={16} />
                Try Preview
              </a>
            </div>
          </div>
        ) : null}

        {/* Refresh from GitHub - show if has GitHub repo */}
        {website.github_repo_url && (
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
            <div>
              <p className="font-medium text-slate-900">Sync from GitHub</p>
              <p className="text-sm text-slate-500">
                Analyze your repository to update page counts and structure
              </p>
              {analysisResult && (
                <p className={`text-sm mt-1 ${analysisResult.startsWith('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
                  {analysisResult}
                </p>
              )}
            </div>
            <button
              onClick={handleAnalyzeRepo}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors"
            >
              {isAnalyzing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {isAnalyzing ? 'Analyzing...' : 'Refresh'}
            </button>
          </div>
        )}

        {/* Deploy to Cloud Run button - show if has GitHub repo and Google Cloud configured */}
        {hasGoogleCloud && website.github_repo_url && !website.cloud_run_service_url && (
          <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4 mb-4">
            <div>
              <p className="font-medium text-slate-900">Deploy to Cloud Run</p>
              <p className="text-sm text-slate-500">
                Get a preview URL to view your site before connecting a custom domain
              </p>
            </div>
            <button
              onClick={handleDeployPreview}
              disabled={deployingPreview}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
            >
              {deployingPreview ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Cloud size={16} />
              )}
              Deploy Preview
            </button>
          </div>
        )}

        {/* No Google Cloud configured - show if has GitHub repo but no Google Cloud */}
        {!hasGoogleCloud && website.github_repo_url && !website.cloud_run_service_url && (
          <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div>
              <p className="font-medium text-amber-800">Cloud Run Not Configured</p>
              <p className="text-sm text-amber-600">
                Add your Google Cloud service account to deploy preview URLs
              </p>
            </div>
            <Link
              to="/integrations"
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
            >
              <Settings2 size={16} />
              Configure
            </Link>
          </div>
        )}

        {/* Website generating or draft status */}
        {website.status === 'generating' && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <Loader2 size={20} className="animate-spin text-amber-600 mx-auto mb-2" />
            <p className="text-amber-700 font-medium">Website is being generated...</p>
          </div>
        )}

        {/* Website error status */}
        {website.status === 'error' && !website.github_repo_url && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
            <AlertTriangle size={20} className="text-red-600 mx-auto mb-2" />
            <p className="text-red-700 font-medium">Generation failed. Please retry.</p>
          </div>
        )}

        {/* Draft status - no repo yet */}
        {website.status === 'draft' && !website.github_repo_url && (
          <div className="bg-slate-50 rounded-lg p-4 text-center">
            <p className="text-slate-500">Generate your website to get a preview URL</p>
          </div>
        )}
      </div>

      {/* Job Progress */}
      {activeJobId && (
        <div className="mb-6">
          <JobProgress
            jobId={activeJobId}
            onComplete={(result) => {
              setActiveJobId(null);
              loadWebsite(); // Refresh website status
            }}
          />
        </div>
      )}

      {/* Settings Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">General Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Website Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Custom Domain
            </label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            <p className="text-xs text-slate-400 mt-1">
              Point your domain's DNS to our servers to use a custom domain.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h3 className="text-lg font-semibold text-red-600 mb-2">Danger Zone</h3>
        <p className="text-slate-500 text-sm mb-4">
          Once you delete a website, there is no going back. All pages, content, and deployments will be permanently removed.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-medium transition-colors"
        >
          <Trash2 size={18} />
          Delete Website
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete Website</h3>
                <p className="text-sm text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-slate-600 mb-6">
              Are you sure you want to delete <strong>{website.name}</strong>? All generated pages, SEO content, and deployment configurations will be permanently removed.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium transition-colors"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Button */}
      {website.status === 'deployed' && !showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-full shadow-lg font-medium transition-all z-40"
        >
          <MessageSquare size={20} />
          Ask AI to Edit
        </button>
      )}

      {/* AI Chat Window */}
      {showChat && (
        <WebsiteChat
          websiteId={id!}
          websiteName={website.name}
          onClose={() => setShowChat(false)}
          onJobCreated={(jobId) => {
            setActiveJobId(jobId);
            // Update website status to show it's being modified
            setWebsite(prev => prev ? { ...prev, status: 'generating' } : null);
          }}
        />
      )}
    </div>
  );
};
