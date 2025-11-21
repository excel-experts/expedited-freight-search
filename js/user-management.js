// ====================================
// User Management Module (Admin Only)
// ====================================

import { getSupabase, checkIsAdmin } from './app.js';

let supabase;

// Initialize
init();

async function init() {
    // Wait for app to be ready and get supabase client
    supabase = await getSupabase();

    if (!supabase) {
        alert('Supabase configuration error. Please check your credentials.');
        return;
    }

    // Check authentication and admin status
    checkAuthAndAdmin();

    // Setup event listeners
    const createUserForm = document.getElementById('createUserForm');
    const closeCreateModal = document.getElementById('closeCreateModal');
    const openCreateModalBtn = document.getElementById('openCreateModalBtn');

    if (createUserForm) createUserForm.addEventListener('submit', handleCreateUser);
    if (closeCreateModal) closeCreateModal.addEventListener('click', () => hideModal('createUserModal'));
    if (openCreateModalBtn) openCreateModalBtn.addEventListener('click', () => showModal('createUserModal'));

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            hideModal(e.target.id);
        }
    });
}

async function checkAuthAndAdmin() {
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

    if (!isAdmin) {
        alert('Access denied. Admin privileges required.');
        window.location.href = 'dashboard.html';
        return;
    }

    // Load users
    loadUsers();
}

async function loadUsers() {
    const loadingUsers = document.getElementById('loadingUsers');
    const usersTableBody = document.getElementById('usersTableBody');

    if (loadingUsers) loadingUsers.style.display = 'block';
    if (usersTableBody) usersTableBody.innerHTML = '';

    try {
        // Fetch users from 'user_roles' table as a proxy for users list
        // In a real production app, you would use a secure server-side function to list all users from auth.users

        const { data: profiles, error } = await supabase
            .from('user_roles')
            .select('*');

        if (error) throw error;

        if (profiles && profiles.length > 0) {
            profiles.forEach(profile => {
                const row = document.createElement('tr');
                // Note: We don't have email here unless we join with a profiles table. 
                // For this refactor, we display what we have.
                row.innerHTML = `
                    <td>${profile.user_id}</td>
                    <td><span class="badge badge-${profile.role === 'admin' ? 'primary' : 'secondary'}">${profile.role}</span></td>
                    <td>${new Date(profile.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('${profile.user_id}')">Delete Role</button>
                    </td>
                 `;
                usersTableBody.appendChild(row);
            });
        } else {
            usersTableBody.innerHTML = '<tr><td colspan="4">No users found.</td></tr>';
        }

    } catch (error) {
        console.error('Error loading users:', error);
        showMessage('Error loading users: ' + error.message, 'error');
    } finally {
        if (loadingUsers) loadingUsers.style.display = 'none';
    }
}

async function handleCreateUser(e) {
    e.preventDefault();

    const email = document.getElementById('newUserEmail').value;
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating...';

    try {
        // Client-side user creation simulation
        // Real implementation requires backend function to avoid session hijacking

        alert("Note: Client-side user creation is restricted. In a real app, this would call a backend function.");

        // Simulate success for UI testing
        hideModal('createUserModal');
        showMessage('User creation simulated', 'success');

        // In reality:
        // const { data, error } = await supabase.auth.signUp({ email, password });
        // if (error) throw error;
        // await supabase.from('user_roles').insert({ user_id: data.user.id, role });
        // loadUsers();

    } catch (error) {
        console.error('Error creating user:', error);
        showMessage('Error creating user: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create User';
    }
}

// Make deleteUser available globally
window.deleteUser = async function (userId) {
    if (!confirm('Are you sure you want to delete this user role?')) return;

    try {
        const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

        if (error) throw error;

        showMessage('User role removed successfully', 'success');
        loadUsers();

    } catch (error) {
        console.error('Error deleting user:', error);
        showMessage('Error deleting user: ' + error.message, 'error');
    }
}

function showModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showMessage(message, type) {
    alert(`${type.toUpperCase()}: ${message}`);
}