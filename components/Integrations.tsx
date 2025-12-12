import React, { useState, useEffect, useRef } from 'react';
import {
  Github, Cloud, Globe, Check, X, ExternalLink,
  Loader2, AlertCircle, Key, RefreshCw, Trash2, ChevronDown, ChevronUp, Upload, FileJson,
  ShieldCheck, ShieldX, BarChart3
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
  const [showGoogleCloudModal, setShowGoogleCloudModal] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState<string | null>(null);

  // Google Cloud form state
  const [gcProjectId, setGcProjectId] = useState('');
  const [gcServiceAccountKey, setGcServiceAccountKey] = useState('');
  const [gcFileName, setGcFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // GCP role verification state
  const [gcpRoleStatus, setGcpRoleStatus] = useState<{
    loading: boolean;
    verified: boolean;
    roles: Array<{ displayName: string; found: boolean }>;
    missingRoles: string[];
    error?: string;
    apiNotEnabled?: boolean;
    enableUrl?: string;
  } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  // Verify GCP roles when profile has GCloud configured
  useEffect(() => {
    if (profile?.gcloud_project_id && user) {
      verifyGcpRoles();
    }
  }, [profile?.gcloud_project_id, user]);

  const verifyGcpRoles = async () => {
    if (!user) return;

    setGcpRoleStatus({ loading: true, verified: false, roles: [], missingRoles: [] });

    try {
      const { data, error } = await supabase.functions.invoke('verify-gcp-roles', {
        body: { userId: user.id },
      });

      if (error) throw error;

      if (data.apiNotEnabled) {
        setGcpRoleStatus({
          loading: false,
          verified: false,
          roles: [],
          missingRoles: [],
          error: data.error,
          apiNotEnabled: true,
          enableUrl: data.enableUrl,
        });
        return;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to verify roles');
      }

      console.log('GCP role verification result:', data);

      setGcpRoleStatus({
        loading: false,
        verified: data.allRolesFound,
        roles: data.roles || [],
        missingRoles: data.missingRoles || [],
      });
    } catch (err: any) {
      console.error('GCP role verification failed:', err);
      setGcpRoleStatus({
        loading: false,
        verified: false,
        roles: [],
        missingRoles: [],
        error: err.message,
      });
    }
  };

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
      id: 'google-analytics',
      name: 'Google Analytics & Search Console',
      description: 'View traffic analytics, search performance, and SEO metrics from your websites directly in the dashboard.',
      icon: BarChart3,
      color: 'bg-amber-500',
      connected: !!profile?.google_email,
      username: profile?.google_email,
      configKey: 'google_access_token',
    },
    {
      id: 'google-cloud',
      name: 'Google Cloud Run',
      description: 'Deploy websites to your own Google Cloud account for fast, scalable hosting under your control.',
      icon: Globe,
      color: 'bg-blue-500',
      connected: !!profile?.gcloud_project_id,
      username: profile?.gcloud_project_id,
      configKey: 'gcloud_project_id',
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
  ];

  const handleConnectGitHub = () => {
    const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
    if (!clientId) {
      setMessage({ type: 'error', text: 'GitHub Client ID not configured. Please add VITE_GITHUB_CLIENT_ID to your .env.local' });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const scope = 'repo user:email workflow';  // workflow scope required for .github/workflows/
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;

    window.location.href = authUrl;
  };

  const handleConnectGoogle = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setMessage({ type: 'error', text: 'Google Client ID not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env.local' });
      return;
    }

    const redirectUri = `${window.location.origin}/auth/google/callback`;
    // Scopes for Google Analytics and Search Console
    const scopes = [
      'https://www.googleapis.com/auth/analytics.readonly',      // Read GA4 data
      'https://www.googleapis.com/auth/analytics.edit',          // Create GA4 properties
      'https://www.googleapis.com/auth/webmasters.readonly',     // Read Search Console
      'https://www.googleapis.com/auth/webmasters',              // Manage Search Console sites
      'https://www.googleapis.com/auth/userinfo.email',          // Get user email
      'https://www.googleapis.com/auth/userinfo.profile',        // Get user profile
    ].join(' ');

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('access_type', 'offline');  // Get refresh token
    authUrl.searchParams.set('prompt', 'consent');       // Always show consent screen to get refresh token

    window.location.href = authUrl.toString();
  };

  const handleSaveToken = async (integrationId: string) => {
    if (!user || !tokenInput.trim()) return;

    setConnectingId(integrationId);
    setMessage(null);

    try {
      const updateData: Record<string, string> = {};

      if (integrationId === 'cloudflare') {
        updateData.cloudflare_api_token = tokenInput;
      } else if (integrationId === 'github') {
        // For manual GitHub token entry
        updateData.github_access_token = tokenInput;
        // Try to get username from token
        try {
          const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${tokenInput}` }
          });
          if (response.ok) {
            const userData = await response.json();
            updateData.github_username = userData.login;
          }
        } catch (e) {
          console.warn('Could not fetch GitHub username');
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: `${integrations.find(i => i.id === integrationId)?.name} connected successfully!` });
      setShowTokenModal(null);
      setTokenInput('');
      loadProfile();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save token' });
    } finally {
      setConnectingId(null);
    }
  };

  const handleSaveGoogleCloud = async () => {
    if (!user || !gcProjectId.trim() || !gcServiceAccountKey.trim()) return;

    setConnectingId('google-cloud');
    setMessage(null);

    try {
      // Validate JSON
      let serviceAccountJson;
      try {
        serviceAccountJson = JSON.parse(gcServiceAccountKey);
      } catch (e) {
        throw new Error('Invalid JSON format for service account key');
      }

      if (!serviceAccountJson.project_id || !serviceAccountJson.private_key) {
        throw new Error('Service account key must include project_id and private_key');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          gcloud_project_id: gcProjectId,
          gcloud_service_account_key: gcServiceAccountKey,
        })
        .eq('id', user.id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Google Cloud connected successfully!' });
      setShowGoogleCloudModal(false);
      setGcProjectId('');
      setGcServiceAccountKey('');
      setGcFileName(null);
      loadProfile();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save Google Cloud credentials' });
    } finally {
      setConnectingId(null);
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.json')) {
      setMessage({ type: 'error', text: 'Please upload a JSON file' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const json = JSON.parse(content);

        // Validate it's a service account key
        if (!json.type || json.type !== 'service_account') {
          setMessage({ type: 'error', text: 'This doesn\'t appear to be a Google Cloud service account key' });
          return;
        }

        if (!json.project_id || !json.private_key) {
          setMessage({ type: 'error', text: 'Invalid service account key: missing project_id or private_key' });
          return;
        }

        // Auto-fill both fields
        setGcServiceAccountKey(content);
        setGcProjectId(json.project_id);
        setGcFileName(file.name);
        setMessage(null);
      } catch (err) {
        setMessage({ type: 'error', text: 'Invalid JSON file. Please upload a valid service account key.' });
      }
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
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
      } else if (integrationId === 'google-analytics') {
        updateData.google_access_token = null;
        updateData.google_refresh_token = null;
        updateData.google_token_expires_at = null;
        updateData.google_email = null;
        updateData.google_scopes = null;
      } else if (integrationId === 'cloudflare') {
        updateData.cloudflare_api_token = null;
        updateData.cloudflare_account_id = null;
      } else if (integrationId === 'google-cloud') {
        updateData.gcloud_project_id = null;
        updateData.gcloud_service_account_key = null;
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
      // Check if we have GitHub OAuth configured, otherwise show manual token input
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
      if (clientId) {
        handleConnectGitHub();
      } else {
        setShowTokenModal('github');
      }
    } else if (integration.id === 'google-analytics') {
      // Check if we have Google OAuth configured
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (clientId) {
        handleConnectGoogle();
      } else {
        setMessage({ type: 'error', text: 'Google OAuth not configured. Please add VITE_GOOGLE_CLIENT_ID to your .env.local' });
      }
    } else if (integration.id === 'google-cloud') {
      setShowGoogleCloudModal(true);
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
                    <span className="font-medium">
                      {integration.id === 'google-cloud' ? 'Project:' : 'Account:'}
                    </span> {integration.username}
                  </p>
                )}

                {/* GCP Role Verification Status */}
                {integration.id === 'google-cloud' && integration.connected && gcpRoleStatus && (
                  <div className="mt-3">
                    {gcpRoleStatus.loading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 size={14} className="animate-spin" />
                        Verifying permissions...
                      </div>
                    ) : gcpRoleStatus.apiNotEnabled ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">API Not Enabled</p>
                            <p className="text-xs text-amber-700 mt-1">
                              Cloud Resource Manager API is required to verify permissions.
                            </p>
                            <a
                              href={gcpRoleStatus.enableUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium mt-2"
                            >
                              Enable API <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : gcpRoleStatus.verified ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-600">
                        <ShieldCheck size={16} />
                        All required permissions verified
                      </div>
                    ) : gcpRoleStatus.error ? (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">Verification Error</p>
                            <p className="text-xs text-amber-700 mt-1">
                              {gcpRoleStatus.error}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : gcpRoleStatus.missingRoles.length > 0 ? (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <ShieldX size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-red-800">Missing Permissions</p>
                            <p className="text-xs text-red-700 mt-1">
                              Add these roles to your service account:
                            </p>
                            <ul className="text-xs text-red-700 mt-1 space-y-0.5">
                              {gcpRoleStatus.missingRoles.map((role, i) => (
                                <li key={i}>• {role}</li>
                              ))}
                            </ul>
                            <a
                              href={`https://console.cloud.google.com/iam-admin/iam?project=${profile?.gcloud_project_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-red-700 hover:text-red-900 font-medium mt-2"
                            >
                              Open IAM Console <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">Unable to Verify Permissions</p>
                            <p className="text-xs text-amber-700 mt-1">
                              Could not verify roles. Make sure your service account has the required permissions.
                            </p>
                            <a
                              href={`https://console.cloud.google.com/iam-admin/iam?project=${profile?.gcloud_project_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-medium mt-2"
                            >
                              Open IAM Console <ExternalLink size={10} />
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                    {!gcpRoleStatus.loading && (
                      <button
                        onClick={verifyGcpRoles}
                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                      >
                        <RefreshCw size={12} /> Re-verify permissions
                      </button>
                    )}
                  </div>
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
        <h3 className="font-semibold text-slate-900 mb-4">How to get your API keys:</h3>

        {/* GitHub Instructions */}
        <div className="mb-4 border-b border-slate-200 pb-4">
          <button
            onClick={() => setShowInstructions(showInstructions === 'github' ? null : 'github')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <Github size={18} />
              GitHub Personal Access Token
            </span>
            {showInstructions === 'github' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showInstructions === 'github' && (
            <div className="mt-3 pl-7 text-sm text-slate-600 space-y-2">
              <p>1. Go to <a href="https://github.com/settings/tokens/new?scopes=repo,user:email,workflow&description=RankForge" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">GitHub Token Settings</a></p>
              <p>2. Select scopes: <code className="bg-slate-200 px-1 rounded">repo</code>, <code className="bg-slate-200 px-1 rounded">user:email</code>, and <code className="bg-slate-200 px-1 rounded">workflow</code></p>
              <p>3. Click "Generate token" and copy it</p>
              <p>4. Paste the token here when connecting</p>
            </div>
          )}
        </div>

        {/* Google Cloud Instructions */}
        <div className="mb-4 border-b border-slate-200 pb-4">
          <button
            onClick={() => setShowInstructions(showInstructions === 'google-cloud' ? null : 'google-cloud')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <Globe size={18} />
              Google Cloud Setup
            </span>
            {showInstructions === 'google-cloud' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showInstructions === 'google-cloud' && (
            <div className="mt-3 pl-7 text-sm text-slate-600 space-y-3">
              <p className="font-medium text-slate-700">Step 1: Create a Google Cloud Project</p>
              <p>Go to <a href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Google Cloud Console</a> and create a new project (or use existing)</p>

              <p className="font-medium text-slate-700 mt-4">Step 2: Enable Required APIs</p>
              <p>Enable these APIs for your project:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li><a href="https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Cloud Resource Manager API</a> (required for verification)</li>
                <li><a href="https://console.cloud.google.com/apis/library/run.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Cloud Run API</a></li>
                <li><a href="https://console.cloud.google.com/apis/library/cloudbuild.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Cloud Build API</a></li>
                <li><a href="https://console.cloud.google.com/apis/library/containerregistry.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Container Registry API</a></li>
                <li><a href="https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Artifact Registry API</a></li>
              </ul>

              <p className="font-medium text-slate-700 mt-4">Step 3: Create a Service Account</p>
              <p>1. Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts/create" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">IAM & Admin → Service Accounts</a></p>
              <p>2. Create a new service account with these roles:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li><code className="bg-slate-200 px-1 rounded">Cloud Run Admin</code></li>
                <li><code className="bg-slate-200 px-1 rounded">Cloud Build Editor</code></li>
                <li><code className="bg-slate-200 px-1 rounded">Storage Admin</code></li>
                <li><code className="bg-slate-200 px-1 rounded">Service Account User</code></li>
                <li><code className="bg-slate-200 px-1 rounded">Security Reviewer</code> (for permission verification)</li>
              </ul>

              <p className="font-medium text-slate-700 mt-4">Step 4: Download Service Account Key</p>
              <p>1. Click on your service account</p>
              <p>2. Go to "Keys" tab → "Add Key" → "Create new key"</p>
              <p>3. Select JSON format and download</p>
              <p>4. Paste the entire JSON content when connecting</p>

              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-amber-700 text-xs">
                  <strong>Security Note:</strong> Your service account key is stored securely and encrypted.
                  It's used only to deploy websites to YOUR Google Cloud account.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Cloudflare Instructions */}
        <div>
          <button
            onClick={() => setShowInstructions(showInstructions === 'cloudflare' ? null : 'cloudflare')}
            className="flex items-center justify-between w-full text-left"
          >
            <span className="flex items-center gap-2 font-medium text-slate-700">
              <Cloud size={18} />
              Cloudflare API Token
            </span>
            {showInstructions === 'cloudflare' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showInstructions === 'cloudflare' && (
            <div className="mt-3 pl-7 text-sm text-slate-600 space-y-2">
              <p>1. Go to <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Cloudflare API Tokens</a></p>
              <p>2. Click "Create Token"</p>
              <p>3. Use the "Edit zone DNS" template or create custom with:</p>
              <ul className="list-disc ml-5">
                <li>Zone:DNS:Edit</li>
                <li>Zone:Zone:Read</li>
              </ul>
              <p>4. Copy the generated token</p>
            </div>
          )}
        </div>
      </div>

      {/* Token Input Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Connect {integrations.find(i => i.id === showTokenModal)?.name}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Enter your {showTokenModal === 'github' ? 'Personal Access Token' : 'API token'} to connect this integration.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                {showTokenModal === 'github' ? 'Personal Access Token' : 'API Token'}
              </label>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={showTokenModal === 'github' ? 'ghp_xxxxxxxxxxxx' : 'Enter your API token...'}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
                autoFocus
              />
              {showTokenModal === 'github' && (
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,user:email,workflow&description=RankForge"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline mt-2 inline-block"
                >
                  Create a new token →
                </a>
              )}
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

      {/* Google Cloud Modal */}
      {showGoogleCloudModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Connect Google Cloud Run
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Deploy websites to your own Google Cloud account. Your websites will be hosted under your project.
            </p>

            <div className="space-y-4">
              {/* File Upload Zone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Service Account Key
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {gcFileName ? (
                  // File uploaded state
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <FileJson className="w-8 h-8 text-emerald-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-emerald-800 truncate">{gcFileName}</p>
                      <p className="text-xs text-emerald-600">Project: {gcProjectId}</p>
                    </div>
                    <button
                      onClick={() => {
                        setGcFileName(null);
                        setGcServiceAccountKey('');
                        setGcProjectId('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  // Upload zone
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative cursor-pointer border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
                    }`}
                  >
                    <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <p className="text-sm font-medium text-slate-700">
                      {isDragging ? 'Drop your JSON file here' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Upload the JSON key file downloaded from Google Cloud
                    </p>
                  </div>
                )}
              </div>

              {/* Project ID - auto-filled but editable */}
              {gcFileName && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project ID <span className="text-slate-400 font-normal">(auto-detected)</span>
                  </label>
                  <input
                    type="text"
                    value={gcProjectId}
                    onChange={(e) => setGcProjectId(e.target.value)}
                    placeholder="my-project-123456"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm bg-slate-50"
                  />
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 text-xs">
                  <strong>Required APIs:</strong> Cloud Resource Manager, Cloud Run, Cloud Build, Container Registry, Artifact Registry
                </p>
                <p className="text-blue-700 text-xs mt-1">
                  <strong>Required Roles:</strong> Cloud Run Admin, Cloud Build Editor, Storage Admin, Service Account User, Security Reviewer
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowGoogleCloudModal(false);
                  setGcProjectId('');
                  setGcServiceAccountKey('');
                  setGcFileName(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGoogleCloud}
                disabled={!gcProjectId.trim() || !gcServiceAccountKey.trim() || connectingId === 'google-cloud'}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
              >
                {connectingId === 'google-cloud' ? (
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
