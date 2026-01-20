// ====================================
// Supabase Configuration
// ====================================

export const APP_VERSION = 'v0.1.16';

// IMPORTANT: Replace these with your actual Supabase project credentials
// You can find these in your Supabase project settings under API

export const SUPABASE_URL = 'https://smknynynusefpxplmbkz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNta255bnludXNlZnB4cGxtYmt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4ODg4ODQsImV4cCI6MjA3NjQ2NDg4NH0.S_nn5ssv4HVDumAPM8c07kHEFgBg44WYg-6jDBO7cCk';

// Initialize Supabase client
// This will be imported by other modules
export function createClient() {
    if (SUPABASE_URL === 'YOUR_SUPABASE_PROJECT_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
        console.error('Please configure your Supabase credentials in js/config.js');
        return null;
    }

    // Import Supabase from CDN
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
