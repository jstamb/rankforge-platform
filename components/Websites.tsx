import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Globe, Plus, Search, Filter, MoreVertical, ExternalLink,
  Loader2, AlertCircle, Trash2, Settings, Eye, RefreshCw,
  CheckCircle, Clock, AlertTriangle, XCircle, RotateCcw
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Website } from '../types';
import { createGenerationJob } from '../services/jobQueue';

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-600', icon: Clock },
  generating: { label: 'Generating', color: 'bg-amber-100 text-amber-700', icon: RefreshCw },
  deployed: { label: 'Live', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: XCircle },
};

export const Websites: React.FC = () => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadWebsites();
  }, []);

  const loadWebsites = async () => {
    if (!isSupabaseConfigured()) {
      // Load mock data for demo
      setWebsites([
        {
          id: '1',
          business_id: '1',
          name: 'Seattle Plumbing Pro',
          slug: 'seattle-plumbing-pro',
          domain: 'seattleplumbingpro.com',
          status: 'deployed',
          template: 'modern',
          location_count: 12,
          service_count: 8,
          last_deployed_at: '2024-01-15T10:30:00Z',
          created_at: '2024-01-10T08:00:00Z',
        },
        {
          id: '2',
          business_id: '2',
          name: 'Bay Area Law Group',
          slug: 'bay-area-law',
          status: 'generating',
          template: 'professional',
          location_count: 5,
          service_count: 4,
          created_at: '2024-01-14T14:00:00Z',
        },
        {
          id: '3',
          business_id: '3',
          name: 'Denver HVAC Experts',
          slug: 'denver-hvac',
          status: 'draft',
          template: 'modern',
          location_count: 0,
          service_count: 0,
          created_at: '2024-01-16T09:00:00Z',
        },
      ]);
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Use the website_stats view for counts
      const { data, error } = await supabase
        .from('website_stats')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWebsites(data || []);
    } catch (error) {
      console.error('Error loading websites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase
          .from('websites')
          .delete()
          .eq('id', id);
        if (error) throw error;
      }
      setWebsites(websites.filter(w => w.id !== id));
      setShowDeleteModal(null);
    } catch (error) {
      console.error('Error deleting website:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerate = async (websiteId: string, businessId: string) => {
    console.log('Starting regeneration for website:', websiteId, 'business:', businessId);

    if (!businessId) {
      console.error('No business_id found for website. Please refresh the page or run the SQL migration.');
      alert('Error: Missing business_id. Please refresh the page after running the SQL migration.');
      return;
    }

    setRegenerating(websiteId);
    try {
      if (!isSupabaseConfigured()) {
        // Demo mode - just simulate regeneration
        setWebsites(websites.map(w =>
          w.id === websiteId ? { ...w, status: 'generating' as const } : w
        ));
        await new Promise(resolve => setTimeout(resolve, 2000));
        setWebsites(websites.map(w =>
          w.id === websiteId ? { ...w, status: 'deployed' as const, last_deployed_at: new Date().toISOString() } : w
        ));
        return;
      }

      // Fetch business info
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (businessError || !business) {
        throw new Error('Business not found');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Update website status to generating
      await supabase
        .from('websites')
        .update({ status: 'generating' })
        .eq('id', websiteId);

      setWebsites(websites.map(w =>
        w.id === websiteId ? { ...w, status: 'generating' as const } : w
      ));

      // Create a new generation job
      const { jobId, queuePosition } = await createGenerationJob(
        user.id,
        websiteId,
        {
          businessName: business.business_name,
          businessType: business.business_type,
          phone: business.phone,
          email: business.email,
          address: {
            street: business.address_street,
            city: business.address_city,
            state: business.address_state || '',
            zip: business.address_zip || '',
          },
          description: business.description,
          services: business.services || [],
          targetKeywords: business.target_keywords || [],
        },
        {
          useAI: true,
          deployToGithub: true,
          deployToCloudRun: true,
        }
      );

      console.log(`Job created: ${jobId}, Queue position: ${queuePosition}`);

      // Navigate to settings page to see progress
      navigate(`/websites/${websiteId}/settings`);
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      console.error('Error regenerating website:', errorMessage, error);
      alert(`Generation failed: ${errorMessage}`);

      // Reset status on error
      if (isSupabaseConfigured()) {
        await supabase
          .from('websites')
          .update({ status: 'error' })
          .eq('id', websiteId);
      }
      setWebsites(websites.map(w =>
        w.id === websiteId ? { ...w, status: 'error' as const } : w
      ));
    } finally {
      setRegenerating(null);
    }
  };

  const filteredWebsites = websites.filter(website => {
    const matchesSearch = website.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      website.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || website.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Websites</h1>
          <p className="text-slate-500 mt-1">Manage your generated SEO websites</p>
        </div>
        <Link
          to="/websites/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          New Website
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search websites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="pl-10 pr-8 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="generating">Generating</option>
            <option value="deployed">Deployed</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {filteredWebsites.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No websites yet</h3>
          <p className="text-slate-500 mt-2 mb-6">Create your first SEO-optimized website to get started.</p>
          <Link
            to="/websites/new"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
            Create Website
          </Link>
        </div>
      )}

      {/* Websites Grid */}
      {filteredWebsites.length > 0 && (
        <div className="grid gap-4">
          {filteredWebsites.map((website) => {
            const status = statusConfig[website.status as keyof typeof statusConfig];
            const StatusIcon = status.icon;

            return (
              <div
                key={website.id}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                    <Globe size={24} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900 truncate">{website.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        <StatusIcon size={12} className={website.status === 'generating' ? 'animate-spin' : ''} />
                        {status.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                      {website.domain ? (
                        <a
                          href={`https://${website.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-indigo-600 hover:underline"
                        >
                          {website.domain}
                          <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-slate-400">No domain connected</span>
                      )}
                      <span>•</span>
                      <span>{website.location_count || 0} locations</span>
                      <span>•</span>
                      <span>{website.service_count || 0} services</span>
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span>Created {formatDate(website.created_at)}</span>
                      {website.last_deployed_at && (
                        <>
                          <span>•</span>
                          <span>Last deployed {formatDate(website.last_deployed_at)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Regenerate button for draft, stuck generating, or error */}
                    {(website.status === 'draft' || website.status === 'generating' || website.status === 'error') && (
                      <button
                        onClick={() => handleRegenerate(website.id, website.business_id)}
                        disabled={regenerating === website.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 rounded-lg transition-colors"
                        title={website.status === 'generating' ? 'Retry Generation' : 'Generate Website'}
                      >
                        {regenerating === website.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                        {website.status === 'draft' ? 'Generate' : website.status === 'error' ? 'Retry' : 'Retry'}
                      </button>
                    )}
                    {website.status === 'deployed' && website.domain && (
                      <a
                        href={`https://${website.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="View Site"
                      >
                        <Eye size={18} />
                      </a>
                    )}
                    <Link
                      to={`/websites/${website.id}/settings`}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Settings"
                    >
                      <Settings size={18} />
                    </Link>
                    <button
                      onClick={() => setShowDeleteModal(website.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              Are you sure you want to delete this website? All generated pages, SEO content, and deployment configurations will be permanently removed.
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteModal)}
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
