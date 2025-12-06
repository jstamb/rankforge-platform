import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Globe, Save, Loader2, Trash2, ExternalLink,
  Github, AlertTriangle, CheckCircle, RefreshCw
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Website, GenerationJob } from '../types';
import { JobProgress } from './JobProgress';

export const WebsiteSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [website, setWebsite] = useState<Website | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    loadWebsite();
  }, [id]);

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
    </div>
  );
};
