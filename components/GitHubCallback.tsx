import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const GitHubCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to GitHub...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`GitHub authorization failed: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received from GitHub');
      return;
    }

    try {
      setMessage('Exchanging authorization code...');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setStatus('error');
        setMessage('Please sign in to connect GitHub');
        return;
      }

      // Call our Supabase Edge Function to exchange the code
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const redirectUri = `${window.location.origin}/auth/github/callback`;
      const response = await fetch(`${supabaseUrl}/functions/v1/github-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ code, userId: user.id, redirectUri }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('GitHub OAuth error response:', data);
        throw new Error(data.error || data.details || 'Failed to exchange code');
      }

      // Success!
      setStatus('success');
      setMessage(`Connected as ${data.username}!`);

      // Redirect to integrations after a short delay
      setTimeout(() => {
        navigate('/integrations');
      }, 2000);

    } catch (err: any) {
      console.error('GitHub callback error:', err);
      setStatus('error');
      setMessage(err.message || 'Failed to connect GitHub. You can manually add a Personal Access Token.');
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Connecting GitHub</h2>
            <p className="text-slate-500 mt-2">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Connected!</h2>
            <p className="text-slate-500 mt-2">{message}</p>
            <p className="text-sm text-slate-400 mt-4">Redirecting to Integrations...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Connection Issue</h2>
            <p className="text-slate-500 mt-2 text-sm">{message}</p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => navigate('/integrations')}
                className="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Integrations
              </button>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,user:email,workflow&description=RankForge"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Create GitHub Token Manually
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
