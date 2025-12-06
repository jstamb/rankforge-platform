import React, { useState, useEffect } from 'react';
import {
  Github, Cloud, Globe, Zap, Check, X, ExternalLink,
  Loader2, AlertCircle, Key, RefreshCw, Trash2
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  connected: boolean;
  username?: string;
  lastSync?: string;
  configKey: string;
}

export const Integrations: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [showTokenModal, setShowTokenModal] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
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
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const integrations: Integration[] = [
    {
      id: 'github',
      name: 'GitHub',
      description: 'Connect your GitHub account to automatically create repositories for your generated websites.',
      icon: Github,
      color: 'bg-slate-900',
      connected: !!profile?.github_username,
      username: profile?.github_username,
      configKey: 'github_access_token',
    },
    {
      id: 'cloudflare',
      name: 'Cloudflare',
      description: 'Manage DNS records and SSL certificates for your custom domains.',
      icon: Cloud,
      color: 'bg-orange-500',
      connected: !!profile?.cloudflare_api_token,
      configKey: 'cloudflare_api_token',
    },
    {
      id: 'google-cloud',
      name: 'Google Cloud Run',
      description: 'Deploy your websites to Google Cloud Run for fast, scalable hosting.',
      icon: Globe,
      color: 'bg-blue-500',
      connected: !!import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID,
      username: import.meta.env.VITE_GOOGLE_CLOUD_PROJECT_ID || undefined,
      configKey: 'google_cloud',
    },
    {
      id: 'n8n',
      name: 'N8N Workflows',
      description: 'Automate SEO tasks and content updates with N8N workflow automation.',
      icon: Zap,
      color: 'bg-rose-500',
      connected: !!profile?.n8n_api_key,
      configKey: 'n8n_api_key',
    },
  ];

  const handleConnectGitHub = () => {
    // GitHub OAuth flow
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      setMessage({ type: 'error', text: 'GitHub Client ID not configured. Please add VITE_GITHUB_CLIENT_ID to your .env.local' });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const scope = 'repo user:email';
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;

    window.location.href = authUrl;
  };

  const handleSaveToken = async (integrationId: string) => {
    if (!user || !tokenInput.trim()) return;

    setConnectingId(integrationId);
    setMessage(null);

    try {
      const updateData: Record<string, string> = {};

      if (integrationId === 'cloudflare') {
        updateData.cloudflare_api_token = tokenInput;
      } else if (integrationId === 'n8n') {
        updateData.n8n_api_key = tokenInput;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: `${integrations.find(i => i.id === integrationId)?.name} connected successfully!` });
      setShowTokenModal(null);
      setTokenInput('');
      loadProfile(); // Refresh profile data
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save token' });
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to disconnect this integration?')) return;

    setConnectingId(integrationId);

    try {
      const updateData: Record<string, null> = {};

      if (integrationId === 'github') {
        updateData.github_access_token = null;
        updateData.github_username = null;
      } else if (integrationId === 'cloudflare') {
        updateData.cloudflare_api_token = null;
        updateData.cloudflare_account_id = null;
      } else if (integrationId === 'n8n') {
        updateData.n8n_api_key = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Integration disconnected' });
      loadProfile();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to disconnect' });
    } finally {
      setConnectingId(null);
    }
  };

  const handleConnect = (integration: Integration) => {
    if (integration.id === 'github') {
      handleConnectGitHub();
    } else if (integration.id === 'google-cloud') {
      setMessage({
        type: 'error',
        text: 'Google Cloud is configured via environment variables. Check your .env.local file.'
      });
    } else {
      setShowTokenModal(integration.id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-amber-800">Sign in required</h2>
          <p className="text-amber-600 mt-2">Please sign in to manage your integrations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <p className="text-slate-500 mt-1">Connect external services to power your website generation pipeline</p>
      </div>

      {/* Message */}
      {message && (
        <div className={`flex items-center gap-2 p-4 rounded-lg mb-6 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto hover:opacity-70"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Integrations Grid */}
      <div className="grid gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`w-12 h-12 ${integration.color} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                <integration.icon size={24} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{integration.name}</h3>
                  {integration.connected && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                      <Check size={12} />
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-slate-500 text-sm mt-1">{integration.description}</p>

                {integration.connected && integration.username && (
                  <p className="text-sm text-slate-600 mt-2">
                    <span className="font-medium">Account:</span> {integration.username}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {integration.connected ? (
                  <>
                    <button
                      onClick={() => loadProfile()}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Refresh"
                    >
                      <RefreshCw size={18} />
                    </button>
                    {integration.id !== 'google-cloud' && (
                      <button
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={connectingId === integration.id}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Disconnect"
                      >
                        {connectingId === integration.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(integration)}
                    disabled={connectingId === integration.id}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {connectingId === integration.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Key size={16} />
                    )}
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* API Keys Info */}
      <div className="mt-8 bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-2">Where to get API keys:</h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-2">
            <ExternalLink size={14} />
            <span><strong>GitHub:</strong> Automatic OAuth - just click Connect</span>
          </li>
          <li className="flex items-center gap-2">
            <ExternalLink size={14} />
            <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              <strong>Cloudflare:</strong> dash.cloudflare.com/profile/api-tokens
            </a>
          </li>
          <li className="flex items-center gap-2">
            <ExternalLink size={14} />
            <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              <strong>Google Cloud:</strong> console.cloud.google.com (Service Account)
            </a>
          </li>
          <li className="flex items-center gap-2">
            <ExternalLink size={14} />
            <span><strong>N8N:</strong> Your N8N instance settings → API → Create API Key</span>
          </li>
        </ul>
      </div>

      {/* Token Input Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Connect {integrations.find(i => i.id === showTokenModal)?.name}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Enter your API token to connect this integration.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                API Token
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Enter your API token..."
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                autoFocus
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTokenModal(null);
                  setTokenInput('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveToken(showTokenModal)}
                disabled={!tokenInput.trim() || connectingId === showTokenModal}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
              >
                {connectingId === showTokenModal ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
