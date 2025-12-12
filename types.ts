export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  subscription_tier: SubscriptionTier;
  avatar_url?: string;
  created_at?: string;
}

export interface Business {
  id: string;
  user_id?: string;
  business_name: string;
  business_type: string;
  phone: string;
  email: string;
  address_street: string;
  address_city: string;
  address_state?: string;
  address_zip?: string;
  description: string;
  services: string[]; // JSONB in DB
  target_keywords: string[]; // JSONB in DB
  target_cities?: Array<{ name: string; state: string; county?: string }>; // JSONB in DB
  created_at?: string;
}

export type WebsiteStatus = 'draft' | 'generating' | 'deployed' | 'error';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Website {
  id: string;
  business_id: string;
  user_id?: string;
  name: string;
  slug: string;
  domain?: string;
  status: WebsiteStatus;
  template: string;

  // Deployment info
  github_repo_url?: string;
  cloud_run_service_url?: string;

  // AI Chat history (last 10 messages)
  chat_history?: ChatMessage[];

  // Stats/Metadata (Joined or Computed)
  location_count?: number; // often a computed field
  service_count?: number;  // often a computed field
  last_deployed_at?: string;
  created_at?: string;
}

export interface LocationPage {
  id: string;
  website_id: string;
  city: string;
  state: string;
  neighborhood?: string;
  page_slug: string;
  title_tag: string;
  meta_description: string;
  h1_heading: string;
  status: 'draft' | 'generated' | 'published';
}

export interface ServicePage {
  id: string;
  website_id: string;
  service_name: string;
  page_slug: string;
  title_tag: string;
  meta_description: string;
  status: 'draft' | 'generated' | 'published';
}

export interface DeploymentLog {
  id: string;
  website_id?: string;
  status: 'started' | 'building' | 'deploying' | 'success' | 'failed';
  step: string;
  started_at: string;
  message: string;
  duration_seconds?: number;
}

export interface SeoConfig {
  title_tag: string;
  meta_description: string;
  h1_heading: string;
  keywords: string[];
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

// --- Queue & Job Types ---

export type JobStatusType = 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  user_id: string;
  website_id: string;
  job_type: string;
  priority: number;
  status: JobStatusType;
  queue_position: number;
  
  created_at: string;
  queued_at?: string;
  started_at?: string;
  completed_at?: string;
  estimated_completion_at?: string;
  
  current_step?: string;
  total_steps: number;
  completed_steps: number;
  progress_percent: number;
  
  output_result?: {
    deploymentUrl?: string;
    repoUrl?: string;
    pagesGenerated?: {
      locations: number;
      services: number;
    };
  };
  error_details?: {
    message: string;
    attempt?: number;
  };
}

export interface UserQuota {
  user_id: string;
  plan_type: SubscriptionTier;
  monthly_generations_limit: number;
  monthly_generations_used: number;
  max_concurrent_jobs: number;
  current_concurrent_jobs: number;
}

// Database helper types for Supabase
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: UserProfile;
        Insert: UserProfile;
        Update: Partial<UserProfile>;
      };
      businesses: {
        Row: Business;
        Insert: Omit<Business, 'id' | 'created_at'>;
        Update: Partial<Business>;
      };
      websites: {
        Row: Website;
        Insert: Omit<Website, 'id' | 'created_at'>;
        Update: Partial<Website>;
      };
      location_pages: {
        Row: LocationPage;
        Insert: Omit<LocationPage, 'id'>;
        Update: Partial<LocationPage>;
      };
      deployment_logs: {
        Row: DeploymentLog;
        Insert: Omit<DeploymentLog, 'id' | 'started_at'>;
        Update: Partial<DeploymentLog>;
      };
      generation_jobs: {
        Row: GenerationJob;
        Insert: Omit<GenerationJob, 'id' | 'created_at' | 'status' | 'queue_position' | 'completed_steps' | 'progress_percent'>;
        Update: Partial<GenerationJob>;
      };
      user_quotas: {
        Row: UserQuota;
        Insert: Partial<UserQuota>;
        Update: Partial<UserQuota>;
      };
    };
  };
}