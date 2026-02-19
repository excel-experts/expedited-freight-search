import { APP_VERSION, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let supabase = null;
let isReady = false;
let readyResolve = null;

// Export a promise that resolves when the app is fully initialized
export const ready = new Promise((resolve) => {
    readyResolve = resolve;
});

// Auto-initialize when imported
(async function init() {
    try {
        // 1. Load Supabase
        await loadSupabase();

        // 2. Initialize Client
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 3. Render Navigation
        initNav();

        // 4. Check Authentication
        await checkAuth();

        // 5. Mark as ready
        isReady = true;
        if (readyResolve) readyResolve(supabase);

    } catch (error) {
        console.error('App initialization failed:', error);
    }
})();

// Helper to load Supabase CDN
function loadSupabase() {
    return new Promise((resolve, reject) => {
        if (window.supabase) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Supabase SDK'));
        document.head.appendChild(script);
    });
}

// Export getter for other modules
export async function getSupabase() {
    if (isReady && supabase) return supabase;
    await ready;
    return supabase;
}

function initNav() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;

    const currentPath = window.location.pathname;

    nav.innerHTML = `
        <div class="nav-content">
            <div class="nav-brand">
                <h2>🚚 Expedited Freight <span style="font-size: 0.8em; opacity: 0.8;">${APP_VERSION}</span></h2>
            </div>
            <div class="nav-menu">
                <a href="dashboard.html" class="nav-link ${currentPath.includes('dashboard.html') ? 'active' : ''}">Search Orders</a>
                <a href="reports.html" class="nav-link ${currentPath.includes('reports.html') ? 'active' : ''}">Reports</a>
                <!--<a href="admin-users.html" class="nav-link" id="userMgmtLink" style="display: none;">User Management</a>-->
                <a href="admin-data.html" class="nav-link ${currentPath.includes('admin-data.html') ? 'active' : ''}" id="dataMgmtLink" style="display: none;">Data Management</a>
                <span class="nav-user" id="userEmail"></span>
                <button class="btn btn-secondary btn-sm" id="logoutBtn">Logout</button>
            </div>
        </div>
    `;

    // Attach Logout Listener
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    // Display user email
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
        userEmailElement.textContent = session.user.email;
    }

    // Check admin status
    const isAdmin = await checkIsAdmin(session.user.id);
    const userMgmtLink = document.getElementById('userMgmtLink');
    const dataMgmtLink = document.getElementById('dataMgmtLink');

    if (isAdmin) {
        if (userMgmtLink) userMgmtLink.style.display = 'inline-block';
        if (dataMgmtLink) dataMgmtLink.style.display = 'inline-block';
    } else {
        // If on an admin page and not admin, redirect
        if (window.location.pathname.includes('admin-')) {
            alert('Access denied. Admin privileges required.');
            window.location.href = 'dashboard.html';
        }
    }
}

async function handleLogout() {
    try {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

export async function checkIsAdmin(userId) {
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
