// ====================================
// Data Management Module (Admin Only) 
// ====================================

import { getSupabase, checkIsAdmin } from './app.js';

let supabase;
let parsedData = [];
let uploadMode = '';

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
    // Note: app.js already checks auth and admin status for admin pages, 
    // but we might want to load stats here if check passes.
    // However, since app.js handles the redirect, we can assume if we are here, we are good?
    // Actually, app.js checkAuth is async, so we should verify if we need to wait or re-check.
    // app.js initApp awaits checkAuth. Since we await getSupabase which awaits ready, 
    // auth check should be complete.

    // But we need to load stats specifically for this page.
    await loadStats();

    // Setup event listeners
    const selectFileBtn = document.getElementById('selectFileBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadInfoBtn = document.getElementById('uploadInfoBtn');
    const appendBtn = document.getElementById('appendBtn');
    const replaceBtn = document.getElementById('replaceBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const closeRequireModal = document.getElementById('closeRequireModal');
    const closeConfirmModal = document.getElementById('closeConfirmModal');
    const confirmNo = document.getElementById('confirmNo');
    const confirmYes = document.getElementById('confirmYes');

    // New form elements for manual record entry
    const manualRecordForm = document.getElementById('manualEntryForm');

    if (selectFileBtn) selectFileBtn.addEventListener('click', () => fileInput.click());
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (uploadInfoBtn) uploadInfoBtn.addEventListener('click', showUploadInfo);
    if (appendBtn) appendBtn.addEventListener('click', () => confirmUpload('append'));
    if (replaceBtn) replaceBtn.addEventListener('click', () => confirmUpload('replace'));
    if (downloadAllBtn) downloadAllBtn.addEventListener('click', downloadAllData);
    if (closeRequireModal) closeRequireModal.addEventListener('click', () => hideModal('requireModal'));
    if (closeConfirmModal) closeConfirmModal.addEventListener('click', () => hideModal('confirmModal'));
    if (confirmNo) confirmNo.addEventListener('click', () => hideModal('confirmModal'));
    if (confirmYes) confirmYes.addEventListener('click', executeUpload);

    if (manualRecordForm) manualRecordForm.addEventListener('submit', handleManualRecordSubmit);

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        // Check if the clicked element has the class "modal"
        if (e.target.classList.contains('modal')) {
            // Call a function to hide the clicked modal
            hideModal(e.target.id);
        }
    });

}

async function loadStats() {
    const loadingStats = document.getElementById('loadingStats');
    const statsContent = document.getElementById('statsContent');

    if (loadingStats) loadingStats.style.display = 'block';
    if (statsContent) statsContent.style.display = 'none';

    try {

        // Fetch stats via RPC call
        const { data: blankCounts, error: blankCountsError } = await supabase
            .rpc('get_stat_counts');

        if (blankCountsError) {
            throw blankCountsError;
        } else if (blankCounts && blankCounts.length > 0) {
            document.getElementById('totalRecordsCount').textContent = blankCounts[0].total_order_count.toLocaleString();
            document.getElementById('blankCarrierCount').textContent = blankCounts[0].blank_carrier_count.toLocaleString();
            document.getElementById('blankOrderIdCount').textContent = blankCounts[0].blank_order_id_count.toLocaleString();
            document.getElementById('blankPriceCount').textContent = blankCounts[0].blank_price_count.toLocaleString();

            const maxOrderDate = blankCounts[0].max_order_date ? new Date(blankCounts[0].max_order_date).toLocaleDateString() : 'N/A';
            const maxUpdatedAt = blankCounts[0].max_updated_at ? new Date(blankCounts[0].max_updated_at).toLocaleString() : 'N/A';

            document.getElementById('newestOrder').textContent = maxOrderDate;
            document.getElementById('lastUpdated').textContent = maxUpdatedAt;
        }

        if (loadingStats) loadingStats.style.display = 'none';
        if (statsContent) statsContent.style.display = 'block';

    } catch (error) {
        console.error('Error loading stats:', error);
        if (loadingStats) loadingStats.style.display = 'none';
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
// Store selected columns
let selectedColumns = [];

// Store csv-to-db mapped columns
let columnMapping = {};

function resetColumnMapping() {
    columnMapping = {};
}
function parseCSV(csvText) {
    try {
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false
        });

        if (results.errors.length > 0) {
            console.error('PapaParse errors:', results.errors);
            alert('CSV parse errors detected. Some rows may be skipped.');
        }

        if (!results.data || results.data.length === 0) {
            alert('No data found in CSV file');
            return;
        }

        parsedData = results.data;
        const allHeaders = Object.keys(parsedData[0]);

        // Database column names (what your DB expects)
        const defaultColumns = [
            'order_id', 'pickup_business', 'delivery_business', 'origin_city',
            'destination_city', 'carrier', 'price', 'distance', 'order_date'
        ];

        // Set selected columns (only include those that exist in the CSV)
        selectedColumns = allHeaders.filter(h => defaultColumns.includes(h));

        displayColumnSelection(allHeaders);
        displayPreview();

    } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file: ' + error.message);
    }
}


function displayColumnSelection(allHeaders) {
    // Create column selection interface
    const previewSection = document.getElementById('previewSection');

    // Check if column selection already exists, if not create it
    let columnSelectionDiv = document.getElementById('columnSelection');

    if (!columnSelectionDiv) {
        columnSelectionDiv = document.createElement('div');
        columnSelectionDiv.id = 'columnSelection';
        columnSelectionDiv.style.marginBottom = '20px';

        // Insert before the preview table
        previewSection.insertBefore(columnSelectionDiv, previewSection.firstChild);
    }

    // Build column selection checkboxes
    let html = '<h4>Step 1. Select all columns to import:</h4><div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px;">';

    allHeaders.forEach(header => {
        const isChecked = selectedColumns.includes(header) ? 'checked' : '';
        html += `
            <label style="display: flex; align-items: center; gap: 5px;">
                <input type="checkbox" class="column-checkbox" value="${header}" ${isChecked}>               
                <span>${header}</span>
            </label>
        `;
    });

    html += '</div>';
    columnSelectionDiv.innerHTML = html;

    // Add event listeners to checkboxes
    document.querySelectorAll('.column-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!selectedColumns.includes(e.target.value)) {
                    selectedColumns.push(e.target.value);
                }
            } else {
                selectedColumns = selectedColumns.filter(col => col !== e.target.value);
            }
            displayPreview();
        });
    });
}

function displayPreview() {
    if (parsedData.length === 0) return;

    const previewSection = document.getElementById('previewSection');
    const previewTableHead = document.getElementById('previewTableHead');
    const previewTableBody = document.getElementById('previewTableBody');

    // Use selected columns or all columns if none selected
    const columnsToShow = selectedColumns.length > 0 ? selectedColumns : Object.keys(parsedData[0]);

    // Define DB fields for mapping options
    const dbFields = [
        'order_id', 'pickup_business', 'delivery_business', 'origin_city',
        'origin_state', 'origin_zip', 'destination_city', 'destination_state',
        'destination_zip', 'carrier', 'inop_info', 'price', 'distance',
        'price_per_mile', 'order_date'
    ];

    // Display headers
    previewTableHead.innerHTML = '<tr>' +
        columnsToShow.map(col => {
            const currentMapping = columnMapping[col] || '';
            const options = dbFields.map(field =>
                `<option value="${field}" ${field === currentMapping ? 'selected' : ''}>${field}</option>`
            ).join('');

            return `<th>${col}<br/><select data-csv-col="${col}">
                    <option value="">map column</option>
                    ${options}
                </select></th>`;
        }).join('') +
        '</tr>';

    // Add event listeners to all selects after rendering
    document.querySelectorAll('select[data-csv-col]').forEach(select => {
        select.addEventListener('change', function () {
            const csvCol = this.getAttribute('data-csv-col');
            const dbField = this.value;
            columnMapping[csvCol] = dbField;
        });
    });

    // Display first 10 rows
    previewTableBody.innerHTML = '';
    const previewRows = parsedData.slice(0, 10);

    previewRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = columnsToShow.map(col => {
            const value = row[col] !== undefined && row[col] !== null ? row[col] : '';
            return `<td>${value}</td>`;
        }).join('');
        previewTableBody.appendChild(tr);
    });

    document.getElementById('totalRows').textContent = parsedData.length.toLocaleString();
    previewSection.style.display = 'block';

    // Enable upload buttons
    document.getElementById('appendBtn').disabled = false;
    document.getElementById('replaceBtn').disabled = false;
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

// Show the Requirements List Modal for Uploading a new CSV
function showUploadInfo() {
    document.getElementById('requireModal').style.display = 'flex';
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
    hideModal('confirmModal');

    // Show progress
    document.getElementById('uploadProgress').style.display = 'block';
    document.getElementById('headerMessage').style.display = 'none';
    document.getElementById('appendBtn').disabled = true;
    document.getElementById('replaceBtn').disabled = true;

    try {
        // If replace mode, delete all existing records first
        if (uploadMode === 'replace') {
            updateProgress(10, 'Deleting existing records...');

            const { error: deleteError } = await supabase
                .from('historical_orders')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');

            if (deleteError) throw deleteError;
        }


        // Map CSV columns to database fields using global columnMapping
        const dataToUpload = parsedData.map(row => {
            let newRow = {};
            for (let csvCol in columnMapping) {
                const dbField = columnMapping[csvCol];
                if (dbField && row[csvCol] !== undefined) {
                    newRow[dbField] = row[csvCol];
                }
            }
            // Calculate price_per_mile if not present:
            if (!newRow.price_per_mile && newRow.price && newRow.distance) {
                newRow.price_per_mile = (parseFloat(newRow.price) / parseFloat(newRow.distance)).toFixed(2);
            }
            return newRow;
        });


        // Upload in batches of 100 records
        const batchSize = 100;
        const totalBatches = Math.ceil(dataToUpload.length / batchSize);

        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, dataToUpload.length);
            const batch = dataToUpload.slice(start, end);

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
            showMessage(`Successfully uploaded ${dataToUpload.length} records!`, 'success');

            // Reset form
            document.getElementById('fileInput').value = '';
            document.getElementById('fileInfo').style.display = 'none';
            document.getElementById('previewSection').style.display = 'none';
            parsedData = [];
            selectedColumns = [];

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

// New function to handle manual record form submission
async function handleManualRecordSubmit(event) {
    console.log("Made it to handle manual record");
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    // Construct record object from form data
    const record = {};
    formData.forEach((value, key) => {
        record[key] = value;
    });

    // Calculate price_per_mile if price and distance are provided
    if (record.lo_price && record.distance && !record.price_per_mile) {
        record.price_per_mile = (parseFloat(record.lo_price) / parseFloat(record.distance)).toFixed(2);
    }

    try {
        // Insert the single record into the database
        const { error } = await supabase
            .from('manual_orders')
            .insert([record]);

        if (error) {
            throw error;
        }

        showMessage('Record added successfully!', 'success');

        // Reset the form
        form.reset();

        // Reload stats to reflect new data
        loadStats();

    } catch (error) {
        console.error('Error adding record:', error);
        showMessage('Error adding record: ' + error.message, 'error');
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
    const element = document.getElementById('headerMessage');
    element.textContent = message;
    element.className = `message ${type}`;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function hideModal(modal_name) {
    const modal = document.getElementById(modal_name);
    modal.style.display = 'none';
}
