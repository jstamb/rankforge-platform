import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const GoogleCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to Google...');
  const [grantedServices, setGrantedServices] = useState<{ analytics: boolean; searchConsole: boolean }>({
    analytics: false,
    searchConsole: false,
  });

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      setStatus('error');
      setMessage(`Google authorization failed: ${error}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setMessage('No authorization code received from Google');
      return;
    }

    try {
      setMessage('Exchanging authorization code...');

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setStatus('error');
        setMessage('Please sign in to connect Google');
        return;
      }

      // Call our Supabase Edge Function to exchange the code
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const redirectUri = `${window.location.origin}/auth/google/callback`;

      const response = await fetch(`${supabaseUrl}/functions/v1/google-oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ code, userId: user.id, redirectUri }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Google OAuth error response:', data);
        throw new Error(data.error || data.details || 'Failed to exchange code');
      }

      // Track granted services
      setGrantedServices({
        analytics: data.hasAnalytics || false,
        searchConsole: data.hasSearchConsole || false,
      });

      // Success!
      setStatus('success');
      setMessage(`Connected as ${data.email}!`);

      // Redirect to integrations after a short delay
      setTimeout(() => {
        navigate('/integrations');
      }, 2500);

    } catch (err: any) {
      console.error('Google callback error:', err);
      setStatus('error');
      setMessage(err.message || 'Failed to connect Google.');
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Connecting Google</h2>
            <p className="text-slate-500 mt-2">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900">Connected!</h2>
            <p className="text-slate-500 mt-2">{message}</p>

            {/* Show granted permissions */}
            <div className="mt-4 space-y-2">
              <div className={`flex items-center justify-center gap-2 text-sm ${
                grantedServices.analytics ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                <BarChart3 size={16} />
                <span>Google Analytics {grantedServices.analytics ? 'Enabled' : 'Not Granted'}</span>
              </div>
              <div className={`flex items-center justify-center gap-2 text-sm ${
                grantedServices.searchConsole ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                <BarChart3 size={16} />
                <span>Search Console {grantedServices.searchConsole ? 'Enabled' : 'Not Granted'}</span>
              </div>
            </div>

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
              <button
                onClick={() => {
                  // Retry the OAuth flow
                  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
                  if (clientId) {
                    const redirectUri = `${window.location.origin}/auth/google/callback`;
                    const scopes = [
                      'https://www.googleapis.com/auth/analytics.readonly',
                      'https://www.googleapis.com/auth/analytics.edit',
                      'https://www.googleapis.com/auth/webmasters.readonly',
                      'https://www.googleapis.com/auth/webmasters',
                      'https://www.googleapis.com/auth/userinfo.email',
                      'https://www.googleapis.com/auth/userinfo.profile',
                    ].join(' ');

                    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
                    authUrl.searchParams.set('client_id', clientId);
                    authUrl.searchParams.set('redirect_uri', redirectUri);
                    authUrl.searchParams.set('response_type', 'code');
                    authUrl.searchParams.set('scope', scopes);
                    authUrl.searchParams.set('access_type', 'offline');
                    authUrl.searchParams.set('prompt', 'consent');

                    window.location.href = authUrl.toString();
                  }
                }}
                className="w-full px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
