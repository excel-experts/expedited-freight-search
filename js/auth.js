// ====================================
// Authentication Module (Login Only)
// ====================================

import { createClient } from './config.js';

// Initialize Supabase client
let supabase;

// Load Supabase from CDN
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
script.onload = () => {
    supabase = createClient();
    init();
};
document.head.appendChild(script);

function init() {
    if (!supabase) {
        showError('Supabase configuration error. Please check your credentials.');
        return;
    }

    // Check if already logged in
    checkSession();

    // Handle login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

// Check if user has active session
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // User is logged in, redirect to dashboard
        window.location.href = 'dashboard.html';
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const loginBtn = document.getElementById('loginBtn');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');

    // Show loading state
    loginBtn.disabled = true;
    loadingMessage.style.display = 'block';
    errorMessage.style.display = 'none';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        // Login successful
        window.location.href = 'dashboard.html';

    } catch (error) {
        showError(error.message);
        loginBtn.disabled = false;
        loadingMessage.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    } else {
        alert(message);
    }
}
