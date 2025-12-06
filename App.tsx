import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { WebsiteWizard } from './components/WebsiteWizard';
import { WebsiteSettings } from './components/WebsiteSettings';
import { Login } from './components/Login';
import { Settings } from './components/Settings';
import { Integrations } from './components/Integrations';
import { Websites } from './components/Websites';
import { Businesses } from './components/Businesses';
import { GitHubCallback } from './components/GitHubCallback';

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Routes>
          {/* Main Pages */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />

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
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;