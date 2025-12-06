import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
      // Exchange code for access token via your backend/edge function
      // For now, we'll simulate this - in production, you'd call a server endpoint
      // that securely exchanges the code using your client secret

      setMessage('Exchanging authorization code...');

      // In production, call your backend:
      // const response = await fetch('/api/auth/github', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ code }),
      // });
      // const { access_token, username } = await response.json();

      // For now, we'll show instructions since we need a backend for the token exchange
      setStatus('error');
      setMessage(
        'GitHub OAuth requires a backend endpoint to securely exchange the code for an access token. ' +
        'For now, you can manually add your GitHub Personal Access Token in the Integrations page.'
      );

      // If we had the token, we'd save it like this:
      // const { data: { user } } = await supabase.auth.getUser();
      // if (user) {
      //   await supabase.from('profiles').update({
      //     github_access_token: access_token,
      //     github_username: username,
      //   }).eq('id', user.id);
      // }
      // setStatus('success');
      // setMessage('GitHub connected successfully!');

    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Failed to connect GitHub');
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
            <button
              onClick={() => navigate('/integrations')}
              className="mt-6 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Go to Integrations
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Setup Required</h2>
            <p className="text-slate-500 mt-2 text-sm">{message}</p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => navigate('/integrations')}
                className="w-full px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Integrations
              </button>
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,user:email&description=RankForge"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Create GitHub Token
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
