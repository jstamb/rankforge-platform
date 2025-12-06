import React, { useState, useEffect } from 'react';
import { User, Mail, Building2, CreditCard, Shield, Bell, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';

export const Settings: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    full_name: '',
    company_name: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'notifications' | 'security'>('profile');

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

        // Load profile from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileData) {
          setProfile({
            full_name: profileData.full_name || '',
            company_name: profileData.company_name || '',
            email: profileData.email || user.email || '',
            subscription_tier: profileData.subscription_tier || 'free',
          });
        } else {
          setProfile(prev => ({ ...prev, email: user.email || '' }));
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !isSupabaseConfigured()) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: profile.email || user.email,
          full_name: profile.full_name,
          company_name: profile.company_name,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Profile saved successfully!' });
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save profile' });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

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
          <p className="text-amber-600 mt-2">Please sign in to access your settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Profile Information</h2>
            <p className="text-sm text-slate-500 mt-1">Update your personal details</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-2xl font-bold">
                {profile.full_name?.substring(0, 2).toUpperCase() || profile.email?.substring(0, 2).toUpperCase() || 'U'}
              </div>
              <div>
                <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                  Change Avatar
                </button>
                <p className="text-xs text-slate-500 mt-1">JPG, PNG or GIF. Max 2MB.</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={profile.full_name || ''}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={profile.email || ''}
                    disabled
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">Contact support to change email</p>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Company Name
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={profile.company_name || ''}
                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    placeholder="Acme Inc."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow"
                  />
                </div>
              </div>
            </div>

            {/* Message */}
            {message && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>
                {message.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
                {message.text}
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Subscription & Billing</h2>
            <p className="text-sm text-slate-500 mt-1">Manage your subscription plan</p>
          </div>

          <div className="p-6">
            {/* Current Plan */}
            <div className="bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl p-6 text-white mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm">Current Plan</p>
                  <h3 className="text-2xl font-bold mt-1 capitalize">{profile.subscription_tier || 'Free'}</h3>
                </div>
                <div className="text-right">
                  <p className="text-indigo-100 text-sm">Monthly</p>
                  <p className="text-2xl font-bold mt-1">
                    {profile.subscription_tier === 'free' ? '$0' : profile.subscription_tier === 'pro' ? '$49' : '$199'}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20">
                <p className="text-sm text-indigo-100">
                  {profile.subscription_tier === 'free'
                    ? '3 website generations per month'
                    : profile.subscription_tier === 'pro'
                    ? '25 website generations per month'
                    : 'Unlimited website generations'}
                </p>
              </div>
            </div>

            {/* Upgrade Options */}
            {profile.subscription_tier === 'free' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="border border-slate-200 rounded-xl p-6 hover:border-indigo-300 transition-colors">
                  <h4 className="font-semibold text-slate-900">Pro</h4>
                  <p className="text-2xl font-bold text-slate-900 mt-2">$49<span className="text-sm font-normal text-slate-500">/month</span></p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    <li>25 generations/month</li>
                    <li>3 concurrent jobs</li>
                    <li>50 locations per site</li>
                    <li>Email support</li>
                  </ul>
                  <button className="w-full mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">
                    Upgrade to Pro
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl p-6 hover:border-violet-300 transition-colors">
                  <h4 className="font-semibold text-slate-900">Enterprise</h4>
                  <p className="text-2xl font-bold text-slate-900 mt-2">$199<span className="text-sm font-normal text-slate-500">/month</span></p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-600">
                    <li>100 generations/month</li>
                    <li>10 concurrent jobs</li>
                    <li>500 locations per site</li>
                    <li>Priority support</li>
                  </ul>
                  <button className="w-full mt-4 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors">
                    Upgrade to Enterprise
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Notification Preferences</h2>
            <p className="text-sm text-slate-500 mt-1">Choose how you want to be notified</p>
          </div>

          <div className="p-6 space-y-4">
            {[
              { label: 'Website generation complete', description: 'Get notified when your website is ready' },
              { label: 'Deployment status', description: 'Updates about deployment success or failures' },
              { label: 'Weekly reports', description: 'Receive weekly performance summaries' },
              { label: 'Product updates', description: 'New features and improvements' },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                <div>
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="text-sm text-slate-500">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Security Settings</h2>
            <p className="text-sm text-slate-500 mt-1">Protect your account</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between py-4 border-b border-slate-100">
              <div>
                <p className="font-medium text-slate-900">Password</p>
                <p className="text-sm text-slate-500">Last changed: Never</p>
              </div>
              <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                Change Password
              </button>
            </div>

            <div className="flex items-center justify-between py-4 border-b border-slate-100">
              <div>
                <p className="font-medium text-slate-900">Two-Factor Authentication</p>
                <p className="text-sm text-slate-500">Add an extra layer of security</p>
              </div>
              <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                Enable 2FA
              </button>
            </div>

            <div className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-red-600">Delete Account</p>
                <p className="text-sm text-slate-500">Permanently delete your account and data</p>
              </div>
              <button className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
