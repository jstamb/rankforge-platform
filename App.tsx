import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { WebsiteWizard } from './components/WebsiteWizard';
import { WebsiteSettings } from './components/WebsiteSettings';
import { Login } from './components/Login';
import { Settings } from './components/Settings';
import { Integrations } from './components/Integrations';
import { Websites } from './components/Websites';
import { Businesses } from './components/Businesses';
import { GitHubCallback } from './components/GitHubCallback';
import { GoogleCallback } from './components/GoogleCallback';
import { supabase, isSupabaseConfigured } from './lib/supabase';

// Component to handle auth-based routing for home page
const HomePage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setIsAuthenticated(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show nothing while checking auth
  if (isAuthenticated === null) {
    return null;
  }

  // Show landing page for non-authenticated users
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Redirect authenticated users to dashboard (with Layout)
  return <Navigate to="/dashboard" replace />;
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Landing page - outside of Layout */}
        <Route path="/" element={<HomePage />} />

        {/* Auth pages - outside of Layout */}
        <Route path="/login" element={<Login />} />

        {/* App pages - inside Layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Websites */}
          <Route path="/websites" element={<Websites />} />
          <Route path="/websites/new" element={<WebsiteWizard />} />
          <Route path="/websites/:id/settings" element={<WebsiteSettings />} />

          {/* Businesses */}
          <Route path="/businesses" element={<Businesses />} />

          {/* Integrations */}
          <Route path="/integrations" element={<Integrations />} />

          {/* Settings */}
          <Route path="/settings" element={<Settings />} />

          {/* OAuth Callbacks */}
          <Route path="/auth/github/callback" element={<GitHubCallback />} />
          <Route path="/auth/google/callback" element={<GoogleCallback />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;