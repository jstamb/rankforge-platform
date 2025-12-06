import { supabase } from '../lib/supabase';

export const signIn = async (email: string) => {
  if (!supabase) throw new Error("Supabase not configured");
  // For demo purposes, we'll use Magic Link as it's often the default, 
  // or standard email/password if the user has set it up.
  // Since we don't know the exact auth config, let's assume Email/OTP or Magic Link
  // But standard email/password is safest for a generic login form
  return supabase.auth.signInWithOtp({ email });
};

export const signInWithPassword = async (email: string, password: string) => {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase.auth.signInWithPassword({ email, password });
};

export const signUp = async (email: string, password: string) => {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase.auth.signUp({ email, password });
};

export const signOut = async () => {
    if (!supabase) return;
    return supabase.auth.signOut();
};

export const getCurrentUser = async () => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};