// ====================================
// Search Module
// ====================================

import { createClient } from './config.js';
import { checkIsAdmin } from './auth.js';

let supabase;
let allResults = [];
let currentPage = 1;
const recordsPerPage = 50;

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

    // Check authentication
    checkAuth();

    // Setup event listeners
    const searchForm = document.getElementById('searchForm');
    const clearBtn = document.getElementById('clearBtn');
    const exportBtn = document.getElementById('exportBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (searchForm) searchForm.addEventListener('submit', handleSearch);
    if (clearBtn) clearBtn.addEventListener('click', handleClear);
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (prevBtn) prevBtn.addEventListener('click', () => changePage(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(1));

    // Setup table sorting
    setupTableSorting();
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
    }
}

async function handleSearch(e) {
    e.preventDefault();

    const originCity = document.getElementById('originCity').value.trim();
    const destinationCity = document.getElementById('destinationCity').value.trim();
    const carrier = document.getElementById('carrier').value.trim();

    // At least one field must be filled
    if (!originCity && !destinationCity && !carrier) {
        alert('Please enter at least one search criteria');
        return;
    }

    // Show loading
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingResults').style.display = 'block';

    try {
        // Build query
        let query = supabase.from('historical_orders').select('*');

        if (originCity) {
            query = query.ilike('origin_city', `%${originCity}%`);
        }
        if (destinationCity) {
            query = query.ilike('destination_city', `%${destinationCity}%`);
        }
        if (carrier) {
            query = query.ilike('carrier', `%${carrier}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        allResults = data || [];
        currentPage = 1;

        if (allResults.length === 0) {
            document.getElementById('loadingResults').style.display = 'none';
            document.getElementById('noResults').style.display = 'block';
        } else {
            displayResults();
        }

    } catch (error) {
        console.error('Search error:', error);
        alert('Error searching orders: ' + error.message);
        document.getElementById('loadingResults').style.display = 'none';
    }
}

function displayResults() {
    // Calculate metrics
    const totalRecords = allResults.length;
    const totalPrice = allResults.reduce((sum, order) => sum + (parseFloat(order.price) || 0), 0);
    const totalDistance = allResults.reduce((sum, order) => sum + (parseFloat(order.distance) || 0), 0);
    const avgPrice = totalRecords > 0 ? totalPrice / totalRecords : 0;
    const avgDistance = totalRecords > 0 ? totalDistance / totalRecords : 0;
    const avgPricePerMile = avgDistance > 0 ? avgPrice / avgDistance : 0;

    // Update metrics
    document.getElementById('totalRecords').textContent = totalRecords.toLocaleString();
    document.getElementById('avgPrice').textContent = '$' + avgPrice.toFixed(2);
    document.getElementById('avgDistance').textContent = avgDistance.toFixed(2) + ' mi';
    document.getElementById('avgPricePerMile').textContent = '$' + avgPricePerMile.toFixed(2);

    // Display table
    displayTablePage();

    // Show results section
    document.getElementById('loadingResults').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';
}

function displayTablePage() {
    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const pageResults = allResults.slice(startIndex, endIndex);

    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    pageResults.forEach(order => {
        const row = document.createElement('tr');
        const pricePerMile = order.distance > 0 ? (order.price / order.distance).toFixed(2) : '0.00';
        const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A';

        row.innerHTML = `
            <td>${order.order_id || 'N/A'}</td>
            <td>${order.origin_city || 'N/A'}</td>
            <td>${order.destination_city || 'N/A'}</td>
            <td>${order.carrier || 'N/A'}</td>
            <td>$${parseFloat(order.price || 0).toFixed(2)}</td>
            <td>${parseFloat(order.distance || 0).toFixed(2)}</td>
            <td>$${pricePerMile}</td>
            <td>${orderDate}</td>
        `;
        tbody.appendChild(row);
    });

    // Update pagination
    const totalPages = Math.ceil(allResults.length / recordsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

function changePage(direction) {
    currentPage += direction;
    displayTablePage();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setupTableSorting() {
    const headers = document.querySelectorAll('.sortable');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.dataset.column;
            sortResults(column);
        });
    });
}

let sortDirection = {};

function sortResults(column) {
    const direction = sortDirection[column] === 'asc' ? 'desc' : 'asc';
    sortDirection[column] = direction;

    allResults.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Handle numeric columns
        if (['price', 'distance', 'price_per_mile'].includes(column)) {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
        }

        // Handle date column
        if (column === 'order_date') {
            valA = new Date(valA || 0);
            valB = new Date(valB || 0);
        }

        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    currentPage = 1;
    displayTablePage();
}

function handleClear() {
    document.getElementById('searchForm').reset();
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    allResults = [];
}

function exportToCSV() {
    if (allResults.length === 0) return;

    // Create CSV content
    const headers = ['Order ID', 'Origin City', 'Destination City', 'Carrier', 'Price', 'Distance', 'Price/Mile', 'Order Date'];
    const csvRows = [headers.join(',')];

    allResults.forEach(order => {
        const pricePerMile = order.distance > 0 ? (order.price / order.distance).toFixed(2) : '0.00';
        const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString() : 'N/A';

        const row = [
            order.order_id || '',
            order.origin_city || '',
            order.destination_city || '',
            order.carrier || '',
            order.price || '0',
            order.distance || '0',
            pricePerMile,
            orderDate
        ];
        csvRows.push(row.map(cell => `"${cell}"`).join(','));
    });

    // Download CSV
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freight-orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}