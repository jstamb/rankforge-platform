import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Globe, Plus, Activity, AlertCircle, ArrowUpRight, Zap 
} from 'lucide-react';
import { TRAFFIC_DATA } from '../constants';
import { getWebsites, getRecentLogs } from '../services/db';
import { Website, DeploymentLog } from '../types';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const StatCard = ({ title, value, change, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
    <div className="mt-4 flex items-center text-sm">
      <span className="text-emerald-600 flex items-center font-medium">
        <ArrowUpRight size={16} className="mr-1" />
        {change}
      </span>
      <span className="text-slate-400 ml-2">vs last month</span>
    </div>
  </div>
);

export const Dashboard = () => {
  const [websites, setWebsites] = useState<Website[]>([]);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check auth status first
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setIsAuthenticated(!!session);
      });
    }

    const fetchData = async () => {
      const [sitesData, logsData] = await Promise.all([
        getWebsites(),
        getRecentLogs()
      ]);
      setWebsites(sitesData);
      setLogs(logsData);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading dashboard data...</div>;
  }

  // If connected to Supabase but no websites, show welcome state
  const showEmptyState = websites.length === 0 && isAuthenticated;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500">Overview of your generated websites and performance.</p>
        </div>
        <Link 
          to="/websites/new" 
          className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus size={18} className="mr-2" />
          New Website
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Websites" 
          value={websites.length}
          change="+0" 
          icon={Globe} 
          color="bg-indigo-500" 
        />
        <StatCard 
          title="Total Traffic" 
          value={websites.length > 0 ? "24.5k" : "0"} 
          change="+0%" 
          icon={Activity} 
          color="bg-emerald-500" 
        />
        <StatCard 
          title="Avg. SEO Score" 
          value={websites.length > 0 ? "94" : "0"} 
          change="+0%" 
          icon={Zap} 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Server Errors" 
          value="0%" 
          change="0%" 
          icon={AlertCircle} 
          color="bg-rose-500" 
        />
      </div>

      {!isAuthenticated && supabase && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600">
               <AlertCircle size={24} />
             </div>
             <div>
               <h3 className="text-lg font-semibold text-indigo-900">Authentication Required</h3>
               <p className="text-indigo-700">Please sign in to save your business data and websites to the database.</p>
             </div>
          </div>
          <Link to="/login" className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium whitespace-nowrap">
            Sign In
          </Link>
        </div>
      )}

      {showEmptyState ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
           <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
             <Globe className="text-slate-400" size={32} />
           </div>
           <h3 className="text-xl font-bold text-slate-900 mb-2">No websites yet</h3>
           <p className="text-slate-500 max-w-md mx-auto mb-8">
             You haven't generated any websites yet. Start by adding your business information and our AI will do the rest.
           </p>
           <Link 
            to="/websites/new" 
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-indigo-200"
          >
            <Plus size={18} className="mr-2" />
            Create First Website
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Traffic Overview</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TRAFFIC_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f1f5f9'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Recent Activity</h3>
            {logs.length > 0 ? (
              <div className="space-y-6">
                {logs.map((log) => (
                  <div key={log.id} className="flex gap-4">
                    <div className="relative">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        log.status === 'success' ? 'bg-emerald-500' : 
                        log.status === 'deploying' ? 'bg-indigo-500' : 'bg-rose-500'
                      }`} />
                      <div className="absolute top-4 bottom-[-24px] left-1 w-px bg-slate-100 last:hidden" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{log.step}</p>
                      <p className="text-xs text-slate-500 mt-1">{log.message}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {log.started_at ? new Date(log.started_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No recent activity logged.</p>
            )}
            <button className="w-full mt-6 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-colors">
              View All Logs
            </button>
          </div>
        </div>
      )}

      {/* Website List Preview (Only show if we have data) */}
      {!showEmptyState && websites.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900">Active Websites</h3>
            <Link to="/websites" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">View All</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Website</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Template</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Pages</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {websites.map((site) => (
                  <tr key={site.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600">
                          <Globe size={20} />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900">{site.name}</div>
                          <div className="text-sm text-slate-500">{site.domain || 'No domain connected'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${site.status === 'deployed' ? 'bg-emerald-100 text-emerald-800' : 
                          site.status === 'generating' ? 'bg-indigo-100 text-indigo-800' : 
                          'bg-slate-100 text-slate-800'}`}>
                        {site.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">{site.template}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {(site.location_count || 0) + (site.service_count || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-indigo-600 hover:text-indigo-900">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};