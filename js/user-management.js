// ====================================
// User Management Module (Admin Only)
// ====================================

import { createClient } from './config.js';
import { checkIsAdmin } from './auth.js';

let supabase;
let currentUserId;

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
        alert('Supabase configuration error. Please check your credentials.');
        return;
    }

    // Check authentication and admin status
    checkAuthAndAdmin();

    // Setup event listeners
    const addUserForm = document.getElementById('addUserForm');
    const editUserForm = document.getElementById('editUserForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeModal = document.getElementById('closeModal');

    if (addUserForm) addUserForm.addEventListener('submit', handleAddUser);
    if (editUserForm) editUserForm.addEventListener('submit', handleEditUser);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (closeModal) closeModal.addEventListener('click', () => hideModal());

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('editUserModal');
        if (e.target === modal) hideModal();
    });
}

async function checkAuthAndAdmin() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    currentUserId = session.user.id;

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
    await loadUsers();
}

async function loadUsers() {
    document.getElementById('loadingUsers').style.display = 'block';
    document.getElementById('usersTableContainer').style.display = 'none';
    document.getElementById('noUsers').style.display = 'none';

    try {
        // Get all users with their roles
        const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

        if (usersError) throw usersError;

        // Get user roles
        const { data: roles, error: rolesError } = await supabase
            .from('user_roles')
            .select('*');

        if (rolesError && rolesError.code !== 'PGRST116') {
            console.error('Error loading roles:', rolesError);
        }

        // Combine users with roles
        const usersWithRoles = (users || []).map(user => {
            const roleData = (roles || []).find(r => r.user_id === user.id);
            return {
                ...user,
                role: roleData ? roleData.role : 'user'
            };
        });

        if (usersWithRoles.length === 0) {
            document.getElementById('loadingUsers').style.display = 'none';
            document.getElementById('noUsers').style.display = 'block';
            return;
        }

        displayUsers(usersWithRoles);

    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('loadingUsers').style.display = 'none';
        showMessage('addUserMessage', 'Error loading users: ' + error.message, 'error');
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';

    users.forEach(user => {
        const row = document.createElement('tr');
        const createdDate = new Date(user.created_at).toLocaleDateString();
        const roleDisplay = user.role === 'admin' ? '👑 Admin' : '👤 User';

        row.innerHTML = `
            <td>${user.email}</td>
            <td>${roleDisplay}</td>
            <td>${createdDate}</td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="window.editUser('${user.id}', '${user.email}', '${user.role}')">
                    Edit Role
                </button>
                <button class="btn btn-danger btn-sm" onclick="window.deleteUser('${user.id}', '${user.email}')">
                    Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('loadingUsers').style.display = 'none';
    document.getElementById('usersTableContainer').style.display = 'block';
}

async function handleAddUser(e) {
    e.preventDefault();

    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding...';

    try {
        // Create user using Supabase Auth Admin API
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });

        if (createError) throw createError;

        // Add role to user_roles table
        const { error: roleError } = await supabase
            .from('user_roles')
            .insert([
                { user_id: newUser.user.id, role: role }
            ]);

        if (roleError) throw roleError;

        showMessage('addUserMessage', 'User added successfully!', 'success');
        document.getElementById('addUserForm').reset();

        // Reload users
        await loadUsers();

    } catch (error) {
        console.error('Error adding user:', error);
        showMessage('addUserMessage', 'Error adding user: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add User';
    }
}

// Global functions for inline onclick handlers
window.editUser = function(userId, email, role) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUserEmail').value = email;
    document.getElementById('editUserRole').value = role;
    showModal();
};

window.deleteUser = async function(userId, email) {
    if (userId === currentUserId) {
        alert('You cannot delete your own account!');
        return;
    }

    if (!confirm(`Are you sure you want to delete user ${email}?`)) {
        return;
    }

    try {
        // Delete from user_roles first
        await supabase.from('user_roles').delete().eq('user_id', userId);

        // Delete user
        const { error } = await supabase.auth.admin.deleteUser(userId);

        if (error) throw error;

        alert('User deleted successfully!');
        await loadUsers();

    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user: ' + error.message);
    }
};

async function handleEditUser(e) {
    e.preventDefault();

    const userId = document.getElementById('editUserId').value;
    const role = document.getElementById('editUserRole').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        // Check if role entry exists
        const { data: existingRole } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (existingRole) {
            // Update existing role
            const { error } = await supabase
                .from('user_roles')
                .update({ role: role })
                .eq('user_id', userId);

            if (error) throw error;
        } else {
            // Insert new role
            const { error } = await supabase
                .from('user_roles')
                .insert([{ user_id: userId, role: role }]);

            if (error) throw error;
        }

        hideModal();
        alert('User role updated successfully!');
        await loadUsers();

    } catch (error) {
        console.error('Error updating role:', error);
        alert('Error updating role: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Changes';
    }
}

function showModal() {
    document.getElementById('editUserModal').style.display = 'flex';
}

function hideModal() {
    document.getElementById('editUserModal').style.display = 'none';
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}