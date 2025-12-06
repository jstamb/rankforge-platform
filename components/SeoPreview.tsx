import React, { useState } from 'react';
import { Monitor, Smartphone, Search, CheckCircle, AlertTriangle } from 'lucide-react';
import { SeoConfig } from '../types';

interface SeoPreviewProps {
  config: SeoConfig;
  url: string;
}

const CharacterCount = ({ label, current, min, max }: { label: string; current: number; min: number; max: number }) => {
  const status = current >= min && current <= max ? 'optimal' : 'warning';
  const percentage = Math.min((current / max) * 100, 100);
  
  return (
    <div className="rounded-lg border border-slate-200 p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className={`text-sm font-mono ${status === 'optimal' ? 'text-emerald-600' : 'text-amber-600'}`}>
          {current}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-300 ${status === 'optimal' ? 'bg-emerald-500' : 'bg-amber-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-500 flex items-center gap-1">
        {status === 'optimal' ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
        {status === 'optimal' ? 'Perfect length' : 'Adjust length for better visibility'}
      </p>
    </div>
  );
};

export const SeoPreview: React.FC<SeoPreviewProps> = ({ config, url }) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Search Preview</h3>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 border border-slate-200">
          <button
            onClick={() => setDevice('desktop')}
            className={`p-2 rounded-md transition-all ${device === 'desktop' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Monitor size={16} />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={`p-2 rounded-md transition-all ${device === 'mobile' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <Smartphone size={16} />
          </button>
        </div>
      </div>

      <div className={`rounded-xl border border-slate-200 bg-white p-6 transition-all duration-300 ${device === 'mobile' ? 'max-w-sm mx-auto' : ''}`}>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
            <Search size={12} />
          </div>
          <span className="font-medium">Google Search</span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-slate-700">
            <span>{url}</span>
            <span className="text-slate-400">›</span>
            <span>home</span>
          </div>
          <h4 className="text-xl text-[#1a0dab] hover:underline cursor-pointer font-normal leading-tight">
            {config.title_tag || "Your Page Title Here"}
          </h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            {config.meta_description || "Your page description will appear here in the search results. Make it catchy!"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CharacterCount 
          label="Title Tag" 
          current={config.title_tag?.length || 0} 
          min={50} 
          max={60} 
        />
        <CharacterCount 
          label="Meta Description" 
          current={config.meta_description?.length || 0} 
          min={150} 
          max={160} 
        />
      </div>
    </div>
  );
};
