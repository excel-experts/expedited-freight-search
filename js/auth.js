// ====================================
// Authentication Module
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

    // Handle logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Check if user has active session
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session) {
        // User is logged in
        const currentPage = window.location.pathname;

        if (currentPage.includes('index.html') || currentPage.endsWith('/')) {
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            // Load user info on other pages
            await loadUserInfo(session.user);
        }
    } else {
        // User is not logged in
        const currentPage = window.location.pathname;

        if (!currentPage.includes('index.html') && !currentPage.endsWith('/')) {
            // Redirect to login
            window.location.href = 'index.html';
        }
    }
}

// Handle login form submission
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;

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

// Handle logout
async function handleLogout() {
    try {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

// Load user info and check admin status
async function loadUserInfo(user) {
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = user.email;
    }

    // Check if user is admin
    const isAdmin = await checkIsAdmin(user.id);

    // Show/hide admin links
    const userMgmtLink = document.getElementById('userMgmtLink');
    const dataMgmtLink = document.getElementById('dataMgmtLink');

    if (isAdmin) {
        if (userMgmtLink) userMgmtLink.style.display = 'inline-block';
        if (dataMgmtLink) dataMgmtLink.style.display = 'inline-block';
    } else {
        // Check if current page is admin page
        const currentPage = window.location.pathname;
        if (currentPage.includes('admin-')) {
            alert('Access denied. Admin privileges required.');
            window.location.href = 'dashboard.html';
        }
    }
}

// Check if user is admin
async function checkIsAdmin(userId) {
    try {
        const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error checking admin status:', error);
            return false;
        }

        return data && data.role === 'admin';
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
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

// Export functions for use in other modules
export { supabase, checkIsAdmin };
