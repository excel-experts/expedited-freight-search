// ====================================
// Search Module
// ====================================

import { getSupabase, checkIsAdmin } from './app.js';

const columnMapping = {
    'order_id': 'Order ID',
    'pickup_business': 'Pickup Business',
    'origin': 'Origin',
    'delivery_business': 'Delivery Business',
    'destination': 'Destination',
    'carrier': 'Carrier',
    'inop_info': 'INOP',
    'vehicle_cnt': '# Autos',
    'price': 'Price',
    'distance': 'Distance (mi)',
    'price_per_mile': 'Price/Mile',
    'order_date': 'Order Date'
};

let supabase;
let allResults = []; // historical results 
let manResults = []; // manual entry results
let currentPage = 1;
const recordsPerPage = 50;
let currentSort = { column: 'order_date', direction: 'desc' };

// Initialize
init();

async function init() {
    // Wait for app to be ready and get supabase client
    supabase = await getSupabase();

    if (!supabase) {
        alert('Supabase configuration error. Please check your credentials.');
        return;
    }

    // Setup event listeners
    const searchForm = document.getElementById('searchForm');
    const clearBtn = document.getElementById('clearBtn');
    const exportBtn = document.getElementById('exportBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (searchForm) searchForm.addEventListener('submit', handleSearch);
    if (clearBtn) clearBtn.addEventListener('click', handleClear);
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    if (prevBtn) prevBtn.addEventListener('click', () => changePage(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(1));
}

async function handleSearch(e) {
    e.preventDefault();

    const pickupBusiness = document.getElementById('pickupBusiness').value.trim();
    const deliveryBusiness = document.getElementById('deliveryBusiness').value.trim();
    const originCity = document.getElementById('originCity').value.trim();
    const originState = document.getElementById('originState').value.trim();
    const originZip = document.getElementById('originZip').value.trim();
    const destinationCity = document.getElementById('destinationCity').value.trim();
    const destinationState = document.getElementById('destinationState').value.trim();
    const destinationZip = document.getElementById('destinationZip').value.trim();
    const carrier = document.getElementById('carrier').value.trim();
    const inopInfo = document.getElementById('inopInfo').value.trim();

    // At least one field must be filled
    if (!pickupBusiness && !deliveryBusiness && !originCity && !originZip && !destinationCity && !destinationZip && !carrier) {
        alert('Please enter at least one required search criteria');
        return;
    }

    // Show loading
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingResults').style.display = 'block';

    try {
        // Build query
        let query_historical = supabase.from('historical_order_rollup').select(`
                                                                                order_id,carrier,
                                                                                pickup_business,origin_city,origin_state,origin_zip,
                                                                                delivery_business,destination_city,destination_state,destination_zip,
                                                                                inop_info,order_date,vehicle_cnt,price,distance
                                                                                `);
        let query_manual = supabase.from('manual_orders').select(`
                                                                    pickup_business,origin_city,
                                                                    delivery_business,destination_city,
                                                                    distance,lo_price,hi_price,inop_price,
                                                                    valid_date                                                                                
                                                                `);

        if (pickupBusiness) {
            query_historical = query_historical.ilike('pickup_business', `%${pickupBusiness}%`);
            query_manual = query_manual.ilike('pickup_business', `%${pickupBusiness}%`);
        }
        if (deliveryBusiness) {
            query_historical = query_historical.ilike('delivery_business', `%${deliveryBusiness}%`);
            query_manual = query_manual.ilike('delivery_business', `%${deliveryBusiness}%`);
        }
        if (originCity) {
            query_historical = query_historical.ilike('origin_city', `%${originCity}%`);
            query_manual = query_manual.ilike('origin_city', `%${originCity}%`);
        }
        if (originState) {
            query_historical = query_historical.ilike('origin_State', `%${originState}%`);
        }
        if (originZip) {
            query_historical = query_historical.ilike('origin_Zip', `%${originZip}%`);
        }
        if (destinationCity) {
            query_historical = query_historical.ilike('destination_city', `%${destinationCity}%`);
            query_manual = query_manual.ilike('destination_city', `%${destinationCity}%`);
        }
        if (destinationState) {
            query_historical = query_historical.ilike('destination_state', `%${destinationState}%`);
        }
        if (destinationZip) {
            query_historical = query_historical.ilike('destination_zip', `%${destinationZip}%`);
        }
        if (carrier) {
            query_historical = query_historical.ilike('carrier', `%${carrier}%`);
        }
        if (inopInfo) {
            query_historical = query_historical.ilike('inop_info', `%${inopInfo}%`);
        }

        const { data: data_hist, error: err_hist } = await query_historical;
        if (err_hist) throw err_hist;

        allResults = data_hist || [];
        currentPage = 1;

        if (allResults.length === 0) {
            document.getElementById('loadingResults').style.display = 'none';
            document.getElementById('noResults').style.display = 'block';
        } else {
            processResults();
            displayResults();
        }

        const { data: data_man, error: err_man } = await query_manual;
        if (err_man) throw err_man;

        manResults = data_man || [];
        if (manResults.length === 0) {
            // handle toggling no results display
        } else {
            displayManualResults()
        }

    } catch (error) {
        console.error('Search error:', error);
        alert('Error searching orders: ' + error.message);
        document.getElementById('loadingResults').style.display = 'none';
    }
}

function processResults() {
    if (!allResults || !Array.isArray(allResults)) {
        console.error('allResults is not defined or is not an array');
        return;
    }

    allResults.forEach(record => {
        try {
            // Combine Origin
            const originParts = [];
            if (record.origin_city) originParts.push(record.origin_city);
            if (record.origin_state) originParts.push(record.origin_state);
            if (record.origin_zip) originParts.push(record.origin_zip);

            if (originParts.length > 0) {
                record.origin = originParts.join(', ');
            }

            // Combine Destination
            const destParts = [];
            if (record.destination_city) destParts.push(record.destination_city);
            if (record.destination_state) destParts.push(record.destination_state);
            if (record.destination_zip) destParts.push(record.destination_zip);

            if (destParts.length > 0) {
                record.destination = destParts.join(', ');
            }

        } catch (err) {
            console.warn('Error processing record:', record, err);
        }
    });
}

function displayResults() {
    // Calculate metrics
    const totalRecords = allResults.length;

    // Separate sums and counts for loPrice and hiPrice orders
    let loPriceSum = 0;
    let loPriceCount = 0;
    let hiPriceSum = 0;
    let hiPriceCount = 0;
    let inopPriceCount = 0;
    let inopPriceSum = 0;

    allResults.forEach(order => {
        const price = parseFloat(order.price) || 0;
        const vehicleCnt = parseInt(order.vehicle_cnt, 10) || 0;
        const inopVal = order.inop_info ? order.inop_info.toLocaleString() : '';
        if (inopVal.includes('Y')) {
            inopPriceSum += price;
            inopPriceCount += 1;
        }

        if (vehicleCnt <= 3) {
            loPriceSum += price;
            loPriceCount += 1;
        } else if (vehicleCnt >= 4) {
            hiPriceSum += price;
            hiPriceCount += 1;
        }
    });

    const totalPrice = loPriceSum + hiPriceSum;
    const avgPrice = totalRecords > 0 ? totalPrice / totalRecords : 0;
    const avgLoPrice = loPriceCount > 0 ? loPriceSum / loPriceCount : 0;
    const avgHiPrice = hiPriceCount > 0 ? hiPriceSum / hiPriceCount : 0;

    // If you use avgInopPrice, update its logic accordingly or remove if not needed
    const avgInopPrice = inopPriceCount > 0 ? inopPriceSum / inopPriceCount : 0;

    // Update metrics
    document.getElementById('totalRecords').textContent = totalRecords.toLocaleString();
    document.getElementById('avgLoPrice').textContent = '$' + avgLoPrice.toFixed(2) + ' / ' + loPriceCount.toLocaleString();
    document.getElementById('avgHiPrice').textContent = '$' + avgHiPrice.toFixed(2) + ' / ' + hiPriceCount.toLocaleString();
    document.getElementById('avgInopPrice').textContent = '$' + avgInopPrice.toFixed(2) + ' / ' + inopPriceCount.toLocaleString();

    // Display table
    displayTablePage();

    // Show results section
    document.getElementById('loadingResults').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';
}


function displayTablePage() {
    if (allResults.length === 0) return;

    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const pageResults = allResults.slice(startIndex, endIndex);

    const tbody = document.getElementById('resultsBody');
    const thead = document.getElementById('resultsTableHead');

    // Determine columns from the first result
    const columnsToShow = Object.keys(allResults[0]);

    // Generate Headers
    thead.innerHTML = '<tr>' +
        columnsToShow.map(col => {
            const displayName = columnMapping[col] || col;
            return `<th class="sortable" data-column="${col}">${displayName}</th>`;
        }).join('') +
        '</tr>';

    // Re-attach sorting listeners
    setupTableSorting();

    tbody.innerHTML = '';

    pageResults.forEach(order => {
        const row = document.createElement('tr');
        row.innerHTML = columnsToShow.map(col => {
            const value = formatValue(col, order[col]);
            return `<td>${value}</td>`;
        }).join('');
        tbody.appendChild(row);
    });

    // Update pagination
    const totalPages = Math.ceil(allResults.length / recordsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage === totalPages;
}

function setupTableSorting() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.column;

            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }

            // Sort allResults
            allResults.sort((a, b) => {
                let valA = a[column];
                let valB = b[column];

                // Handle nulls
                if (valA === null) valA = '';
                if (valB === null) valB = '';

                // Numeric sort for price/distance
                if (['price', 'distance', 'price_per_mile', 'vehicle_cnt'].includes(column)) {
                    valA = parseFloat(valA) || 0;
                    valB = parseFloat(valB) || 0;
                }

                if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
                if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
                return 0;
            });

            displayTablePage();
        });
    });
}

function exportToCSV() {
    if (allResults.length === 0) return;

    // Create CSV content
    const columns = Object.keys(allResults[0]);
    const headers = columns.map(col => columnMapping[col] || col);
    const csvRows = [headers.join(',')];

    allResults.forEach(order => {
        const row = columns.map(col => {
            let cell = formatValue(col, order[col]);
            // Escape quotes for CSV
            if (typeof cell === 'string' && cell.includes(',')) {
                cell = `"${cell}"`;
            }
            return cell;
        });
        csvRows.push(row.join(','));
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

function displayManualResults() {
    if (manResults.length === 0) return;

    const previewSection = document.getElementById('previewSection');
    const previewTableHead = document.getElementById('previewTableHead');
    const previewTableBody = document.getElementById('previewTableBody');

    // Use pre-selected columns or all columns if none selected
    const columnsToShow = Object.keys(manResults[0]);

    // Display headers
    previewTableHead.innerHTML = '<tr>' +
        columnsToShow.map(col => {
            const displayName = columnMapping[col] || col;
            return `<th>${displayName}</th>`;
        }).join('') +
        '</tr>';


    // Display first 10 rows
    previewTableBody.innerHTML = '';
    const previewRows = manResults.slice(0, 10);

    previewRows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = columnsToShow.map(col => {
            const value = row[col] !== undefined && row[col] !== null ? row[col] : '';
            return `<td>${value}</td>`;
        }).join('');
        previewTableBody.appendChild(tr);
    });

    document.getElementById('totalRows').textContent = manResults.length.toLocaleString();
    previewSection.style.display = 'block';
}

function formatValue(col, value) {
    if (value === null || value === undefined) return '';
    if (col === 'price' || col === 'price_per_mile') {
        return '$' + parseFloat(value).toFixed(2);
    }
    if (col === 'order_date') {
        return new Date(value).toLocaleDateString();
    }
    return value;
}

function handleClear() {
    document.getElementById('searchForm').reset();
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('previewSection').style.display = 'none';
    allResults = [];
    manResults = [];
}

function changePage(delta) {
    const totalPages = Math.ceil(allResults.length / recordsPerPage);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayTablePage();
    }
}
