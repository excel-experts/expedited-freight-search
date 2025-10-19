// ====================================
// Supabase Configuration
// ====================================

// IMPORTANT: Replace these with your actual Supabase project credentials
// You can find these in your Supabase project settings under API

export const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Example:
// export const SUPABASE_URL = 'https://xyzcompany.supabase.co';
// export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';

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