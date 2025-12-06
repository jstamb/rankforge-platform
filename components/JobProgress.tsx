import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Loader2, CheckCircle, XCircle, Clock, Zap, Globe, Github, Cloud, Shield 
} from 'lucide-react';
import { GenerationJob } from '../types';

interface JobProgressProps {
  jobId: string;
  onComplete?: (result: any) => void;
}

const stepIcons: Record<string, any> = {
  'Generating homepage': Globe,
  'Generating location': Globe,
  'Generating service': Globe,
  'Building website': Zap,
  'Pushing to GitHub': Github,
  'Deploying to Cloud': Cloud,
  'Configuring DNS': Shield,
};

export const JobProgress: React.FC<JobProgressProps> = ({ jobId, onComplete }) => {
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  
  useEffect(() => {
    if (!supabase) return;

    const fetchJob = async () => {
      const { data, error } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (error) {
        console.error("Error fetching job:", error);
        return;
      }
      
      setJob(data as GenerationJob);
      
      if (data?.status === 'completed' && onComplete) {
        onComplete(data.output_result);
      }
    };
    
    fetchJob();
    
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'generation_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          const updatedJob = payload.new as GenerationJob;
          setJob(updatedJob);
          
          if (updatedJob.status === 'completed' && onComplete) {
            onComplete(updatedJob.output_result);
          }
        }
      )
      .subscribe((status) => {
        setIsSubscribed(status === 'SUBSCRIBED');
      });
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, onComplete]);
  
  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-500">Initializing generation...</p>
      </div>
    );
  }
  
  // Determine icon based on step text match
  let StepIcon = Zap;
  if (job.current_step) {
      const foundKey = Object.keys(stepIcons).find(key => job.current_step?.includes(key));
      if (foundKey) StepIcon = stepIcons[foundKey];
  }

  // Calculate relative time
  const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'soon';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    return `in ${diffInMinutes} min`;
  };
  
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-lg max-w-2xl mx-auto">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={job.status} />
          <span className="text-sm text-slate-500">
            {job.status === 'queued' && `Position #${job.queue_position} in queue`}
            {job.status === 'processing' && 'Building your website...'}
            {job.status === 'completed' && 'Website deployed!'}
            {job.status === 'failed' && 'Generation failed'}
          </span>
        </div>
        
        {isSubscribed && job.status !== 'completed' && job.status !== 'failed' && (
          <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Updates
          </div>
        )}
      </div>
      
      {/* Progress Bar */}
      {['processing', 'queued', 'pending'].includes(job.status) && (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 font-medium">Progress</span>
              <span className="font-bold text-indigo-600">
                {job.progress_percent}%
              </span>
            </div>
            
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-indigo-600 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${job.progress_percent}%` }}
                />
            </div>
          </div>
          
          {/* Current Step */}
          <div className="flex items-center gap-4 rounded-lg bg-indigo-50 p-4 border border-indigo-100 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm text-indigo-600">
              <StepIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {job.current_step || 'Initializing...'}
              </p>
              <p className="text-sm text-slate-500">
                Step {job.completed_steps} of {job.total_steps}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Queue Position */}
      {job.status === 'queued' && (
        <div className="mt-4 flex items-center gap-4 rounded-lg bg-amber-50 p-4 border border-amber-100 text-amber-800">
          <Clock className="h-6 w-6" />
          <div>
            <p className="font-medium">
              Waiting in queue
            </p>
            <p className="text-sm opacity-80">
              Estimated start: {formatRelativeTime(job.estimated_completion_at)}
            </p>
          </div>
        </div>
      )}
      
      {/* Completed Result */}
      {job.status === 'completed' && job.output_result && (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-4 rounded-lg bg-emerald-50 p-4 border border-emerald-100 text-emerald-900">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="font-bold text-lg">
                Success!
              </p>
              <p className="text-sm opacity-90">
                Generated {job.output_result.pagesGenerated?.locations} location pages and {job.output_result.pagesGenerated?.services} service pages.
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <a
              href={job.output_result.deploymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all"
            >
              <Globe className="h-4 w-4" />
              View Live Site
            </a>
            <a
              href={job.output_result.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Github className="h-4 w-4" />
              View Code
            </a>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {job.status === 'failed' && (
        <div className="mt-4 rounded-lg bg-rose-50 p-4 border border-rose-100 text-rose-900">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-rose-600" />
            <div>
              <p className="font-bold">
                Generation failed
              </p>
              <p className="text-sm mt-1">
                {job.error_details?.message || 'An unexpected error occurred'}
              </p>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full rounded-lg bg-white border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            Retry Generation
          </button>
        </div>
      )}
    </div>
  );
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string, text: string, label: string }> = {
    pending: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Pending' },
    queued: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Queued' },
    processing: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Processing' },
    completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' },
    failed: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Failed' },
    cancelled: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Cancelled' },
  };

  const current = config[status] || { bg: 'bg-slate-100', text: 'text-slate-700', label: status };
  
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${current.bg} ${current.text}`}>
      {status === 'processing' && (
        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
      )}
      {current.label}
    </span>
  );
}