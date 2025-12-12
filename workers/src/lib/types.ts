// Job types for the generation pipeline
export type JobType =
  | 'seo_research'
  | 'content_architecture'
  | 'content_generation'
  | 'design_generation'
  | 'site_build'
  | 'deployment'
  | 'cloud_run_deploy'
  | 'full_generation' // Legacy - runs all steps
  | 'website_edit'; // Chat-initiated edits (add pages, update content, etc.)

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GenerationJob {
  id: string;
  user_id: string;
  website_id: string;
  job_type: JobType;
  priority: number;
  status: JobStatus;
  queue_position: number;

  created_at: string;
  started_at?: string;
  completed_at?: string;

  current_step?: string;
  total_steps: number;
  completed_steps: number;
  progress_percent: number;

  // Recovery tracking
  retry_count?: number;
  heartbeat_at?: string;

  // Horizontal scaling - which worker is processing this job
  worker_id?: string;

  input_payload: JobInputPayload;
  output_result?: JobOutputResult;
  error_details?: {
    message: string;
    step?: string;
    stack?: string;
    retry_count?: number;
    last_failure?: string;
  };
}

export interface JobInputPayload {
  business: BusinessInput;
  options: {
    useAI: boolean;
    deployToGithub: boolean;
    deployToCloudRun: boolean;
    configureDNS: boolean;
    domain?: string;
  };
}

export interface BusinessInput {
  businessName: string;
  businessType: string;
  niche?: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  description: string;
  services: string[];
  targetKeywords: string[];
  targetCities?: Array<{ name: string; state: string }>;
  yearsInBusiness?: number;
  webhookUrl?: string;
}

export interface JobOutputResult {
  repoUrl?: string;
  deploymentUrl?: string;
  filesGenerated?: number;
  pagesGenerated?: number;
  seoResearchId?: string;
  designSystemId?: string;
}

// SEO Research types
export interface SEOResearch {
  id: string;
  website_id: string;
  keywords: {
    primary: string[];
    secondary: string[];
    longtail: string[];
  };
  competitors: Array<{
    url: string;
    strengths: string[];
    weaknesses: string[];
    topKeywords: string[];
  }>;
  searchIntent: {
    informational: string[];
    transactional: string[];
    navigational: string[];
  };
  contentGaps: string[];
  created_at: string;
}

// Content Index types
export interface ContentIndexEntry {
  id: string;
  website_id: string;
  page_slug: string;
  page_type: 'home' | 'location' | 'service' | 'blog' | 'hub' | 'about' | 'contact';
  title: string;
  target_keywords: string[];
  internal_links_to: string[];
  internal_links_from: string[];
  content_status: 'planned' | 'generating' | 'complete';
  created_at: string;
}

// Page Content types
export interface PageContent {
  id: string;
  website_id: string;
  content_index_id: string;
  html_content: string;
  meta_title: string;
  meta_description: string;
  schema_markup: Record<string, unknown>;
  word_count: number;
  created_at: string;
}

// Design System types
export interface DesignSystem {
  id: string;
  website_id: string;
  tailwind_config: {
    colors: Record<string, string>;
    fontFamily: Record<string, string[]>;
    spacing?: Record<string, string>;
  };
  color_palette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    scale: number[];
  };
  component_library: {
    hero: ComponentVariation[];
    cta: ComponentVariation[];
    testimonials: ComponentVariation[];
    features: ComponentVariation[];
    footer: ComponentVariation[];
  };
  created_at: string;
}

export interface ComponentVariation {
  name: string;
  description: string;
  jsx: string;
  props: Record<string, unknown>;
}

// Website types
export interface Website {
  id: string;
  business_id: string;
  user_id: string;
  name: string;
  slug: string;
  domain?: string;
  status: 'draft' | 'generating' | 'deployed' | 'error';
  template: string;
  github_repo_url?: string;
  cloud_run_service_url?: string;
  last_deployed_at?: string;
  created_at: string;
}
