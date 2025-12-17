// ====================================
// Data Management Module (Admin Only) 
// ====================================

import { getSupabase } from './app.js';

let supabase;
let parsedData = [];
let uploadMode = '';

// Pagination & Validation State
let currentPage = 1;
const PAGE_SIZE = 10;
let validationErrors = []; // Array of error objects { rowIndex, errors: { col: msg } }

// Initialize
init();

async function init() {
    // Wait for app to be ready and get supabase client
    supabase = await getSupabase();

    if (!supabase) {
        alert('Supabase configuration error. Please check your credentials.');
        return;
    }

    // Load initial stats
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

    // Message Modal Listeners
    const closeMessageModal = document.getElementById('closeMessageModal');
    const messageOk = document.getElementById('messageOk');
    if (closeMessageModal) closeMessageModal.addEventListener('click', () => hideModal('messageModal'));
    if (messageOk) messageOk.addEventListener('click', () => hideModal('messageModal'));

    // Pagination Listeners
    document.getElementById('prevPageBtn')?.addEventListener('click', () => changePage(-1));
    document.getElementById('nextPageBtn')?.addEventListener('click', () => changePage(1));

    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
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
        const { data: blankCounts, error: blankCountsError } = await supabase.rpc('get_stat_counts');

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

// Store selected columns & mapping
let selectedColumns = [];
let columnMapping = {};

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

        // Default columns we expect
        const defaultColumns = [
            'order_id', 'pickup_business', 'delivery_business', 'pickup_city',
            'delivery_city', 'carrier', 'price', 'distance', 'order_date'
        ];

        // Auto-select corresponding columns
        selectedColumns = allHeaders.filter(h => defaultColumns.includes(h));

        // Auto-map columns if they match exact names
        columnMapping = {};
        defaultColumns.forEach(dbCol => {
            if (allHeaders.includes(dbCol)) {
                columnMapping[dbCol] = dbCol;
            }
        });

        displayColumnSelection(allHeaders);
        validateAndPreview();

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

        // Simple default mapping for JSON (assuming keys match db fields)
        const allKeys = Object.keys(parsedData[0] || {});
        selectedColumns = allKeys;
        columnMapping = {};
        allKeys.forEach(k => columnMapping[k] = k);

        displayColumnSelection(allKeys);
        validateAndPreview();

    } catch (error) {
        console.error('Error parsing JSON:', error);
        alert('Error parsing JSON file: ' + error.message);
    }
}

function displayColumnSelection(allHeaders) {
    const previewSection = document.getElementById('previewSection');
    let columnSelectionDiv = document.getElementById('columnSelection');

    if (!columnSelectionDiv) {
        columnSelectionDiv = document.createElement('div');
        columnSelectionDiv.id = 'columnSelection';
        columnSelectionDiv.style.marginBottom = '20px';
        previewSection.insertBefore(columnSelectionDiv, previewSection.firstChild);
    }

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

// Validation Logic
function validateAndPreview() {
    validationErrors = [];

    parsedData.forEach((row, index) => {
        const errors = {};

        // Iterate through ALL selected columns to ensure no blanks
        selectedColumns.forEach(col => {
            const val = row[col];
            // Check for blank (empty string, null, undefined, or just whitespace)
            if (val === null || val === undefined || String(val).trim() === '') {
                errors[col] = 'Cannot be blank';
            } else {
                // If not blank, check type based on mapping
                const dbField = columnMapping[col];
                if (dbField) {
                    // Numeric fields
                    if (['price', 'distance', 'lo_price', 'hi_price', 'inop_price'].includes(dbField)) {
                        // Remove currency symbols or commas if present before checking
                        const cleanVal = String(val).replace(/[$,]/g, '');
                        if (isNaN(parseFloat(cleanVal))) {
                            errors[col] = 'Must be a number';
                        }
                    }
                    // Date fields
                    if (dbField === 'order_date') {
                        if (isNaN(Date.parse(val))) {
                            errors[col] = 'Invalid date';
                        }
                    }
                }
            }
        });

        if (Object.keys(errors).length > 0) {
            validationErrors.push({ rowIndex: index, errors });
        }
    });

    currentPage = 1;
    displayPreview();
}


function displayPreview() {
    if (parsedData.length === 0) return;

    const previewSection = document.getElementById('previewSection');
    const previewTableHead = document.getElementById('previewTableHead');
    const previewTableBody = document.getElementById('previewTableBody');
    const validationSummaryDiv = document.getElementById('validationSummary') || createValidationSummary(previewSection);

    // Validation Summary
    const totalRows = parsedData.length;
    const invalidCount = validationErrors.length;
    const validCount = totalRows - invalidCount;

    if (invalidCount > 0) {
        validationSummaryDiv.className = 'validation-summary validation-invalid';
        validationSummaryDiv.innerHTML = `<span>⚠️ Found ${invalidCount} invalid rows (blank or bad format). These will be SKIPPED during upload.</span> <span>${validCount} valid rows.</span>`;
    } else {
        validationSummaryDiv.className = 'validation-summary validation-valid';
        validationSummaryDiv.innerHTML = `<span>✅ All ${totalRows} rows look valid.</span>`;
    }


    // Use selected columns or all columns if none selected
    const columnsToShow = selectedColumns.length > 0 ? selectedColumns : Object.keys(parsedData[0]);

    // Define DB fields for mapping options
    const dbFields = [
        'order_id', 'pickup_business', 'delivery_business', 'pickup_city',
        'pickup_state', 'pickup_zip', 'delivery_city', 'delivery_state',
        'delivery_zip', 'carrier', 'inop_info', 'price', 'distance',
        'price_per_mile', 'order_date'
    ];

    // Display headers
    previewTableHead.innerHTML = '<tr>' +
        columnsToShow.map(col => {
            const currentMapping = columnMapping[col] || '';
            const options = dbFields.map(field =>
                `<option value="${field}" ${field === currentMapping ? 'selected' : ''}>${field}</option>`
            ).join('');

            return `<th>${col}<br/><select data-csv-col="${col}" class="map-select">
                    <option value="">map column</option>
                    ${options}
                </select></th>`;
        }).join('') +
        '</tr>';

    // Add event listeners to select mapping
    document.querySelectorAll('.map-select').forEach(select => {
        select.addEventListener('change', function () {
            const csvCol = this.getAttribute('data-csv-col');
            const dbField = this.value;
            columnMapping[csvCol] = dbField;
            // Re-validate when mapping changes because type checks depend on it
            validateAndPreview();
        });
    });

    // Pagination Logic
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, parsedData.length);
    const visibleRows = parsedData.slice(startIdx, endIdx);

    previewTableBody.innerHTML = '';

    visibleRows.forEach((row, loopIndex) => {
        const actualIndex = startIdx + loopIndex;
        const rowErrors = validationErrors.find(e => e.rowIndex === actualIndex)?.errors;

        const tr = document.createElement('tr');

        tr.innerHTML = columnsToShow.map(col => {
            const value = row[col] !== undefined && row[col] !== null ? row[col] : '';
            const errorMsg = rowErrors && rowErrors[col] ? rowErrors[col] : null;
            const classAttr = errorMsg ? 'class="invalid-cell" title="' + errorMsg + '"' : '';

            return `<td ${classAttr}>${value}</td>`;
        }).join('');

        previewTableBody.appendChild(tr);
    });

    // Update Pagination Controls
    updatePaginationControls(startIdx, endIdx, totalRows);

    previewSection.style.display = 'block';

    // Enable upload buttons
    document.getElementById('appendBtn').disabled = false;
    document.getElementById('replaceBtn').disabled = false;
}

function createValidationSummary(parent) {
    const div = document.createElement('div');
    div.id = 'validationSummary';
    // Insert after header but before table
    const tableContainer = parent.querySelector('.table-container');
    parent.insertBefore(div, tableContainer);
    return div;
}

function updatePaginationControls(start, end, total) {
    const info = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn'); // Assuming these exist now

    if (info) info.textContent = `Showing rows ${start + 1}-${end} of ${total}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = end >= total;
}

function changePage(delta) {
    currentPage += delta;
    displayPreview();
}

function showUploadInfo() {
    document.getElementById('requireModal').style.display = 'flex';
}

function confirmUpload(mode) {
    uploadMode = mode;

    // Check validation status
    const invalidCount = validationErrors.length;
    const totalCount = parsedData.length;
    const validCount = totalCount - invalidCount;

    let message = '';

    if (invalidCount > 0) {
        message += `⚠️ WARNING: You have ${invalidCount} invalid rows preventing upload. These rows will be SKIPPED.\n\n`;
        message += `Only the ${validCount} valid records will be processed.\n\n`;
    }

    message += mode === 'append'
        ? `Are you sure you want to append ${validCount} valid records to the existing data?`
        : `⚠️ WARNING: This will delete ALL existing records and replace them with ${validCount} valid records. This action cannot be undone. Are you sure?`;

    document.getElementById('confirmMessage').innerText = message; // Use innerText to handle newlines
    document.getElementById('confirmModal').style.display = 'flex';
}

// ---------------------------------------------------------
//  Improved Upload Logic
// ---------------------------------------------------------
async function executeUpload() {
    hideModal('confirmModal');

    const progressSection = document.getElementById('uploadProgress');
    progressSection.style.display = 'block';

    document.getElementById('appendBtn').disabled = true;
    document.getElementById('replaceBtn').disabled = true;

    try {
        // DELETE PHASE (If Replace)
        if (uploadMode === 'replace') {
            updateProgress(5, 'Deleting existing records...');
            const { error: deleteError } = await supabase
                .from('historical_orders')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all safe guard

            if (deleteError) throw deleteError;
        }

        // PREPARATION PHASE
        updateProgress(10, 'Preparing data...');

        // Map data to DB structure
        // Filter out invalid rows first
        const validRows = parsedData.filter((row, index) =>
            !validationErrors.some(e => e.rowIndex === index)
        );

        const dataToUpload = validRows.map(row => {
            let newRow = {};
            for (let csvCol in columnMapping) {
                const dbField = columnMapping[csvCol];
                if (dbField && row[csvCol] !== undefined) {
                    newRow[dbField] = row[csvCol];
                }
            }
            // Auto-calc logic
            if (!newRow.price_per_mile && newRow.price && newRow.distance) {
                newRow.price_per_mile = (parseFloat(newRow.price) / parseFloat(newRow.distance)).toFixed(2);
            }
            // Ensure numeric and sanitation
            if (newRow.price) newRow.price = parseFloat(String(newRow.price).replace(/[$,]/g, ''));
            if (newRow.distance) newRow.distance = parseFloat(String(newRow.distance).replace(/,/g, ''));

            return newRow;
        });

        // BATCH UPLOAD PHASE
        const batchSize = 100;
        const totalBatches = Math.ceil(dataToUpload.length / batchSize);
        const failedRecords = [];

        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, dataToUpload.length);
            const batch = dataToUpload.slice(start, end);
            const rawBatch = parsedData.slice(start, end); // Keep raw for failed report

            const progress = 10 + Math.floor((i / totalBatches) * 85);
            updateProgress(progress, `Uploading batch ${i + 1} of ${totalBatches}...`);

            // Retry logic
            let success = false;
            let attempts = 0;
            const maxAttempts = 3;

            while (!success && attempts < maxAttempts) {
                attempts++;
                const { error } = await supabase.from('historical_orders').insert(batch);

                if (!error) {
                    success = true;
                } else {
                    console.warn(`Batch ${i + 1} attempt ${attempts} failed:`, error);
                    if (attempts === maxAttempts) {
                        // All attempts failed, add to failure list
                        rawBatch.forEach(r => {
                            const filteredRow = {};
                            // Only include selected columns
                            selectedColumns.forEach(col => {
                                if (r[col] !== undefined) {
                                    filteredRow[col] = r[col];
                                }
                            });
                            // Add error message
                            filteredRow._error = error.message;
                            failedRecords.push(filteredRow);
                        });
                    } else {
                        // Wait before retry
                        await new Promise(r => setTimeout(r, 1000 * attempts));
                    }
                }
            }
        }

        // COMPLETION PHASE
        updateProgress(100, 'Process complete.');

        if (failedRecords.length > 0) {
            // Partial Success
            const successCount = dataToUpload.length - failedRecords.length;
            showMessage(`Uploaded ${successCount} records. ⚠️ ${failedRecords.length} records failed.`, 'error');
            downloadFailedRecords(failedRecords);
        } else {
            // Full Success
            showMessage(`Successfully uploaded all ${dataToUpload.length} records!`, 'success');
        }

        // Cleanup
        setTimeout(() => {
            progressSection.style.display = 'none';
            document.getElementById('fileInput').value = '';
            document.getElementById('fileInfo').style.display = 'none';
            document.getElementById('previewSection').style.display = 'none';
            parsedData = [];
            selectedColumns = [];
            loadStats();
        }, 2000);

    } catch (error) {
        console.error('Critical Upload error:', error);
        progressSection.style.display = 'none';
        showMessage('Critical error halting upload: ' + error.message, 'error');
        document.getElementById('appendBtn').disabled = false;
        document.getElementById('replaceBtn').disabled = false;
    }
}

function downloadFailedRecords(records) {
    if (!records || records.length === 0) return;

    const headers = Object.keys(records[0]);
    const csvRows = [headers.join(',')];

    records.forEach(row => {
        const values = headers.map(header => {
            const val = row[header] === null || row[header] === undefined ? '' : row[header];
            return `"${val}"`.replace(/\n/g, ' '); // simple escape
        });
        csvRows.push(values.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed_records_${new Date().getTime()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    alert('A CSV file containing the failed records has been downloaded. Please correct the errors and re-upload.');
}

async function handleManualRecordSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const record = {};
    formData.forEach((value, key) => record[key] = value);

    if (record.lo_price && record.distance && !record.price_per_mile) {
        record.price_per_mile = (parseFloat(record.lo_price) / parseFloat(record.distance)).toFixed(2);
    }

    try {
        const { error } = await supabase.from('manual_orders').insert([record]);
        if (error) throw error;
        showMessage('Record added successfully!', 'success');
        form.reset();
        loadStats();
    } catch (error) {
        console.error('Error adding record:', error);
        showMessage('Error adding record: ' + error.message, 'error');
    }
}

function updateProgress(percent, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = text + ' ' + percent + '%';
}

async function downloadAllData() {
    // Existing download logic remains same, just ensuring function is present
    try {
        const btn = document.getElementById('downloadAllBtn');
        btn.disabled = true;
        btn.textContent = 'Downloading...';

        const { data, error } = await supabase.from('historical_orders').select('*').order('order_date', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            alert('No data to download');
            return;
        }
        const headers = Object.keys(data[0]);
        const csvRows = [headers.join(',')];
        data.forEach(row => {
            csvRows.push(headers.map(h => `"${row[h] || ''}"`).join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historical-orders-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading: ' + error.message);
    } finally {
        const btn = document.getElementById('downloadAllBtn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '📥 Download All Data (CSV)';
        }
    }
}

function showMessage(message, type) {
    const modal = document.getElementById('messageModal');
    const title = document.getElementById('messageTitle');
    const content = document.getElementById('messageContent');
    if (title) title.textContent = type === 'error' ? '❌ Error' : '✅ Success';
    if (content) content.textContent = message;
    if (modal) {
        modal.style.display = 'flex';
        // Only auto-close success messages, leave errors open
        if (type === 'success') {
            setTimeout(() => { if (modal.style.display === 'flex') hideModal('messageModal'); }, 3000);
        }
    }
}

function hideModal(modal_name) {
    const modal = document.getElementById(modal_name);
    if (modal) modal.style.display = 'none';
}
