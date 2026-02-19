// ====================================
// Reports Module - Route Statistics
// ====================================

import { getSupabase, checkIsAdmin } from './app.js';

const columnMapping = {
    'route': 'Route',
    'route_order_cnt': 'Orders',
    'total_vehicles': 'Total Vehicles',
    'avg_price_per_mile': 'Avg $/mi',
    'min_price_per_mile': 'Min $/mi',
    'max_price_per_mile': 'Max $/mi',
    'avg_tarriff_price': 'Avg Tarriff',
    'min_tarriff_price': 'Min Tarriff',
    'max_tarriff_price': 'Max Tarriff',
    'avg_carrier_price': 'Avg Carrier',
    'min_carrier_price': 'Min Carrier',
    'max_carrier_price': 'Max Carrier',
    'avg_distance': 'Avg Distance',
    'min_distance': 'Min Dist',
    'max_distance': 'Max Dist',
    'total_price': 'Total Price',
    // New Columns
    'carrier': 'Carrier',
    'load_count': 'Loads',
    'total_spend': 'Total Spend',
    'pickup_business': 'Customer',
    'total_revenue': 'Total Revenue'
};

let supabase;
let allResults = []; // route results 
let filteredResults = []; // filtered results for display
let currentPage = 1;
const recordsPerPage = 50;
let currentSort = { column: 'route_order_cnt', direction: 'desc' };
let currentReportType = 'route_stats';

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
    const reportSelect = document.getElementById('reportType');

    if (searchForm) searchForm.addEventListener('submit', handleRunReport);
    if (clearBtn) clearBtn.addEventListener('click', handleClear);
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    if (prevBtn) prevBtn.addEventListener('click', () => changePage(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(1));

    // Future: Add listener to reportSelect to toggle param sections
    if (reportSelect) {
        reportSelect.addEventListener('change', (e) => {
            updateReportDescription();
            currentReportType = e.target.value;
            // Clear results when switching report types to avoid confusion
            handleClear();
        });
        // Initialize description
        updateReportDescription();
        currentReportType = reportSelect.value;
    }
}

const reportDescriptions = {
    'route_stats': `
        <strong>Route Statistics</strong> provides an aggregated view of all historical orders grouped by freight lane (Pickup City -> Delivery City). 
        Use this report to analyze pricing trends, volume, and carrier performance for specific lanes.
        <br><br>
        <strong>Usage:</strong>
        <ul style="margin-top: 5px; margin-bottom: 0; padding-left: 20px;">
            <li>Enter a <strong>Pickup/Delivery City or State</strong> to filter for specific lanes.</li>
            <li>Leave parameters <strong>blank</strong> to view the <strong>Top 100</strong> routes by volume.</li>
            <li>Click on any <strong>blue route link</strong> in the results to view individual orders for that lane in the Dashboard.</li>
        </ul>
    `,
    'carrier_performance': `
        <strong>Carrier Performance</strong> aggregates historical data by Carrier to identify your top partners.
        <br><br>
        <strong>Usage:</strong>
        <ul style="margin-top: 5px; margin-bottom: 0; padding-left: 20px;">
            <li>Runs on the <strong>last 1,500 orders</strong> to provide recent performance metrics.</li>
            <li>Shows <strong>Load Count</strong>, <strong>Avg Price/Mile</strong>, and <strong>Total Spend</strong> per carrier.</li>
            <li>Use this to identify carriers to negotiate with or allocate more volume to.</li>
        </ul>
    `,
    'customer_volume': `
        <strong>Customer Volume</strong> aggregates historical data by Shipper (Pickup Business).
        <br><br>
        <strong>Usage:</strong>
        <ul style="margin-top: 5px; margin-bottom: 0; padding-left: 20px;">
            <li>Runs on the <strong>last 1,500 orders</strong> to provide recent volume metrics.</li>
            <li>Shows <strong>Load Count</strong>, <strong>Avg Price/Mile</strong>, and <strong>Total Revenue</strong> per customer.</li>
            <li>Use this to identify your most valuable customers.</li>
        </ul>
    `
};

function updateReportDescription() {
    const reportType = document.getElementById('reportType').value;
    const descContainer = document.getElementById('reportDescription');
    if (descContainer && reportDescriptions[reportType]) {
        descContainer.innerHTML = reportDescriptions[reportType];
        descContainer.style.display = 'block';
    } else if (descContainer) {
        descContainer.style.display = 'none';
    }
}

async function handleRunReport(e) {
    if (e) e.preventDefault();

    const reportType = document.getElementById('reportType').value;
    currentReportType = reportType;

    if (reportType === 'route_stats') {
        currentSort = { column: 'route_order_cnt', direction: 'desc' };
        await runRouteStatsReport();
    } else if (reportType === 'carrier_performance') {
        currentSort = { column: 'load_count', direction: 'desc' };
        await runCarrierReport();
    } else if (reportType === 'customer_volume') {
        currentSort = { column: 'load_count', direction: 'desc' };
        await runCustomerReport();
    } else {
        alert('Selected report is not implemented yet.');
    }
}

async function runRouteStatsReport() {
    const pickupCity = document.getElementById('pickupCity').value.trim();
    const deliveryCity = document.getElementById('deliveryCity').value.trim();

    // Note: State inputs are optional filters in this UI, but we grab them if present
    const pickupState = document.getElementById('pickupState').value.trim();
    const deliveryState = document.getElementById('deliveryState').value.trim();

    // Show loading
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingResults').style.display = 'block';

    try {
        // Build query
        let query = supabase.from('route_stats').select('*');

        // Apply filters to 'route' column
        // Route format assumption: "City, State -> City, State" or similar
        // We will use ILIKE logic to match the route string

        if (pickupCity) {
            query = query.ilike('route', `%${pickupCity}%->%`);
        }
        if (pickupState) {
            query = query.ilike('route', `%, ${pickupState}%->%`);
        }
        if (deliveryCity) {
            query = query.ilike('route', `%->%${deliveryCity}%`);
        }
        if (deliveryState) {
            query = query.ilike('route', `%->%, ${deliveryState}%`);
        }

        // If no parameters are provided, limit to top 100 by order count
        if (!pickupCity && !pickupState && !deliveryCity && !deliveryState) {
            query = query.order('route_order_cnt', { ascending: false }).limit(100);

            // Show a toast or notification (using alert for now as simple UI)
            // Or better, just update the UI title or subtitle after results load
        }

        const { data, error } = await query;
        if (error) throw error;

        allResults = data || [];

        // Initial sort by order count desc
        allResults.sort((a, b) => {
            return (parseInt(b.route_order_cnt) || 0) - (parseInt(a.route_order_cnt) || 0);
        });

        filteredResults = [...allResults];
        currentPage = 1;

        if (allResults.length === 0) {
            document.getElementById('loadingResults').style.display = 'none';
            document.getElementById('noResults').style.display = 'block';
        } else {
            displayResults();
        }

    } catch (error) {
        console.error('Report error:', error);
        alert('Error running report: ' + error.message);
        document.getElementById('loadingResults').style.display = 'none';
    }
}

async function runCarrierReport() {
    startLoading();
    try {
        const { data, error } = await supabase
            .from('historical_order_rollup')
            .select('carrier, avg_carrier_price, distance')
            .order('order_date', { ascending: false })
            .limit(1500);

        if (error) throw error;

        const agg = {};
        data.forEach(row => {
            const carrier = row.carrier || 'Unknown';
            if (!agg[carrier]) {
                agg[carrier] = {
                    carrier: carrier,
                    load_count: 0,
                    total_spend: 0,
                    total_distance: 0,
                    avg_price_per_mile: 0
                };
            }
            const price = parseFloat(row.avg_carrier_price) || 0;
            const dist = parseFloat(row.distance) || 0;

            agg[carrier].load_count++;
            agg[carrier].total_spend += price;
            agg[carrier].total_distance += dist;
        });

        allResults = Object.values(agg).map(r => {
            r.avg_price_per_mile = r.total_distance > 0 ? (r.total_spend / r.total_distance) : 0;
            return r;
        });

        finishReportProcessing();

    } catch (error) {
        handleReportError(error);
    }
}

async function runCustomerReport() {
    startLoading();
    try {
        const { data, error } = await supabase
            .from('historical_order_rollup')
            .select('pickup_business, avg_tarriff_price, distance')
            .order('order_date', { ascending: false })
            .limit(1500);

        if (error) throw error;

        const agg = {};
        data.forEach(row => {
            const customer = row.pickup_business || 'Unknown';
            if (!agg[customer]) {
                agg[customer] = {
                    pickup_business: customer,
                    load_count: 0,
                    total_revenue: 0,
                    total_distance: 0,
                    avg_price_per_mile: 0
                };
            }
            const price = parseFloat(row.avg_tarriff_price) || 0;
            const dist = parseFloat(row.distance) || 0;

            agg[customer].load_count++;
            agg[customer].total_revenue += price;
            agg[customer].total_distance += dist;
        });

        allResults = Object.values(agg).map(r => {
            r.avg_price_per_mile = r.total_distance > 0 ? (r.total_revenue / r.total_distance) : 0;
            return r;
        });

        finishReportProcessing();

    } catch (error) {
        handleReportError(error);
    }
}

function startLoading() {
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    document.getElementById('loadingResults').style.display = 'block';
}

function handleReportError(error) {
    console.error('Report error:', error);
    alert('Error running report: ' + error.message);
    document.getElementById('loadingResults').style.display = 'none';
}

function finishReportProcessing() {
    allResults.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];

        // Handle undefined/null
        if (valA === undefined) valA = 0;
        if (valB === undefined) valB = 0;

        return currentSort.direction === 'asc' ? valA - valB : valB - valA;
    });

    filteredResults = [...allResults];
    currentPage = 1;

    if (allResults.length === 0) {
        document.getElementById('loadingResults').style.display = 'none';
        document.getElementById('noResults').style.display = 'block';
    } else {
        displayResults();
    }
}

function displayResults() {
    // Calculate metrics based on currentReportType
    const totalRecords = allResults.length;
    let totalOrders = 0;

    // Metrics variables
    let sumPricePerMile = 0;
    let sumCarrierPrice = 0;
    let sumTarriffPrice = 0;
    let sumDistance = 0;
    let sumTotalRevenue = 0;
    let sumTotalSpend = 0;
    let count = 0;

    allResults.forEach(r => {
        let orderCnt = 0;
        if (currentReportType === 'route_stats') {
            orderCnt = parseInt(r.route_order_cnt) || 0;
        } else {
            orderCnt = r.load_count || 0;
        }
        totalOrders += orderCnt;

        const ppm = parseFloat(r.avg_price_per_mile) || 0;
        const dist = parseFloat(r.avg_distance) || parseFloat(r.total_distance / orderCnt) || 0; // approximate avg dist

        // Route Stats specific
        const carrier = parseFloat(r.avg_carrier_price) || 0;
        const tarriff = parseFloat(r.avg_tarriff_price) || 0;

        // New Reports specific
        const totRev = parseFloat(r.total_revenue) || 0;
        const totSpend = parseFloat(r.total_spend) || 0;

        if (orderCnt > 0) {
            sumPricePerMile += ppm; // Simple average of rows
            sumCarrierPrice += carrier;
            sumTarriffPrice += tarriff;
            sumDistance += dist;
            sumTotalRevenue += totRev;
            sumTotalSpend += totSpend;
            count++;
        }
    });

    const avgPricePerMile = count > 0 ? sumPricePerMile / count : 0;
    const avgCarrierPrice = count > 0 ? sumCarrierPrice / count : 0;
    const avgTarriffPrice = count > 0 ? sumTarriffPrice / count : 0;
    const avgDistance = count > 0 ? sumDistance / count : 0;

    // Update metrics UI
    document.getElementById('totalRoutes').previousElementSibling.textContent = currentReportType === 'route_stats' ? 'Total Routes' : (currentReportType === 'carrier_performance' ? 'Total Carriers' : 'Total Customers');
    document.getElementById('totalRoutes').textContent = totalRecords.toLocaleString();
    document.getElementById('totalOrders').textContent = totalOrders.toLocaleString();
    document.getElementById('avgPricePerMile').textContent = '$' + avgPricePerMile.toFixed(2);

    // Conditional Metrics Logic
    const avgCarrierLabel = document.getElementById('avgCarrierPrice').previousElementSibling;
    const avgCarrierVal = document.getElementById('avgCarrierPrice');
    const avgTarriffLabel = document.getElementById('avgTarriffPrice').previousElementSibling;
    const avgTarriffVal = document.getElementById('avgTarriffPrice');

    if (currentReportType === 'route_stats') {
        avgCarrierLabel.textContent = 'Avg Carrier';
        avgCarrierVal.textContent = '$' + avgCarrierPrice.toFixed(2);

        avgTarriffLabel.textContent = 'Avg Tariiff';
        avgTarriffVal.textContent = '$' + avgTarriffPrice.toFixed(2);
    }
    else if (currentReportType === 'carrier_performance') {
        avgCarrierLabel.textContent = 'Total Spend';
        avgCarrierVal.textContent = '$' + Math.round(sumTotalSpend).toLocaleString();

        // Hide Tarriff for carrier report or use it for something else?
        // Let's show avg spend per load instead
        avgTarriffLabel.textContent = 'Avg Spend/Load';
        avgTarriffVal.textContent = '$' + (totalOrders > 0 ? (sumTotalSpend / totalOrders).toFixed(0) : 0);
    }
    else if (currentReportType === 'customer_volume') {
        avgCarrierLabel.textContent = 'Total Revenue';
        avgCarrierVal.textContent = '$' + Math.round(sumTotalRevenue).toLocaleString();

        avgTarriffLabel.textContent = 'Avg Rev/Load';
        avgTarriffVal.textContent = '$' + (totalOrders > 0 ? (sumTotalRevenue / totalOrders).toFixed(0) : 0);
    }


    document.getElementById('avgDistance').textContent = Math.round(avgDistance).toLocaleString() + ' mi';

    // Display table
    displayTablePage();

    // Show results section
    document.getElementById('loadingResults').style.display = 'none';
    document.getElementById('resultsSection').style.display = 'block';

    // Limit message logic (only for route_stats)
    const pickupCity = document.getElementById('pickupCity').value.trim();
    const pickupState = document.getElementById('pickupState').value.trim();
    const deliveryCity = document.getElementById('deliveryCity').value.trim();
    const deliveryState = document.getElementById('deliveryState').value.trim();

    const limitMsg = document.getElementById('limitMessage');
    if (currentReportType === 'route_stats' && !pickupCity && !pickupState && !deliveryCity && !deliveryState) {
        if (!limitMsg) {
            // Create logic same as before...
            const msgDiv = document.createElement('div');
            msgDiv.id = 'limitMessage';
            msgDiv.className = 'alert alert-info';
            msgDiv.style.marginBottom = '10px';
            msgDiv.style.padding = '10px';
            msgDiv.style.backgroundColor = '#e3f2fd';
            msgDiv.style.color = '#0d47a1';
            msgDiv.style.borderRadius = '4px';
            msgDiv.textContent = 'ℹ️ Showing top 100 routes by volume. Use filters to narrow down results.';
            const container = document.querySelector('.table-container');
            container.parentNode.insertBefore(msgDiv, container);
        } else {
            limitMsg.style.display = 'block';
        }
    } else {
        if (limitMsg) limitMsg.style.display = 'none';
    }
}

function displayTablePage() {
    if (filteredResults.length === 0 && allResults.length > 0) {
        // empty filter
    } else if (allResults.length === 0) {
        return;
    }

    const startIndex = (currentPage - 1) * recordsPerPage;
    const endIndex = startIndex + recordsPerPage;
    const pageResults = filteredResults.slice(startIndex, endIndex);

    const tbody = document.getElementById('resultsBody');
    const thead = document.getElementById('resultsTableHead');

    // Define columns to show - user friendly subset
    let columnsToShow = [];

    if (currentReportType === 'route_stats') {
        columnsToShow = [
            'route',
            'route_order_cnt',
            'avg_price_per_mile',
            'avg_carrier_price',
            'avg_tarriff_price',
            'avg_distance',
            'total_vehicles'
        ];
    } else if (currentReportType === 'carrier_performance') {
        columnsToShow = [
            'carrier',
            'load_count',
            'avg_price_per_mile',
            'total_spend'
        ];
    } else if (currentReportType === 'customer_volume') {
        columnsToShow = [
            'pickup_business',
            'load_count',
            'avg_price_per_mile',
            'total_revenue'
        ];
    }

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

    pageResults.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = columnsToShow.map(col => {
            const value = formatValue(col, row[col]);
            return `<td>${value}</td>`;
        }).join('');
        tbody.appendChild(tr);
    });

    // Update pagination
    const totalPages = Math.ceil(filteredResults.length / recordsPerPage) || 1;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages} (${filteredResults.length.toLocaleString()} routes)`;
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
                currentSort.direction = 'desc'; // Default to desc for most stats
            }

            // Sort filteredResults
            filteredResults.sort((a, b) => {
                let valA = a[column];
                let valB = b[column];

                if (valA === null) valA = 0;
                if (valB === null) valB = 0;

                // All these cols are numeric except route
                if (column !== 'route') {
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
    const columns = Object.keys(columnMapping);
    const headers = columns.map(col => columnMapping[col]);
    const csvRows = [headers.join(',')];

    allResults.forEach(row => {
        const csvRow = columns.map(col => {
            let cell = formatValue(col, row[col]);
            // Escape quotes
            if (typeof cell === 'string' && cell.includes(',')) {
                cell = `"${cell}"`;
            }
            return cell;
        });
        csvRows.push(csvRow.join(','));
    });

    // Download CSV
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-stats-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

function formatValue(col, value) {
    if (value === null || value === undefined) return '';

    if (col.includes('price') || col.includes('spend') || col.includes('revenue')) {
        return '$' + parseFloat(value).toFixed(2);
    }
    if (col === 'route_order_cnt' || col === 'total_vehicles') {
        return parseInt(value).toLocaleString();
    }
    if (col.includes('distance')) {
        return Math.round(parseFloat(value)).toLocaleString();
    }

    if (col === 'route') {
        // Expected format: "City, State -> City, State" or just "City -> City"
        // Try to parse out pickup/delivery
        // Example: "Dallas, TX -> Austin, TX"
        const parts = value.split('->').map(s => s.trim());
        if (parts.length === 2) {
            const pickup = parts[0];
            const delivery = parts[1];

            // Further parse City, State?
            // Simple approach: pass entire string as pickupCity/deliveryCity if no comma? 
            // Or try to split by comma.

            let pCity = pickup, pState = '';
            if (pickup.includes(',')) {
                const pParts = pickup.split(',');
                pCity = pParts[0].trim();
                pState = pParts[1].trim();
            }

            let dCity = delivery, dState = '';
            if (delivery.includes(',')) {
                const dParts = delivery.split(',');
                dCity = dParts[0].trim();
                dState = dParts[1].trim();
            }

            // Encode params
            const params = new URLSearchParams();
            if (pCity) params.set('pickupCity', pCity);
            if (pState) params.set('pickupState', pState);
            if (dCity) params.set('deliveryCity', dCity);
            if (dState) params.set('deliveryState', dState);

            const url = `dashboard.html?${params.toString()}`;
            return `<a href="${url}" style="text-decoration: underline; color: #0d47a1;">${value}</a>`;
        }
        return value;
    }

    return value;
}

function handleClear() {
    document.getElementById('searchForm').reset();
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('noResults').style.display = 'none';
    allResults = [];
    filteredResults = [];
}

function changePage(delta) {
    const totalPages = Math.ceil(filteredResults.length / recordsPerPage);
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        displayTablePage();
    }
}
