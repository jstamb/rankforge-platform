import { supabase } from '../lib/supabase';
import { Business, Website, DeploymentLog } from '../types';
import { MOCK_BUSINESSES, MOCK_WEBSITES, RECENT_LOGS } from '../constants';

// Business Operations
export const getBusinesses = async (): Promise<Business[]> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching businesses:', error.message, error.details);
      return [];
    }
    return data || [];
  }
  return MOCK_BUSINESSES;
};

export const createBusiness = async (business: Omit<Business, 'id'>): Promise<Business | null> => {
  if (supabase) {
    // Get current user for RLS
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error("User must be logged in to create business");
      throw new Error("You must be logged in to create a business.");
    }

    const { data, error } = await supabase
      .from('businesses')
      .insert([{ ...business, user_id: user.id }])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      throw error;
    }
    return data;
  }
  
  // Mock fallback
  const newBusiness: Business = {
    ...business,
    id: `b${Date.now()}`,
    created_at: new Date().toISOString()
  };
  MOCK_BUSINESSES.push(newBusiness);
  return newBusiness;
};

// Website Operations
export const getWebsites = async (): Promise<Website[]> => {
  if (supabase) {
    const { data, error } = await supabase
      .from('websites')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching websites:', error.message, error.details);
      return [];
    }
    return data || [];
  }
  return MOCK_WEBSITES;
};

export const createWebsite = async (website: Omit<Website, 'id'>): Promise<Website | null> => {
  if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error("You must be logged in to create a website.");
    }

    const { data, error } = await supabase
      .from('websites')
      .insert([{ ...website, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
  return null;
};

// Logs
export const getRecentLogs = async (): Promise<DeploymentLog[]> => {
  if (supabase) {
    // The table uses started_at, not created_at
    const { data, error } = await supabase
      .from('deployment_logs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);
      
    if (error) {
      console.error('Error fetching logs:', error.message, error.details);
      return [];
    }
    return data || [];
  }
  return RECENT_LOGS;
};