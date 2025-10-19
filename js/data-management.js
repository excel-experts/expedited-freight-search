// ====================================
// Data Management Module (Admin Only)
// ====================================

import { createClient } from './config.js';
import { checkIsAdmin } from './auth.js';

let supabase;
let parsedData = [];
let uploadMode = '';

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
    const selectFileBtn = document.getElementById('selectFileBtn');
    const fileInput = document.getElementById('fileInput');
    const appendBtn = document.getElementById('appendBtn');
    const replaceBtn = document.getElementById('replaceBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeConfirmModal = document.getElementById('closeConfirmModal');
    const confirmNo = document.getElementById('confirmNo');
    const confirmYes = document.getElementById('confirmYes');

    if (selectFileBtn) selectFileBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (appendBtn) appendBtn.addEventListener('click', () => confirmUpload('append'));
    if (replaceBtn) replaceBtn.addEventListener('click', () => confirmUpload('replace'));
    if (downloadAllBtn) downloadAllBtn.addEventListener('click', downloadAllData);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (closeConfirmModal) closeConfirmModal.addEventListener('click', hideConfirmModal);
    if (confirmNo) confirmNo.addEventListener('click', hideConfirmModal);
    if (confirmYes) confirmYes.addEventListener('click', executeUpload);

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('confirmModal');
        if (e.target === modal) hideConfirmModal();
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

    // Load statistics
    await loadStats();
}

async function loadStats() {
    document.getElementById('loadingStats').style.display = 'block';
    document.getElementById('statsContent').style.display = 'none';

    try {
        const { data, error, count } = await supabase
            .from('historical_orders')
            .select('order_date, updated_at', { count: 'exact' })
            .order('order_date', { ascending: false });

        if (error) throw error;

        const totalRecords = count || 0;
        const newestOrder = data && data.length > 0 && data[0].order_date ? 
            new Date(data[0].order_date).toLocaleDateString() : 'N/A';
        const oldestOrder = data && data.length > 0 && data[data.length - 1].order_date ? 
            new Date(data[data.length - 1].order_date).toLocaleDateString() : 'N/A';
        const lastUpdated = data && data.length > 0 && data[0].updated_at ? 
            new Date(data[0].updated_at).toLocaleString() : 'N/A';

        document.getElementById('totalRecordsCount').textContent = totalRecords.toLocaleString();
        document.getElementById('oldestOrder').textContent = oldestOrder;
        document.getElementById('newestOrder').textContent = newestOrder;
        document.getElementById('lastUpdated').textContent = lastUpdated;

        document.getElementById('loadingStats').style.display = 'none';
        document.getElementById('statsContent').style.display = 'block';

    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('loadingStats').style.display = 'none';
        showMessage('Error loading statistics: ' + error.message, 'error');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];

    if (!file) return;

    const fileName = file.name;
    const fileSize = (file.size / 1024).toFixed(2) + ' KB';

    document.getElementById('fileName').textContent = fileName;
    document.getElementById('fileSize').textContent = fileSize;
    document.getElementById('fileInfo').style.display = 'block';

    // Parse file
    const reader = new FileReader();

    if (fileName.endsWith('.csv')) {
        reader.onload = (e) => parseCSV(e.target.result);
        reader.readAsText(file);
    } else if (fileName.endsWith('.json')) {
        reader.onload = (e) => parseJSON(e.target.result);
        reader.readAsText(file);
    } else {
        alert('Please select a CSV or JSON file');
        return;
    }
}

function parseCSV(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        parsedData = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            const row = {};

            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });

            // Calculate price_per_mile if not provided
            if (!row.price_per_mile && row.price && row.distance) {
                row.price_per_mile = (parseFloat(row.price) / parseFloat(row.distance)).toFixed(2);
            }

            parsedData.push(row);
        }

        displayPreview();

    } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file: ' + error.message);
    }
}

function parseJSON(jsonText) {
    try {
        const data = JSON.parse(jsonText);
        parsedData = Array.isArray(data) ? data : [data];

        // Calculate price_per_mile if not provided
        parsedData = parsedData.map(row => {
            if (!row.price_per_mile && row.price && row.distance) {
                row.price_per_mile = (parseFloat(row.price) / parseFloat(row.distance)).toFixed(2);
            }
            return row;
        });

        displayPreview();

    } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Error parsing JSON file: ' + error.message);
    }
}

function displayPreview() {
    if (parsedData.length === 0) return;

    const previewSection = document.getElementById('previewSection');
    const previewTableHead = document.getElementById('previewTableHead');
    const previewTableBody = document.getElementById('previewTableBody');

    // Display headers
    const headers = Object.keys(parsedData[0]);
    previewTableHead.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';

    // Display first 10 rows
    previewTableBody.innerHTML = '';
    const previewRows = parsedData.slice(0, 10);

    previewRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = headers.map(h => `<td>${row[h] || ''}</td>`).join('');
        previewTableBody.appendChild(tr);
    });

    document.getElementById('totalRows').textContent = parsedData.length.toLocaleString();
    previewSection.style.display = 'block';

    // Enable upload buttons
    document.getElementById('appendBtn').disabled = false;
    document.getElementById('replaceBtn').disabled = false;
}

function confirmUpload(mode) {
    uploadMode = mode;

    const message = mode === 'append' 
        ? `Are you sure you want to append ${parsedData.length} records to the existing data?`
        : `⚠️ WARNING: This will delete ALL existing records and replace them with ${parsedData.length} new records. This action cannot be undone. Are you sure?`;

    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmModal').style.display = 'flex';
}

async function executeUpload() {
    hideConfirmModal();

    // Show progress
    document.getElementById('uploadProgress').style.display = 'block';
    document.getElementById('uploadMessage').style.display = 'none';
    document.getElementById('appendBtn').disabled = true;
    document.getElementById('replaceBtn').disabled = true;

    try {
        // If replace mode, delete all existing records first
        if (uploadMode === 'replace') {
            updateProgress(10, 'Deleting existing records...');

            const { error: deleteError } = await supabase
                .from('historical_orders')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (deleteError) throw deleteError;
        }

        // Upload in batches of 100 records
        const batchSize = 100;
        const totalBatches = Math.ceil(parsedData.length / batchSize);

        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, parsedData.length);
            const batch = parsedData.slice(start, end);

            const progress = 10 + Math.floor((i / totalBatches) * 80);
            updateProgress(progress, `Uploading batch ${i + 1} of ${totalBatches}...`);

            const { error } = await supabase
                .from('historical_orders')
                .insert(batch);

            if (error) throw error;
        }

        updateProgress(100, 'Upload complete!');

        // Show success message
        setTimeout(() => {
            document.getElementById('uploadProgress').style.display = 'none';
            showMessage(`Successfully uploaded ${parsedData.length} records!`, 'success');

            // Reset form
            document.getElementById('fileInput').value = '';
            document.getElementById('fileInfo').style.display = 'none';
            document.getElementById('previewSection').style.display = 'none';
            parsedData = [];

            // Reload stats
            loadStats();
        }, 1000);

    } catch (error) {
        console.error('Upload error:', error);
        document.getElementById('uploadProgress').style.display = 'none';
        showMessage('Error uploading data: ' + error.message, 'error');
        document.getElementById('appendBtn').disabled = false;
        document.getElementById('replaceBtn').disabled = false;
    }
}

function updateProgress(percent, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    progressFill.style.width = percent + '%';
    progressText.textContent = text + ' ' + percent + '%';
}

async function downloadAllData() {
    try {
        const btn = document.getElementById('downloadAllBtn');
        btn.disabled = true;
        btn.textContent = 'Downloading...';

        // Fetch all records
        const { data, error } = await supabase
            .from('historical_orders')
            .select('*')
            .order('order_date', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            alert('No data to download');
            return;
        }

        // Create CSV
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];

        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header] !== null && row[header] !== undefined ? row[header] : '';
                return `"${value}"`;
            });
            csvRows.push(values.join(','));
        });

        // Download
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historical-orders-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading data: ' + error.message);
    } finally {
        const btn = document.getElementById('downloadAllBtn');
        btn.disabled = false;
        btn.textContent = '📥 Download All Data (CSV)';
    }
}

function showMessage(message, type) {
    const element = document.getElementById('uploadMessage');
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function hideConfirmModal() {
    document.getElementById('confirmModal').style.display = 'none';
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}