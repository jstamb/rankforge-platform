import React, { useState, useEffect } from 'react';
import {
  Zap, Plus, Play, Pause, Trash2, Clock, CheckCircle,
  Loader2, AlertCircle, Settings, ExternalLink, RefreshCw
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger_type: 'manual' | 'scheduled' | 'on_deploy' | 'on_content_update';
  is_active: boolean;
  last_executed_at: string | null;
  execution_count: number;
  webhook_url?: string;
}

const triggerLabels = {
  manual: 'Manual Trigger',
  scheduled: 'Scheduled',
  on_deploy: 'On Deploy',
  on_content_update: 'On Content Update',
};

const triggerColors = {
  manual: 'bg-slate-100 text-slate-600',
  scheduled: 'bg-blue-100 text-blue-600',
  on_deploy: 'bg-emerald-100 text-emerald-600',
  on_content_update: 'bg-violet-100 text-violet-600',
};

export const Automations: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    trigger_type: 'manual' as const,
    webhook_url: '',
  });

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    if (!isSupabaseConfigured()) {
      // Mock data
      setWorkflows([
        {
          id: '1',
          name: 'Post-Deployment SEO Ping',
          description: 'Submits sitemap to search engines after successful deployment',
          trigger_type: 'on_deploy',
          is_active: true,
          last_executed_at: '2024-01-15T10:30:00Z',
          execution_count: 12,
        },
        {
          id: '2',
          name: 'Weekly Content Audit',
          description: 'Checks for broken links and outdated content every week',
          trigger_type: 'scheduled',
          is_active: true,
          last_executed_at: '2024-01-14T00:00:00Z',
          execution_count: 8,
        },
        {
          id: '3',
          name: 'Generate Social Posts',
          description: 'Creates social media posts from new blog content',
          trigger_type: 'on_content_update',
          is_active: false,
          last_executed_at: null,
          execution_count: 0,
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

      const { data, error } = await supabase
        .from('automation_workflows')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkflows(data || []);
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (workflow: Workflow) => {
    const updated = { ...workflow, is_active: !workflow.is_active };
    setWorkflows(workflows.map(w => w.id === workflow.id ? updated : w));

    if (isSupabaseConfigured()) {
      await supabase
        .from('automation_workflows')
        .update({ is_active: !workflow.is_active })
        .eq('id', workflow.id);
    }
  };

  const handleRunWorkflow = async (workflow: Workflow) => {
    if (!workflow.webhook_url && !workflow.webhook_url?.startsWith('http')) {
      alert('No webhook URL configured for this workflow');
      return;
    }

    setRunning(workflow.id);
    try {
      // In production, this would call your webhook
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate

      // Update execution count
      const updated = {
        ...workflow,
        last_executed_at: new Date().toISOString(),
        execution_count: workflow.execution_count + 1,
      };
      setWorkflows(workflows.map(w => w.id === workflow.id ? updated : w));

      if (isSupabaseConfigured()) {
        await supabase
          .from('automation_workflows')
          .update({
            last_executed_at: updated.last_executed_at,
            execution_count: updated.execution_count,
          })
          .eq('id', workflow.id);
      }
    } catch (error) {
      console.error('Error running workflow:', error);
    } finally {
      setRunning(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    setWorkflows(workflows.filter(w => w.id !== id));

    if (isSupabaseConfigured()) {
      await supabase
        .from('automation_workflows')
        .delete()
        .eq('id', id);
    }
  };

  const handleCreateWorkflow = async () => {
    if (!newWorkflow.name.trim()) return;

    const workflow: Workflow = {
      id: crypto.randomUUID(),
      ...newWorkflow,
      is_active: true,
      last_executed_at: null,
      execution_count: 0,
    };

    setWorkflows([workflow, ...workflows]);

    if (isSupabaseConfigured()) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('automation_workflows').insert({
          user_id: user.id,
          name: workflow.name,
          description: workflow.description,
          trigger_type: workflow.trigger_type,
          webhook_url: workflow.webhook_url,
          is_active: true,
        });
      }
    }

    setShowCreateModal(false);
    setNewWorkflow({ name: '', description: '', trigger_type: 'manual', webhook_url: '' });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
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
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automations</h1>
          <p className="text-slate-500 mt-1">Automate SEO tasks with custom workflows</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus size={18} />
          New Workflow
        </button>
      </div>

      {/* Webhook Integration Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
              <Zap size={20} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Webhook Automations</h3>
              <p className="text-sm text-slate-500">
                Connect to any webhook-compatible automation platform (Zapier, Make, etc.)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {workflows.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No workflows yet</h3>
          <p className="text-slate-500 mt-2 mb-6">Create automation workflows to handle repetitive SEO tasks.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus size={18} />
            Create Workflow
          </button>
        </div>
      )}

      {/* Workflows List */}
      {workflows.length > 0 && (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className={`bg-white rounded-xl border p-6 transition-colors ${
                workflow.is_active ? 'border-slate-200 hover:border-slate-300' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  workflow.is_active ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-400'
                }`}>
                  <Zap size={20} />
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className={`font-semibold ${workflow.is_active ? 'text-slate-900' : 'text-slate-500'}`}>
                      {workflow.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${triggerColors[workflow.trigger_type]}`}>
                      {triggerLabels[workflow.trigger_type]}
                    </span>
                    {!workflow.is_active && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full text-xs font-medium">
                        Paused
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{workflow.description}</p>

                  <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Last run: {formatDate(workflow.last_executed_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle size={12} />
                      {workflow.execution_count} executions
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {workflow.trigger_type === 'manual' && (
                    <button
                      onClick={() => handleRunWorkflow(workflow)}
                      disabled={running === workflow.id || !workflow.is_active}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 disabled:bg-slate-100 text-emerald-700 disabled:text-slate-400 rounded-lg text-sm font-medium transition-colors"
                    >
                      {running === workflow.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      Run
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleActive(workflow)}
                    className={`p-2 rounded-lg transition-colors ${
                      workflow.is_active
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title={workflow.is_active ? 'Pause' : 'Activate'}
                  >
                    {workflow.is_active ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    onClick={() => handleDelete(workflow.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workflow Templates */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Workflow Templates</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              name: 'Post-Deployment SEO',
              description: 'Submit sitemap to Google and Bing after deployment',
              trigger: 'on_deploy',
            },
            {
              name: 'Weekly Link Check',
              description: 'Scan all pages for broken links every week',
              trigger: 'scheduled',
            },
            {
              name: 'Content Refresh Alert',
              description: 'Notify when content is older than 6 months',
              trigger: 'scheduled',
            },
            {
              name: 'Schema Validator',
              description: 'Validate JSON-LD schema on content updates',
              trigger: 'on_content_update',
            },
          ].map((template, index) => (
            <button
              key={index}
              onClick={() => {
                setNewWorkflow({
                  name: template.name,
                  description: template.description,
                  trigger_type: template.trigger as any,
                  webhook_url: '',
                });
                setShowCreateModal(true);
              }}
              className="text-left p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
            >
              <h4 className="font-medium text-slate-900">{template.name}</h4>
              <p className="text-sm text-slate-500 mt-1">{template.description}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${triggerColors[template.trigger as keyof typeof triggerColors]}`}>
                {triggerLabels[template.trigger as keyof typeof triggerLabels]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Workflow</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newWorkflow.name}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  placeholder="My Workflow"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={newWorkflow.description}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  placeholder="What does this workflow do?"
                  rows={2}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trigger Type</label>
                <select
                  value={newWorkflow.trigger_type}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, trigger_type: e.target.value as any })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="manual">Manual Trigger</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="on_deploy">On Deploy</option>
                  <option value="on_content_update">On Content Update</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={newWorkflow.webhook_url}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, webhook_url: e.target.value })}
                  placeholder="https://hooks.zapier.com/... or any webhook URL"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Get this from your automation platform (Zapier, Make, etc.)</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                disabled={!newWorkflow.name.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
