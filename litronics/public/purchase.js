/**
 * Litronics Product Management System - Purchase Module JavaScript
 * Handles Purchase Orders, Batch Creation, and Item Tracking
 */

// =============================================================================
// Global Data Storage
// =============================================================================

let purchaseOrdersData = []; // Flat list of all items (since backend returns Line Items)
let productsForPurchase = [];
let suppliersForPurchase = [];
let currencyRatesForPurchase = { USD: 83.50, RMB: 11.50, INR: 1 };

// Batch Order State
let currentBatchItems = [];
let activeTab = 'orders';
let selectedOrderCurrency = 'INR'; // Order-level currency
let productSelectionDone = false; // Track if Done was clicked
let editingPurchaseId = null; // Track which purchase order is being edited (null = creating new)

// Choices.js instances
let productChoices = null;
let purchaseSupplierChoices = null;

// =============================================================================
// Initialize Purchase Module
// =============================================================================

function initializePurchaseModule() {
    try {
        console.log('Initializing Purchase Module...');
        const purchaseView = document.getElementById('purchase-view');
        if (!purchaseView) return;

        initializePurchaseChoices();
        loadProductsForPurchase();
        loadSuppliersForPurchase();
        loadCurrencyRatesForPurchase();

        switchPurchaseTab('orders');
        loadPurchaseOrders();

        setupPurchaseEventListeners();
        setupPaymentFormListener();
        setupPaymentFilterListeners();
        setupCurrencySelection();
        setupOtherChargesListeners();

        console.log('Purchase Module Initialized Successfully');
    } catch (e) {
        console.error('Error initializing purchase module:', e);
    }
}

// =============================================================================
// Initialize Choices.js
// =============================================================================

function initializePurchaseChoices() {
    const productSelect = document.getElementById('purchase-product-id');
    if (productSelect) {
        if (productChoices) productChoices.destroy();
        productChoices = new Choices('#purchase-product-id', {
            searchEnabled: true,
            searchPlaceholderValue: 'Search products...',
            itemSelectText: '',
            allowHTML: true,
            placeholder: true,
            placeholderValue: 'Select a product',
            shouldSort: false
        });
    }

    const supplierSelect = document.getElementById('purchase-common-supplier');
    if (supplierSelect) {
        if (purchaseSupplierChoices) purchaseSupplierChoices.destroy();
        purchaseSupplierChoices = new Choices('#purchase-common-supplier', {
            searchEnabled: true,
            searchPlaceholderValue: 'Search suppliers...',
            itemSelectText: '',
            allowHTML: true,
            placeholder: true,
            placeholderValue: 'Select a supplier',
        });
    }
}

// =============================================================================
// API Calls
// =============================================================================

async function fetchPurchaseAPI(endpoint, options = {}) {
    try {
        const url = `${API_BASE}${endpoint}`;
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });

        const data = await response.json().catch(() => ({})); // Try to parse JSON anyway

        if (!response.ok) {
            const errorMsg = data.detail || data.error || `HTTP error! status: ${response.status}`;
            throw new Error(errorMsg);
        }
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showPurchaseToast(error.message, 'error');
        return { success: false, error: error.message };
    }
}

// =============================================================================
// Data Loading
// =============================================================================

async function loadProductsForPurchase() {
    const result = await fetchPurchaseAPI('/products');
    if (result.success || result.data || Array.isArray(result)) {
        productsForPurchase = result.data || result;

        const choicesData = productsForPurchase.map(p => ({
            value: p.id,
            label: `${p.part_code} - ${p.description}`,
            customProperties: p
        }));

        if (productChoices) {
            productChoices.clearStore();
            productChoices.setChoices(choicesData, 'value', 'label', true);
        }
    }
}

async function loadSuppliersForPurchase() {
    const result = await fetchPurchaseAPI('/suppliers');
    if (result.success || result.data || Array.isArray(result)) {
        suppliersForPurchase = result.data || result;

        const choicesData = suppliersForPurchase.map(s => ({
            value: s.id,
            label: s.supplier_name
        }));

        if (purchaseSupplierChoices) {
            purchaseSupplierChoices.clearStore();
            purchaseSupplierChoices.setChoices(choicesData, 'value', 'label', true);
        }

        // Populate Filter Dropdown
        const filterSel = document.getElementById('filter-supplier');
        if (filterSel) {
            filterSel.innerHTML = '<option value="">All Suppliers</option>';
            suppliersForPurchase.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.supplier_name.toLowerCase();
                opt.textContent = s.supplier_name;
                filterSel.appendChild(opt);
            });
        }
    }
}

async function loadCurrencyRatesForPurchase() {
    const result = await fetchPurchaseAPI('/currency-rates');
    if (result.success || result.data || Array.isArray(result)) {
        const data = result.data || result;
        data.forEach(rate => {
            currencyRatesForPurchase[rate.currency_code] = parseFloat(rate.rate_to_inr);
        });
    }
}

async function loadPurchaseOrders() {
    console.log('Loading Purchase Orders...');
    const result = await fetchPurchaseAPI('/purchase-orders');
    console.log('Purchase Orders Result:', result);

    if (result.success || result.data || Array.isArray(result)) {
        purchaseOrdersData = result.data || result;
        if (!Array.isArray(purchaseOrdersData)) purchaseOrdersData = [];

        renderCurrentView();
        updateStats();
    } else {
        console.warn('Failed to load purchase orders', result);
    }
}

// =============================================================================
// Tab Switching & Rendering
// =============================================================================

window.switchPurchaseTab = function (tab) {
    activeTab = tab;

    // Update buttons
    document.querySelectorAll('.view-tabs button').forEach(b => b.classList.remove('active'));
    const activeBtn = document.getElementById(`tab-${tab}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Toggle Filter Bars
    const ordersFilterBar = document.getElementById('orders-filter-bar');
    const filterBar = document.getElementById('purchase-filter-bar');
    const paymentsFilterBar = document.getElementById('payments-filter-bar');

    if (ordersFilterBar) ordersFilterBar.style.display = tab === 'orders' ? 'flex' : 'none';
    if (filterBar) filterBar.style.display = tab === 'items' ? 'flex' : 'none';
    if (paymentsFilterBar) paymentsFilterBar.style.display = tab === 'payments' ? 'flex' : 'none';

    // Refresh view
    renderCurrentView();
}

function renderCurrentView() {
    if (activeTab === 'orders') {
        renderGroupedOrders();
    } else if (activeTab === 'payments') {
        loadAndRenderPayments();
    } else {
        renderFlatItems();
    }
}

function renderGroupedOrders() {
    const thead = document.getElementById('purchase-table-head');
    const tbody = document.getElementById('purchase-orders-tbody');
    if (!thead || !tbody) return;

    // Headers for Order View
    thead.innerHTML = `
        <tr>
            <th>Order # / Purchase ID</th>
            <th>Placed By</th>
            <th>Del. Type</th>
            <th>Date</th>
            <th>Supplier</th>
            <th>Items</th>
            <th>Total Value</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;

    // --- Reset Stats Card for Orders View ---
    const totalValueCard = document.getElementById('total-purchase-value');
    const totalValueLabel = totalValueCard?.parentElement?.querySelector('.stat-label');

    if (totalValueLabel) totalValueLabel.textContent = "Total Value";
    if (totalValueCard) {
        // Re-calculate Total Value from purchaseOrdersData
        const total = purchaseOrdersData.reduce((sum, o) => sum + parseFloat(o.final_total || 0), 0);
        totalValueCard.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
    // ----------------------------------------

    // Group items by purchase_id + order_number
    const groups = {};
    purchaseOrdersData.forEach(item => {
        const key = item.purchase_id || item.order_number;
        if (!groups[key]) {
            groups[key] = {
                id: item.purchase_id,
                order_number: item.order_number,
                order_placed_by: item.order_placed_by,
                order_date: item.order_date,
                delivery_date: item.delivery_date,
                delivery_type: item.delivery_type,
                delivery_date: item.delivery_date,
                supplier_name: item.supplier_name,
                price_currency: item.price_currency,
                items_count: 0,
                total_value: 0,
                status: item.pi_status,
                items: []
            };
        }
        // Use the earliest delivery_date across items for the group
        if (item.delivery_date && (!groups[key].delivery_date || item.delivery_date < groups[key].delivery_date)) {
            groups[key].delivery_date = item.delivery_date;
        }
        groups[key].items_count++;
        groups[key].total_value += parseFloat(item.final_total || 0);
        groups[key].items.push(item);
    });

    // Compute aggregate status for each group based on all items
    Object.values(groups).forEach(group => {
        const allComplete = group.items.every(i => {
            const ordered = parseInt(i.quantity) || 1;
            const dispatched = parseInt(i.dispatched_quantity) || 0;
            const sc = parseInt(i.short_closed_quantity) || 0;
            return (dispatched + sc) >= ordered;
        });
        const anyDispatched = group.items.some(i => (parseInt(i.dispatched_quantity) || 0) > 0);
        const anyShortClosed = group.items.some(i => (parseInt(i.short_closed_quantity) || 0) > 0);
        const allFullyDispatched = group.items.every(i => (parseInt(i.dispatched_quantity) || 0) >= (parseInt(i.quantity) || 1));

        if (allFullyDispatched) {
            group.status = 'dispatched';
        } else if (allComplete && anyShortClosed) {
            group.status = 'short_closed';
        } else if (anyDispatched || anyShortClosed) {
            group.status = 'partially_dispatched';
        } else {
            group.status = group.items[0]?.pi_status || 'open';
        }
    });

    // Populate the orders-supplier dropdown dynamically
    const supplierSelect = document.getElementById('filter-orders-supplier');
    if (supplierSelect) {
        const currentVal = supplierSelect.value;
        const uniqueSuppliers = [...new Set(Object.values(groups).map(g => g.supplier_name).filter(Boolean))].sort();
        supplierSelect.innerHTML = '<option value="">All Suppliers</option>' + uniqueSuppliers.map(s => `<option value="${s}">${s}</option>`).join('');
        supplierSelect.value = currentVal;
    }

    // Apply orders-tab filters
    const fDeliveryDate = document.getElementById('filter-orders-delivery-date')?.value || '';
    const fOrdersStatus = document.getElementById('filter-orders-status')?.value || '';
    const fOrdersSupplier = document.getElementById('filter-orders-supplier')?.value || '';

    let filteredGroups = Object.values(groups);

    if (fDeliveryDate) {
        const filterDate = new Date(fDeliveryDate);
        filterDate.setHours(23, 59, 59, 999);
        filteredGroups = filteredGroups.filter(g => {
            if (!g.delivery_date) return false;
            return new Date(g.delivery_date) <= filterDate;
        });
    }
    if (fOrdersStatus) {
        filteredGroups = filteredGroups.filter(g => g.status === fOrdersStatus);
    }
    if (fOrdersSupplier) {
        filteredGroups = filteredGroups.filter(g => g.supplier_name === fOrdersSupplier);
    }

    const sortedGroups = filteredGroups.sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

    // Store filtered groups for export
    window._lastFilteredOrderGroups = sortedGroups;

    tbody.innerHTML = '';
    if (sortedGroups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 30px;">No orders found matching filters.</td></tr>';
        return;
    }

    sortedGroups.forEach((group, index) => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        tr.style.animationDelay = `${index * 0.05}s`;

        const date = group.order_date ? new Date(group.order_date).toLocaleDateString('en-IN') : '-';
        const delivery_type = group.delivery_type ? group.delivery_type.charAt(0).toUpperCase() + group.delivery_type.slice(1) : '-';
        
        let currencySymbol = '₹';
        if (group.price_currency === 'USD') currencySymbol = '$';
        if (group.price_currency === 'RMB') currencySymbol = '¥';

        tr.innerHTML = `
            <td>
                <strong>${group.order_number}</strong><br>
                <small class="text-muted" style="color:var(--text-muted)">${group.id}</small>
            </td>
            <td>${group.order_placed_by}</td>
            <td>${delivery_type}</td>
            <td>${date}</td>
            <td>${group.supplier_name || '-'}</td>
            <td>${group.items_count}</td>
            <td style="font-weight:600;">${currencySymbol}${group.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td><span class="status-badge status-${group.status}">${group.status?.toUpperCase() || 'OPEN'}</span></td>
            <td>
                <div class="table-actions-cell">
                    <button class="action-btn" onclick="openPurchaseModalWithItems('${group.id}')" title="View Items">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="editPurchaseOrder('${group.id}')" title="Edit Order">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="deletePurchaseBatch('${group.id}')" title="Delete Order" style="color: #ef4444;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                    ${['open', 'confirmed', 'ready_to_dispatch', 'partially_dispatched'].includes(group.status) ? `
                    <button class="btn btn-sm btn-success" onclick="openDispatchPopup('${group.id}')" title="Dispatch">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        Dispatch
                    </button>
                    ` : (group.status === 'dispatched' ? `<span class="status-badge status-dispatched">✓ Fully Dispatched</span>` : (group.status === 'short_closed' ? `<span class="status-badge" style="background: #fef3c7; color: #92400e;">⚠ Short Closed</span>` : ''))}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderFlatItems() {
    const thead = document.getElementById('purchase-table-head');
    const tbody = document.getElementById('purchase-orders-tbody');
    if (!thead || !tbody) return;

    // Headers for Item View
    thead.innerHTML = `
        <tr>
            <th>Purchase ID</th>
            <th>Part Code</th>
            <th>Supplier</th>
            <th>Status</th>
            <th>Delivery Date</th>
            <th>Total (INR)</th>
            <th>Action</th>
        </tr>
    `;

    tbody.innerHTML = '';
    if (purchaseOrdersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px;">No items found.</td></tr>';
        return;
    }

    // Filter Logic
    let filteredData = purchaseOrdersData;

    // 1. Global Search
    const globalQuery = document.getElementById('purchase-search-input')?.value.toLowerCase();
    if (globalQuery) {
        filteredData = filteredData.filter(item =>
            (item.purchase_id && item.purchase_id.toLowerCase().includes(globalQuery)) ||
            (item.order_number && item.order_number.toLowerCase().includes(globalQuery)) ||
            (item.part_code && item.part_code.toLowerCase().includes(globalQuery)) ||
            (item.supplier_name && item.supplier_name.toLowerCase().includes(globalQuery))
        );
    }

    // 2. Specific Filters
    const fId = document.getElementById('filter-purchase-id')?.value.toLowerCase();
    const fPart = document.getElementById('filter-part-code')?.value.toLowerCase();
    const fSupp = document.getElementById('filter-supplier')?.value.toLowerCase();
    const fStat = document.getElementById('filter-status')?.value.toLowerCase();
    const fDate = document.getElementById('filter-delivery-date')?.value;

    if (fId || fPart || fSupp || fStat || fDate) {
        filteredData = filteredData.filter(item => {
            const matchId = !fId || (item.purchase_id && item.purchase_id.toLowerCase().includes(fId));
            const matchPart = !fPart || (item.part_code && item.part_code.toLowerCase().includes(fPart));
            const matchSupp = !fSupp || (item.supplier_name && item.supplier_name.toLowerCase().includes(fSupp));
            const matchStat = !fStat || (item.pi_status && item.pi_status.toLowerCase() === fStat);

            let matchDate = true;
            if (fDate && item.delivery_date) {
                const itemDate = item.delivery_date.split('T')[0];
                matchDate = itemDate === fDate;
            } else if (fDate) matchDate = false;

            return matchId && matchPart && matchSupp && matchStat && matchDate;
        });
    }

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px;">No items match filters.</td></tr>';
        return;
    }

    filteredData.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        tr.style.animationDelay = `${index * 0.05}s`;

        const deliveryDate = item.delivery_date ? new Date(item.delivery_date).toLocaleDateString('en-IN') : '-';

        tr.innerHTML = `
            <td>${item.purchase_id}</td>
            <td><strong>${item.part_code}</strong><br><small style="color:var(--text-muted)">${item.item_description?.substring(0, 25)}...</small></td>
            <td>${item.supplier_name || '-'}</td>
            <td><span class="status-badge status-${item.pi_status}">${item.pi_status.replace('_', ' ').toUpperCase()}</span></td>
            <td>${deliveryDate}</td>
            <td>₹${parseFloat(item.final_total || 0).toFixed(2)}</td>
            <td>
                ${(item.pi_status === 'open' || item.pi_status === 'confirmed') ?
                `<button class="btn btn-sm btn-success" onclick="updateItemStatus(${item.id}, 'ready_to_dispatch')" title="Mark as Ready to Dispatch">Ready to Dispatch</button>` :
                (item.pi_status === 'ready_to_dispatch' ? `<span style="color:var(--success); font-weight: 600;">✓ Ready</span>` :
                    (item.pi_status === 'dispatched' || item.pi_status === 'shipped' ? `<span style="color:var(--warning);">En Route</span>` :
                        (item.pi_status === 'delivered' ? `<span style="color:var(--text-muted);">Delivered</span>` : '-')))}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function updateItemStatus(itemId, status) {
    const result = await fetchPurchaseAPI(`/purchase-orders/${itemId}/status?status=${status}`, { method: 'PATCH' });
    if (result.success) {
        showPurchaseToast(`Status updated to ${status}`, 'success');
        loadPurchaseOrders();
    }
}

// Mark all items in a purchase order as ready to dispatch
// Track which purchase ID the dispatch popup is currently showing
let dispatchPopupPurchaseId = null;

window.openDispatchPopup = function (purchaseId) {
    dispatchPopupPurchaseId = purchaseId;
    const orders = purchaseOrdersData.filter(o => o.purchase_id === purchaseId);
    if (orders.length === 0) {
        showPurchaseToast('No items found for this order', 'error');
        return;
    }

    const first = orders[0];
    const overlay = document.getElementById('dispatch-popup-overlay');
    const titleEl = document.getElementById('dispatch-popup-title');
    const infoEl = document.getElementById('dispatch-popup-info');
    const tbody = document.getElementById('dispatch-popup-items-tbody');

    // Set title
    titleEl.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" style="vertical-align: -3px; margin-right: 8px;">
            <rect x="1" y="3" width="15" height="13"/>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        Dispatch — ${first.order_number} <small style="color:var(--text-muted); font-weight:400;">(${purchaseId})</small>
    `;

    // Order info bar
    const currSym = first.price_currency === 'USD' ? '$' : first.price_currency === 'RMB' ? '¥' : '₹';
    const totalVal = orders.reduce((s, o) => s + parseFloat(o.final_total || 0), 0);
    infoEl.innerHTML = `
        <div><strong>Supplier:</strong> ${first.supplier_name || '-'}</div>
        <div><strong>Date:</strong> ${first.order_date ? new Date(first.order_date).toLocaleDateString('en-IN') : '-'}</div>
        <div><strong>Currency:</strong> ${first.price_currency || 'INR'}</div>
        <div><strong>Total Value:</strong> ${currSym}${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        <div><strong>Items:</strong> ${orders.length}</div>
    `;

    // Build items table
    tbody.innerHTML = '';
    orders.forEach((item, idx) => {
        const ordered = parseInt(item.quantity) || 0;
        const dispatched = parseInt(item.dispatched_quantity) || 0;
        const shortClosed = parseInt(item.short_closed_quantity) || 0;
        const remaining = ordered - dispatched - shortClosed;
        const isComplete = remaining <= 0;

        const tr = document.createElement('tr');
        if (isComplete) {
            tr.style.opacity = '0.5';
        }
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><strong>${item.part_code || '-'}</strong></td>
            <td>${item.item_description || '-'}</td>
            <td style="text-align:center;">${ordered}</td>
            <td style="text-align:center;">
                ${dispatched > 0 ? `<span style="color: #10b981; font-weight:600;">${dispatched}</span>` : '0'}
            </td>
            <td style="text-align:center;">
                ${shortClosed > 0 ? `<span style="color: #f59e0b; font-weight:600;">${shortClosed}</span>` : '0'}
            </td>
            <td style="text-align:center;">
                ${isComplete
                ? `<span style="color: var(--text-muted); font-weight:600;">0</span>`
                : `<span style="font-weight:600;">${remaining}</span>`}
            </td>
            <td style="text-align:center;">
                ${isComplete ? '-' : `
                    <input type="number" class="dispatch-qty-input" data-item-id="${item.id}" 
                        data-max="${remaining}" min="0" max="${remaining}" value="0"
                        style="width: 80px; padding: 6px 8px; border: 1px solid var(--border-color); border-radius: 6px; text-align: center; font-size: 0.9rem;"
                        onchange="validateDispatchQty(this)">
                `}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Show overlay
    overlay.classList.add('active');
}

window.closeDispatchPopup = function () {
    const overlay = document.getElementById('dispatch-popup-overlay');
    if (overlay) overlay.classList.remove('active');
    dispatchPopupPurchaseId = null;
}

window.validateDispatchQty = function (input) {
    const max = parseInt(input.dataset.max) || 0;
    let val = parseInt(input.value) || 0;
    if (val < 0) val = 0;
    if (val > max) val = max;
    input.value = val;
}

window.submitPurchaseDispatch = async function () {
    if (!dispatchPopupPurchaseId) return;

    const inputs = document.querySelectorAll('.dispatch-qty-input');
    const items = [];
    let totalDispatch = 0;

    inputs.forEach(inp => {
        const qty = parseInt(inp.value) || 0;
        if (qty > 0) {
            items.push({ id: parseInt(inp.dataset.itemId), dispatch_qty: qty });
            totalDispatch += qty;
        }
    });

    if (totalDispatch === 0) {
        showPurchaseToast('Please enter dispatch quantity for at least one item.', 'error');
        return;
    }

    if (!confirm(`Dispatch ${totalDispatch} unit(s) for this order?`)) return;

    const result = await fetchPurchaseAPI('/purchase-orders/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_id: dispatchPopupPurchaseId, items })
    });

    if (result.success) {
        showPurchaseToast(result.message || 'Items dispatched successfully!', 'success');
        closeDispatchPopup();
        loadPurchaseOrders();
    } else {
        showPurchaseToast(result.detail || result.message || 'Failed to dispatch items.', 'error');
    }
}

window.submitPurchaseShortClose = async function () {
    if (!dispatchPopupPurchaseId) return;

    const inputs = document.querySelectorAll('.dispatch-qty-input');
    const items = [];
    let totalShortClose = 0;

    inputs.forEach(inp => {
        const qty = parseInt(inp.value) || 0;
        if (qty > 0) {
            items.push({ id: parseInt(inp.dataset.itemId), dispatch_qty: qty });
            totalShortClose += qty;
        }
    });

    if (totalShortClose === 0) {
        showPurchaseToast('Please enter quantity to short-close for at least one item.', 'error');
        return;
    }

    if (!confirm(`Short Close ${totalShortClose} unit(s)? These units will be marked as cancelled/unfulfilled. Remaining quantities will stay open for future dispatch.`)) return;

    const result = await fetchPurchaseAPI('/purchase-orders/short-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchase_id: dispatchPopupPurchaseId, items })
    });

    if (result.success) {
        showPurchaseToast(result.message || 'Items short-closed successfully!', 'success');
        closeDispatchPopup();
        loadPurchaseOrders();
    } else {
        showPurchaseToast(result.detail || result.message || 'Failed to short-close items.', 'error');
    }
}

// =============================================================================
// Orders Filter & Export
// =============================================================================

window.clearOrdersFilters = function () {
    ['filter-orders-delivery-date', 'filter-orders-status', 'filter-orders-supplier'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderCurrentView();
}

window.exportOrdersToExcel = function () {
    const groups = window._lastFilteredOrderGroups;
    if (!groups || groups.length === 0) {
        showPurchaseToast('No orders to export. Adjust your filters.', 'error');
        return;
    }

    // Build query params from current filters
    const params = new URLSearchParams();
    const deliveryDate = document.getElementById('filter-orders-delivery-date')?.value;
    const status = document.getElementById('filter-orders-status')?.value;
    const supplier = document.getElementById('filter-orders-supplier')?.value;

    if (deliveryDate) params.set('delivery_date', deliveryDate);
    if (status) params.set('status', status);
    if (supplier) params.set('supplier', supplier);

    // Download the file from backend
    const url = `/api/purchase-orders/export-excel?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showPurchaseToast(`Exporting ${groups.length} order(s) to Excel...`, 'success');
}

// =============================================================================
// Batch / Add Item Logic
// =============================================================================

function setupPurchaseEventListeners() {
    const productSelect = document.getElementById('purchase-product-id');
    if (productSelect) {
        productSelect.addEventListener('change', async (e) => {
            const productId = parseInt(e.target.value);
            if (!productId) return;
            const product = productsForPurchase.find(p => p.id === productId);
            if (product) {
                safeSetValue('purchase-part-code', product.part_code || '');
                safeSetValue('purchase-item-description', product.description || '');
                safeSetValue('purchase-hsn-code', product.hsn_code || '');
                safeSetValue('purchase-category-name', product.category_name || '');
                safeSetValue('purchase-price-usd', product.unit_price_usd || 0);
                safeSetValue('purchase-price-rmb', product.unit_price_rmb || 0);
                safeSetValue('purchase-price-inr', product.unit_price_inr || 0);
                safeSetValue('purchase-price-currency', selectedOrderCurrency);
                updateUnitDisplay();
                loadLast3Prices(productId);
            }
        });
    }

    const searchInput = document.getElementById('purchase-search-input');
    if (searchInput) searchInput.addEventListener('input', () => renderCurrentView());

    ['filter-purchase-id', 'filter-part-code', 'filter-supplier', 'filter-status', 'filter-delivery-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderCurrentView);
    });

    // Orders tab filters
    ['filter-orders-delivery-date', 'filter-orders-status', 'filter-orders-supplier'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', renderCurrentView);
    });

    document.getElementById('add-item-to-batch-btn')?.addEventListener('click', addItemToBatch);
    document.getElementById('submit-batch-order-btn')?.addEventListener('click', submitBatchOrder);
}

function setupCurrencySelection() {
    document.querySelectorAll('input[name="order-currency"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            selectedOrderCurrency = e.target.value;
            safeSetValue('purchase-price-currency', selectedOrderCurrency);
            updateCurrencyUI();
            updateUnitDisplay();
            updateOrderSummary();
        });
    });
}

function setupOtherChargesListeners() {
    ['purchase-order-other-charges', 'purchase-order-gst-percentage'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateOrderSummary);
    });
    const gstCheck = document.getElementById('purchase-order-gst-applicable');
    if (gstCheck) gstCheck.addEventListener('change', updateOrderSummary);
}

function updateCurrencyUI() {
    const symbols = { USD: '$', RMB: '¥', INR: '₹' };
    const sym = symbols[selectedOrderCurrency] || '₹';
    const symEl = document.getElementById('purchase-currency-symbol');
    if (symEl) symEl.textContent = sym;
    const lbl = document.getElementById('item-currency-label');
    if (lbl) lbl.textContent = selectedOrderCurrency;

    const infoEl = document.getElementById('order-currency-info');
    if (infoEl) {
        if (selectedOrderCurrency === 'INR') {
            infoEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> INR selected — Duties & GST will apply`;
        } else {
            infoEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg> ${selectedOrderCurrency} selected — No duties or additional charges`;
        }
    }

    // Show/hide other charges section based on Done state
    const otherSection = document.getElementById('other-charges-section');
    if (otherSection) {
        otherSection.style.display = productSelectionDone ? 'block' : 'none';
    }
    // Update Other Charges currency symbol
    const ocSymEl = document.getElementById('other-charges-currency-symbol');
    if (ocSymEl) ocSymEl.textContent = sym;
    // GST section only for INR
    const gstSection = document.getElementById('gst-section');
    if (gstSection) gstSection.style.display = selectedOrderCurrency === 'INR' ? 'flex' : 'none';
    const summaryOC = document.getElementById('summary-other-charges-box');
    const summaryGST = document.getElementById('summary-gst-box');
    if (summaryOC) summaryOC.style.display = '';
    if (summaryGST) summaryGST.style.display = selectedOrderCurrency === 'INR' ? '' : 'none';
}

function updateUnitDisplay() {
    const currency = selectedOrderCurrency;
    const symEl = document.getElementById('purchase-currency-symbol');
    const unitIn = document.getElementById('purchase-unit-price');
    const symbols = { USD: '$', RMB: '¥', INR: '₹' };
    if (symEl) symEl.textContent = symbols[currency] || '₹';
    if (unitIn) {
        if (currency === 'USD') unitIn.value = document.getElementById('purchase-price-usd')?.value || '';
        else if (currency === 'RMB') unitIn.value = document.getElementById('purchase-price-rmb')?.value || '';
        else unitIn.value = document.getElementById('purchase-price-inr')?.value || '';
    }
}

function updateOrderSummary() {
    const symbols = { USD: '$', RMB: '¥', INR: '₹' };
    const sym = symbols[selectedOrderCurrency] || '₹';
    const itemCount = currentBatchItems.length;
    let subtotal = 0;
    currentBatchItems.forEach(item => { subtotal += item.unit_price * item.quantity; });

    let otherCharges = 0, gstAmount = 0, gstPct = 18;
    otherCharges = parseFloat(document.getElementById('purchase-order-other-charges')?.value || 0);
    // GST only for INR
    if (selectedOrderCurrency === 'INR') {
        const gstApplicable = document.getElementById('purchase-order-gst-applicable')?.checked !== false;
        gstPct = parseFloat(document.getElementById('purchase-order-gst-percentage')?.value || 18);
        if (gstApplicable) gstAmount = (subtotal + otherCharges) * (gstPct / 100);
    }
    const finalTotal = subtotal + otherCharges + gstAmount;

    const dec = selectedOrderCurrency === 'INR' ? 2 : 6;
    document.getElementById('summary-item-count').textContent = itemCount;
    document.getElementById('summary-subtotal').textContent = `${sym}${subtotal.toFixed(dec)}`;
    document.getElementById('summary-other-charges').textContent = `${sym}${otherCharges.toFixed(2)}`;
    document.getElementById('summary-gst-amount').textContent = `${sym}${gstAmount.toFixed(2)}`;
    document.getElementById('summary-gst-pct').textContent = gstPct;
    document.getElementById('summary-final-total').textContent = `${sym}${finalTotal.toFixed(dec)}`;

    // Show Done button if items exist
    const doneBtn = document.getElementById('done-product-selection-btn');
    if (doneBtn) doneBtn.style.display = currentBatchItems.length > 0 ? 'inline-flex' : 'none';
}

window.doneProductSelection = function () {
    productSelectionDone = true;
    const section = document.getElementById('product-selection-section');
    if (section) section.style.display = 'none';
    // Show Other Charges for all currencies
    const otherSection = document.getElementById('other-charges-section');
    if (otherSection) { otherSection.style.display = 'block'; otherSection.classList.add('visible'); }
    showPurchaseToast(`${currentBatchItems.length} product(s) selected. Configure charges and save.`, 'success');
    updateOrderSummary();
}

window.reopenProductSelection = function () {
    productSelectionDone = false;
    const section = document.getElementById('product-selection-section');
    if (section) section.style.display = 'block';
    const otherSection = document.getElementById('other-charges-section');
    if (otherSection) { otherSection.style.display = 'none'; otherSection.classList.remove('visible'); }
}

async function loadLast3Prices(productId) {
    const display = document.getElementById('last-prices-display');
    const list = document.getElementById('last-prices-list');
    if (!display || !list) return;

    display.style.display = 'none';
    list.innerHTML = 'Loading...';

    const result = await fetchPurchaseAPI(`/products/${productId}/purchase-history`);
    if (result.success) {
        if (result.data && result.data.length > 0) {
            display.style.display = 'block';
            list.innerHTML = '';

            result.data.forEach(h => {
                const div = document.createElement('div');
                div.style.background = 'var(--bg-input)';
                div.style.padding = '5px 10px';
                div.style.border = '1px solid var(--border-color)';
                div.style.borderRadius = '4px';
                div.style.fontSize = '0.85em';

                div.innerHTML = `
                    <span style="color:var(--text-muted); margin-right:5px;">${h.order_date}</span> 
                    <strong>${h.currency} ${parseFloat(h.unit_price).toFixed(h.currency === 'INR' ? 3 : 6)}</strong>
                    <span style="color:var(--text-muted); font-size: 0.9em; margin-left:5px;">(${h.supplier_name})</span>
                `;
                list.appendChild(div);
            });
        } else {
            display.style.display = 'block';
            list.innerHTML = '<span style="color:var(--text-muted); font-style: italic;">No purchase history.</span>';
        }
    }
}

function addItemToBatch() {
    const pid = document.getElementById('purchase-product-id').value;
    const qty = document.getElementById('purchase-quantity').value;
    const price = document.getElementById('purchase-unit-price').value;
    const currency = selectedOrderCurrency;

    if (!qty || !price) {
        showPurchaseToast('Please select product, quantity and price.', 'error');
        return;
    }

    const totalLine = parseFloat(price) * parseInt(qty);

    const newItem = {
        tempId: Date.now(),
        product_id: pid ? parseInt(pid) : null,
        part_code: document.getElementById('purchase-part-code').value,
        item_description: document.getElementById('purchase-item-description').value,
        hsn_code: document.getElementById('purchase-hsn-code').value,
        category_name: document.getElementById('purchase-category-name').value,
        quantity: parseInt(qty),
        price_currency: currency,
        price_usd: parseFloat(document.getElementById('purchase-price-usd').value) || 0,
        price_rmb: parseFloat(document.getElementById('purchase-price-rmb').value) || 0,
        price_inr: parseFloat(document.getElementById('purchase-price-inr').value) || 0,
        unit_price: parseFloat(price),
        other_charges: 0,
        gst_applicable: currency === 'INR',
        gst_percentage: currency === 'INR' ? 18 : 0,
        total_estimated: totalLine
    };

    if (editingItemIndex > -1) {
        const original = currentBatchItems[editingItemIndex];
        const hasChanges = original.quantity !== newItem.quantity || original.unit_price !== newItem.unit_price || original.part_code !== newItem.part_code;
        if (!hasChanges) {
            showPurchaseToast('No changes were made to the item.', 'warning');
            editingItemIndex = -1;
            renderBatchItems();
            resetPurchaseItemForm();
            return;
        }
        currentBatchItems[editingItemIndex] = { ...original, ...newItem };
        showPurchaseToast('Item updated successfully.', 'success');
        editingItemIndex = -1;
    } else {
        currentBatchItems.push(newItem);
    }

    renderBatchItems();
    resetPurchaseItemForm();
    updateOrderSummary();
}

function resetPurchaseItemForm() {
    if (productChoices) { productChoices.removeActiveItems(); productChoices.setChoiceByValue(''); }
    const productSelect = document.getElementById('purchase-product-id');
    if (productSelect) productSelect.value = "";
    safeSetValue('purchase-quantity', 1);
    safeSetValue('purchase-other-charges', 0);
    safeSetValue('purchase-unit-price', '');
    safeSetValue('purchase-part-code', '');
    safeSetValue('purchase-item-description', '');
    safeSetValue('purchase-hsn-code', '');
    safeSetValue('purchase-category-name', '');
    const btn = document.getElementById('add-item-to-batch-btn');
    if (btn) { btn.innerHTML = '+ Add Item'; btn.classList.remove('btn-warning'); btn.classList.add('btn-primary'); }
    const lpd = document.getElementById('last-prices-display');
    if (lpd) lpd.style.display = 'none';
}

// State for tracking item being edited
let editingItemIndex = -1;

function renderBatchItems() {
    const tbody = document.getElementById('batch-items-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const symbols = { USD: '$', RMB: '¥', INR: '₹' };
    const sym = symbols[selectedOrderCurrency] || '₹';

    if (currentBatchItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: var(--text-muted);">No items added yet.</td></tr>';
        return;
    }

    currentBatchItems.forEach((item, index) => {
        const tr = document.createElement('tr');
        if (index === editingItemIndex) tr.className = 'batch-row-editing';
        const lineTotal = item.unit_price * item.quantity;
        const dec = selectedOrderCurrency === 'INR' ? 3 : 6;
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${item.part_code}</strong></td>
            <td>${item.item_description?.substring(0, 25) || ''}</td>
            <td>${item.quantity}</td>
            <td>${sym}${item.unit_price.toFixed(dec)}</td>
            <td style="font-weight:600;">${sym}${lineTotal.toFixed(dec)}</td>
            <td>
                <button class="batch-action-btn edit-btn" onclick="editItemFromBatch(${index})" title="Edit">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                </button>
                <button class="batch-action-btn remove-btn" onclick="removeItemFromBatch(${index})" title="Remove">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Remove
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    updateOrderSummary();
}

window.editItemFromBatch = function (index) {
    const item = currentBatchItems[index];
    if (!item) return;
    editingItemIndex = index;
    renderBatchItems();

    // If product section is hidden, reopen it
    const section = document.getElementById('product-selection-section');
    if (section) section.style.display = 'block';

    const btn = document.getElementById('add-item-to-batch-btn');
    if (btn) {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Update Item`;
        btn.classList.remove('btn-primary'); btn.classList.add('btn-warning');
    }

    if (productChoices && item.product_id) productChoices.setChoiceByValue(item.product_id);
    safeSetValue('purchase-part-code', item.part_code);
    safeSetValue('purchase-item-description', item.item_description);
    safeSetValue('purchase-quantity', item.quantity);
    safeSetValue('purchase-unit-price', item.unit_price);
    safeSetValue('purchase-hsn-code', item.hsn_code);
    safeSetValue('purchase-category-name', item.category_name);
    safeSetValue('purchase-price-usd', item.price_usd);
    safeSetValue('purchase-price-rmb', item.price_rmb);
    safeSetValue('purchase-price-inr', item.price_inr);
    showPurchaseToast(`Editing item #${index + 1} — modify and click Update`, 'info');
}

window.removeItemFromBatch = function (index) {
    currentBatchItems.splice(index, 1);
    if (editingItemIndex === index) editingItemIndex = -1;
    else if (editingItemIndex > index) editingItemIndex--;
    renderBatchItems();
    updateOrderSummary();
}

window.clearPurchaseFilters = function () {
    ['filter-purchase-id', 'filter-part-code', 'filter-supplier', 'filter-status', 'filter-delivery-date'].forEach(id => {
        safeSetValue(id, '');
    });
    renderCurrentView();
}

async function submitBatchOrder() {
    const placedBy = document.getElementById('purchase-order-placed-by').value;
    const supplierId = document.getElementById('purchase-common-supplier').value;
    if (!placedBy || !supplierId) { showPurchaseToast('Please fill Order Placed By and Supplier.', 'error'); return; }
    if (currentBatchItems.length === 0) { showPurchaseToast('Please add at least one item.', 'error'); return; }

    const supplier = suppliersForPurchase.find(s => s.id == supplierId);

    // Apply order-level charges to items
    let orderOtherCharges = 0, orderGstApplicable = false, orderGstPct = 0;
    orderOtherCharges = parseFloat(document.getElementById('purchase-order-other-charges')?.value || 0);
    // GST only for INR
    if (selectedOrderCurrency === 'INR') {
        orderGstApplicable = document.getElementById('purchase-order-gst-applicable')?.checked !== false;
        orderGstPct = parseFloat(document.getElementById('purchase-order-gst-percentage')?.value || 18);
    }

    // Distribute other charges equally across items
    const chargesPerItem = currentBatchItems.length > 0 ? orderOtherCharges / currentBatchItems.length : 0;
    const itemsWithCharges = currentBatchItems.map(item => ({
        ...item,
        price_currency: selectedOrderCurrency,
        other_charges: chargesPerItem,
        gst_applicable: orderGstApplicable,
        gst_percentage: orderGstApplicable ? orderGstPct : 0
    }));

    const payload = {
        order_placed_by: placedBy,
        supplier_id: parseInt(supplierId),
        supplier_name: supplier ? supplier.supplier_name : '',
        delivery_date: document.getElementById('purchase-delivery-date').value || null,
        delivery_type: document.getElementById('purchase-delivery-type').value,
        global_remarks: document.getElementById('purchase-remarks').value,
        order_currency: selectedOrderCurrency,
        items: itemsWithCharges
    };

    let result;
    console.log('[submitBatchOrder] editingPurchaseId =', editingPurchaseId);
    if (editingPurchaseId) {
        // --- UPDATE existing order (PUT) ---
        console.log('[submitBatchOrder] Using PUT to update:', editingPurchaseId);
        result = await fetchPurchaseAPI(`/purchase-orders/batch/${encodeURIComponent(editingPurchaseId)}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    } else {
        // --- CREATE new order (POST) ---
        result = await fetchPurchaseAPI('/purchase-orders/batch', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    if (result.success) {
        showPurchaseToast(editingPurchaseId ? 'Order updated successfully!' : 'Order saved successfully!', 'success');
        editingPurchaseId = null; // Clear edit state
        closePurchaseModal();
        loadPurchaseOrders();
    } else {
        showPurchaseToast(result.error || result.detail || 'Failed to save order.', 'error');
    }
}

// =============================================================================
// Helper
// =============================================================================

function safeSetValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function updateStats() {
    const totalOrders = document.getElementById('total-purchase-orders');
    if (totalOrders) totalOrders.textContent = purchaseOrdersData.length;

    const openOrders = document.getElementById('open-purchase-orders');
    if (openOrders) openOrders.textContent = purchaseOrdersData.filter(o => o.pi_status === 'open').length;

    const totalValue = document.getElementById('total-purchase-value');
    if (totalValue) {
        const total = purchaseOrdersData.reduce((sum, o) => sum + parseFloat(o.final_total || 0), 0);
        totalValue.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
}

function showPurchaseToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.className = `toast ${type} show`;
        const m = toast.querySelector('.toast-message');
        if (m) m.textContent = msg;
        setTimeout(() => toast.classList.remove('show'), 3000);
    } else {
        alert(msg);
    }
}

// Modal Control
// Modal Control
window.openPurchaseModal = function (isEdit = false) {
    const purchaseView = document.getElementById('purchase-view');
    const purchaseFormView = document.getElementById('purchase-form-view');
    if (purchaseView && purchaseFormView) {
        purchaseView.style.display = 'none';
        purchaseFormView.style.display = 'block';

        if (!isEdit) {
            editingPurchaseId = null; // Reset edit tracking for new orders
            loadProductsForPurchase();
            loadSuppliersForPurchase();
            currentBatchItems = [];
            editingItemIndex = -1;
            productSelectionDone = false;
            selectedOrderCurrency = 'INR';

            // Reset currency radio
            const inrRadio = document.querySelector('input[name="order-currency"][value="INR"]');
            if (inrRadio) inrRadio.checked = true;

            renderBatchItems();
            resetPurchaseItemForm();
            safeSetValue('purchase-order-placed-by', '');
            safeSetValue('purchase-remarks', '');
            safeSetValue('purchase-order-other-charges', 0);
            safeSetValue('purchase-order-gst-percentage', 18);
            const gstCheck = document.getElementById('purchase-order-gst-applicable');
            if (gstCheck) gstCheck.checked = true;

            if (purchaseSupplierChoices) purchaseSupplierChoices.setChoiceByValue('');
            const lpd = document.getElementById('last-prices-display');
            if (lpd) lpd.style.display = 'none';
            const title = document.getElementById('purchase-form-title');
            if (title) title.textContent = 'New Purchase Order';

            // Reset sections visibility
            const prodSection = document.getElementById('product-selection-section');
            if (prodSection) prodSection.style.display = 'block';
            const otherSection = document.getElementById('other-charges-section');
            if (otherSection) otherSection.style.display = 'none';

            updateCurrencyUI();
            updateOrderSummary();
        }
    }
}

window.closePurchaseModal = function () {
    editingPurchaseId = null; // Clear edit tracking
    const purchaseView = document.getElementById('purchase-view');
    const purchaseFormView = document.getElementById('purchase-form-view');
    if (purchaseView && purchaseFormView) {
        purchaseFormView.style.display = 'none';
        purchaseView.style.display = 'block';
    }
}

window.editPurchaseOrder = function (purchaseId) {
    const orders = purchaseOrdersData.filter(o => o.purchase_id === purchaseId);
    if (orders.length === 0) return;

    const first = orders[0];

    // --- Guard: Block editing for dispatched or short_closed orders ---
    const hasDispatched = orders.some(o => (parseInt(o.dispatched_quantity) || 0) > 0);
    const hasShortClosed = orders.some(o => (parseInt(o.short_closed_quantity) || 0) > 0);
    const hasTerminalStatus = orders.some(o => ['dispatched', 'short_closed'].includes(o.pi_status));

    if (hasDispatched || hasShortClosed || hasTerminalStatus) {
        showPurchaseToast('Cannot edit this order — it has dispatched or short-closed items. Create a new order instead.', 'error');
        return;
    }

    // Set the editing purchase ID so submitBatchOrder knows to update
    editingPurchaseId = purchaseId;

    // Open Modal in Edit Mode (prevents clearing)
    openPurchaseModal(true);

    const titleEl = document.getElementById('purchase-form-title');
    if (titleEl) titleEl.textContent = `Edit Purchase Order (${purchaseId})`;

    // Restore currency from saved order
    selectedOrderCurrency = first.price_currency || 'INR';
    const currRadio = document.querySelector(`input[name="order-currency"][value="${selectedOrderCurrency}"]`);
    if (currRadio) currRadio.checked = true;

    // Populate Header Fields
    safeSetValue('purchase-order-placed-by', first.order_placed_by);
    safeSetValue('purchase-remarks', first.remarks || '');

    // Supplier
    if (purchaseSupplierChoices) {
        if (first.supplier_id) {
            purchaseSupplierChoices.setChoiceByValue(first.supplier_id);
        } else if (first.supplier_name) {
            const s = suppliersForPurchase.find(x => x.supplier_name === first.supplier_name);
            if (s) purchaseSupplierChoices.setChoiceByValue(s.id);
        }
    }

    // Delivery Date & Type
    if (first.delivery_date) {
        safeSetValue('purchase-delivery-date', first.delivery_date.split('T')[0]);
    }
    if (first.delivery_type) {
        safeSetValue('purchase-delivery-type', first.delivery_type);
    }

    // Populate Items
    currentBatchItems = orders.map(o => {
        const lineTotal = parseFloat(o.unit_price || 0) * parseFloat(o.quantity || 0);

        return {
            tempId: Date.now() + Math.random(),
            product_id: o.product_id,
            part_code: o.part_code,
            item_description: o.item_description,
            hsn_code: o.hsn_code,
            category_name: o.category_name,
            quantity: parseFloat(o.quantity),
            price_currency: o.price_currency,
            price_usd: parseFloat(o.price_usd || 0),
            price_inr: parseFloat(o.price_inr || 0),
            price_rmb: parseFloat(o.price_rmb || 0),
            unit_price: parseFloat(o.unit_price || 0),
            other_charges: parseFloat(o.other_charges || 0),
            gst_applicable: o.gst_applicable,
            gst_percentage: parseFloat(o.gst_percentage || 18),
            total_estimated: lineTotal
        };
    });

    // Restore other charges / GST from first order
    const totalOtherCharges = orders.reduce((sum, o) => sum + parseFloat(o.other_charges || 0), 0);
    safeSetValue('purchase-order-other-charges', totalOtherCharges);
    safeSetValue('purchase-order-gst-percentage', first.gst_percentage || 18);
    const gstCheck = document.getElementById('purchase-order-gst-applicable');
    if (gstCheck) gstCheck.checked = first.gst_applicable !== false;

    // Show product section with items for editing
    productSelectionDone = false;
    editingItemIndex = -1;
    const prodSection = document.getElementById('product-selection-section');
    if (prodSection) prodSection.style.display = 'block';
    const otherSection = document.getElementById('other-charges-section');
    if (otherSection) otherSection.style.display = 'none';

    renderBatchItems();
    updateCurrencyUI();
    updateOrderSummary();
    showPurchaseToast(`Loaded ${currentBatchItems.length} items for editing. Click on Edit to modify each item.`, 'info');
}

window.deletePurchaseBatch = async function (purchaseId) {
    if (!confirm('Are you sure you want to permanently delete this Purchase Order and all its items?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/purchase-orders/batch/${purchaseId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.detail || 'Failed to delete order');
        }
        
        showPurchaseToast('Purchase order deleted successfully', 'success');
        loadPurchaseOrders();
    } catch (err) {
        console.error(err);
        showPurchaseToast(err.message, 'error');
    }
};

window.openPurchaseModalWithItems = function (purchaseId) {
    switchPurchaseTab('items');
    const searchInput = document.getElementById('purchase-search-input');
    if (searchInput) {
        searchInput.value = purchaseId;
        searchInput.dispatchEvent(new Event('input'));
    }
}

// =============================================================================
// Payment Functions
// =============================================================================

window.openPaymentSummaryModal = function () {
    const modal = document.getElementById('payment-summary-modal');
    if (modal) {
        modal.classList.add('active');
        // Ensure visibility styles if CSS issues
        modal.style.display = 'flex';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
        modal.style.zIndex = '9999';
        document.body.appendChild(modal);

        const tbody = document.getElementById('payment-summary-tbody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading...</td></tr>';

        loadPaymentSummary();
    }
};

window.closePaymentSummaryModal = function () {
    const modal = document.getElementById('payment-summary-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none'; // Force hide
    }
}

async function loadPaymentSummary() {
    const tbody = document.getElementById('payment-summary-tbody');
    if (!tbody) return;

    try {
        const result = await fetchPurchaseAPI('/suppliers/payment-summary');
        if (result.success) {
            tbody.innerHTML = '';
            const data = Array.isArray(result.data) ? result.data : [];

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No pending payments.</td></tr>';
                return;
            }

            data.forEach(item => {
                const tr = document.createElement('tr');
                const statusColor = item.payment_status === 'Paid' ? 'var(--success)' :
                    (item.payment_status === 'Partial' ? 'var(--warning)' : 'var(--danger)');

                tr.innerHTML = `
                    <td><strong>${item.supplier_name}</strong><br><small>${item.supplier_code || ''}</small></td>
                    <td>${item.total_orders} orders</td>
                    <td>₹${parseFloat(item.total_purchase_value).toFixed(2)}</td>
                    <td>₹${parseFloat(item.total_paid).toFixed(2)}</td>
                    <td style="color:red; font-weight:bold;">₹${parseFloat(item.balance_pending).toFixed(2)}</td>
                    <td><span class="status-badge" style="background:${statusColor}; color:white;">${item.payment_status}</span></td>
                    <td>
                        ${item.balance_pending > 0 ? `
                        <button class="btn btn-sm btn-primary" onclick="alert('Payment feature enabled in full version')">Pay</button>
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7">Error: ${e.message}</td></tr>`;
    }
}

// Export init
window.initializePurchaseModule = initializePurchaseModule;

// =============================================================================
// New Payments Tab Logic
// =============================================================================

let allPaymentsData = [];

async function loadAndRenderPayments() {
    const tbody = document.getElementById('purchase-orders-tbody');
    const thead = document.getElementById('purchase-table-head');
    if (!tbody || !thead) return;

    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Loading...</td></tr>';
    // Don't clear header here to prevent jumpiness, we overwrite it in renderPaymentsTable

    try {
        const result = await fetchPurchaseAPI('/reports/orders-payment-status');
        if (result.success) {
            allPaymentsData = result.data || [];
            renderPaymentsTable();
        } else {
            tbody.innerHTML = `<tr><td colspan="9">Error: ${result.message}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="9">Error: ${e.message}</td></tr>`;
    }
}

function renderPaymentsTable() {
    const tbody = document.getElementById('purchase-orders-tbody');
    const thead = document.getElementById('purchase-table-head');
    if (!tbody || !thead) return;

    // Set Headers
    thead.innerHTML = `
        <tr>
            <th>Date</th>
            <th>Purchase ID</th>
            <th>Supplier</th>
            <th>Summary</th>
            <th>Total Value</th>
            <th>Paid</th>
            <th>Pending</th>
            <th>Status</th>
            <th>Actions</th>
        </tr>
    `;

    // --- Update Stats Card Contextually ---
    const totalValueCard = document.getElementById('total-purchase-value');
    const totalValueLabel = totalValueCard?.parentElement?.querySelector('.stat-label');

    // Calculate total pending from *all* payments data (not just filtered)
    // Note: This relies on currency uniformity or just sums up as INR approx if mixed. 
    // Ideally we'd separate currencies, but for now we sum up pending amounts assuming mostly local or converted.
    // The previous logic just summed total_final. Here we sum pending_amount.
    let totalPending = 0;
    if (allPaymentsData.length > 0) {
        // Naive sum of pending amounts (mixed currencies)
        // A better approach would be to convert everything to INR if rates available, 
        // but for now let's just show the sum of numeric values.
        totalPending = allPaymentsData.reduce((sum, item) => sum + (item.pending_amount || 0), 0);
    }

    if (totalValueCard) {
        // Update Value
        totalValueCard.textContent = `₹${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        // Update Label
        if (totalValueLabel) {
            totalValueLabel.textContent = "Total Pending Balance";
        }
    }
    // -------------------------------------

    // Filter Logic
    const fPid = document.getElementById('pay-filter-pid')?.value.toLowerCase();
    const fSupp = document.getElementById('pay-filter-supplier')?.value.toLowerCase();
    const fCurr = document.getElementById('pay-filter-currency')?.value;
    const fStatus = document.getElementById('filter-payment-status')?.value;
    const fDispatch = document.getElementById('filter-dispatch-status')?.value;

    let filtered = allPaymentsData.filter(item => {
        const matchPid = !fPid || (item.purchase_id && item.purchase_id.toLowerCase().includes(fPid));
        const matchSupp = !fSupp || (item.supplier_name && item.supplier_name.toLowerCase().includes(fSupp));
        const matchCurr = !fCurr || (item.currency === fCurr);
        const matchStatus = !fStatus || item.payment_status === fStatus;
        const matchDispatch = !fDispatch || item.dispatch_status === fDispatch;
        return matchPid && matchSupp && matchCurr && matchStatus && matchDispatch;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">No items match filters.</td></tr>';
        return;
    }

    filtered.forEach(item => {
        const tr = document.createElement('tr');
        const currencyMap = { 'USD': '$', 'RMB': '¥', 'INR': '₹' };
        const symbol = currencyMap[item.currency] || item.currency || ' ';

        const statusColors = {
            'Paid': 'var(--success)',
            'Partial': 'var(--warning)',
            'Pending': 'var(--danger)'
        };
        const statusStyle = `background:${statusColors[item.payment_status] || '#ccc'}; color:white;`;

        // Sanitize for HTML attribute
        const safeSupplier = (item.supplier_name || '')
            .replace(/'/g, "\\'")
            .replace(/"/g, '&quot;')
            .replace(/\n/g, ' ');

        tr.innerHTML = `
            <td>${item.order_date ? item.order_date.split('T')[0] : '-'}</td>
            <td><strong>${item.purchase_id}</strong></td>
            <td>${item.supplier_name}</td>
            <td><small>${item.items_summary}</small></td>
            <td>${symbol}${item.total_amount.toFixed(2)}</td>
            <td>${symbol}${item.paid_amount.toFixed(2)}</td>
            <td style="color:${item.pending_amount > 0.01 ? 'red' : 'green'}; font-weight:bold;">
                ${symbol}${item.pending_amount.toFixed(2)}
            </td>
            <td><span class="status-badge" style="${statusStyle}">${item.payment_status}</span></td>
            <td>
                ${item.payment_status !== 'Paid' ?
                `<button class="btn btn-sm btn-primary" onclick="openOrderPaymentModal(${item.id}, '${safeSupplier}', ${item.supplier_id || 0}, ${item.pending_amount}, '${item.currency}')">Pay</button>`
                : '<span style="color:var(--success)">Completed</span>'}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.clearPaymentFilters = function () {
    safeSetValue('pay-filter-pid', '');
    safeSetValue('pay-filter-supplier', '');
    safeSetValue('pay-filter-currency', '');
    safeSetValue('filter-payment-status', '');
    safeSetValue('filter-dispatch-status', '');
    renderPaymentsTable();
}

/**
 * Setup Listeners for Payment Filters
 * This needs to be called during initialization
 */
function setupPaymentFilterListeners() {
    const ids = ['pay-filter-pid', 'pay-filter-supplier', 'pay-filter-currency', 'filter-payment-status', 'filter-dispatch-status'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', renderPaymentsTable);
        }
    });
}

window.openOrderPaymentModal = function (orderId, supplierName, supplierId, pending, currency) {
    console.log('Opening payment modal:', { orderId, supplierName, pending });

    const modal = document.getElementById('payment-form-modal');
    if (!modal) {
        console.error('Payment modal not found');
        return;
    }

    try {
        // Move to body and force display to overcome any CSS issues
        if (modal.parentNode !== document.body) {
            document.body.appendChild(modal);
        }

        // Force explicit styles
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('visibility', 'visible', 'important');
        modal.style.setProperty('opacity', '1', 'important');
        modal.style.setProperty('position', 'fixed', 'important');
        modal.style.setProperty('z-index', '2147483647', 'important'); // Max z-index
        modal.style.setProperty('top', '0', 'important');
        modal.style.setProperty('left', '0', 'important');
        modal.style.setProperty('width', '100vw', 'important');
        modal.style.setProperty('height', '100vh', 'important');
        modal.style.setProperty('background-color', 'rgba(0,0,0,0.8)', 'important'); // Ensure dark bg

        modal.classList.add('active');

        // Populate fields
        safeSetValue('pay-supplier-name', supplierName);
        safeSetValue('pay-supplier-id', supplierId);

        // Set Order ID in a hidden field. If not exists, create it.
        let orderInput = document.getElementById('pay-purchase-order-id');
        if (!orderInput) {
            orderInput = document.createElement('input');
            orderInput.type = 'hidden';
            orderInput.id = 'pay-purchase-order-id';
            const form = document.getElementById('payment-form');
            if (form) form.appendChild(orderInput);
        }
        if (orderInput) orderInput.value = orderId;

        // Update Input Symbol
        const currencyMap = { 'USD': '$', 'RMB': '¥', 'INR': '₹' };
        const symbol = currencyMap[currency] || '₹';
        // Try to find the icon inside the modal
        const icons = document.querySelectorAll('#payment-form .input-icon, #payment-form .input-with-icon span');
        icons.forEach(ic => {
            if (ic.textContent.trim().length <= 1) ic.textContent = symbol;
        });

        safeSetValue('pay-amount', pending.toFixed(2));
        const today = new Date().toISOString().split('T')[0];
        safeSetValue('pay-date', today);
        safeSetValue('pay-remarks', `Payment for Order ${orderId}`);

        console.log("Modal force-opened via inline styles");
    } catch (e) {
        console.error('Error in openOrderPaymentModal:', e);
        showPurchaseToast('Error opening payment form: ' + e.message, 'error');
    }
}

window.closePaymentFormModal = function () {
    const modal = document.getElementById('payment-form-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
}

function setupPaymentFormListener() {
    const form = document.getElementById('payment-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const supplierId = document.getElementById('pay-supplier-id').value;
            const orderId = document.getElementById('pay-purchase-order-id')?.value;
            const amount = document.getElementById('pay-amount').value;

            if (!supplierId || !amount) {
                showPurchaseToast('Missing required fields', 'error');
                return;
            }

            const payload = {
                supplier_id: parseInt(supplierId),
                purchase_order_id: orderId ? parseInt(orderId) : null,
                amount: parseFloat(amount),
                payment_date: document.getElementById('pay-date').value,
                payment_mode: document.getElementById('pay-mode').value,
                reference_number: document.getElementById('pay-reference').value,
                remarks: document.getElementById('pay-remarks').value
            };

            try {
                const res = await fetchPurchaseAPI('/payments', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });

                if (res.success) {
                    showPurchaseToast('Payment recorded successfully!', 'success');
                    closePaymentFormModal();

                    // Refresh views
                    if (typeof activeTab !== 'undefined' && activeTab === 'payments') {
                        loadAndRenderPayments();
                    }
                    // Also refresh the summary modal if open
                    if (document.getElementById('payment-summary-modal')?.classList.contains('active')) {
                        loadPaymentSummary();
                    }
                }
            } catch (err) {
                console.error(err);
                showPurchaseToast(err.message, 'error');
            }
        };
    }
}

// =============================================================================
// Excel/CSV Import Functions
// =============================================================================

let importSelectedFile = null;

window.openImportModal = function () {
    const overlay = document.getElementById('import-modal-overlay');
    if (overlay) {
        overlay.classList.add('active');
        // Reset state
        importSelectedFile = null;
        const fileInput = document.getElementById('import-file-input');
        if (fileInput) fileInput.value = '';
        const dropContent = document.getElementById('import-drop-content');
        const filePreview = document.getElementById('import-file-preview');
        if (dropContent) dropContent.style.display = 'block';
        if (filePreview) filePreview.style.display = 'none';
        const submitBtn = document.getElementById('import-submit-btn');
        if (submitBtn) submitBtn.disabled = true;
        // Reset progress & results
        const progressSection = document.getElementById('import-progress-section');
        if (progressSection) progressSection.style.display = 'none';
        const resultSection = document.getElementById('import-result-section');
        if (resultSection) {
            resultSection.style.display = 'none';
            resultSection.innerHTML = '';
        }
    }
};

window.closeImportModal = function () {
    const overlay = document.getElementById('import-modal-overlay');
    if (overlay) overlay.classList.remove('active');
    importSelectedFile = null;
};

window.toggleImportGST = function() {
    const currency = document.getElementById('import-currency')?.value;
    const gstSection = document.getElementById('import-gst-section');
    if (gstSection) {
        gstSection.style.display = currency === 'INR' ? 'block' : 'none';
    }
};

window.handleImportFileSelect = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const validExts = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExts.includes(ext)) {
        showPurchaseToast('Invalid file type. Please upload .xlsx, .xls, or .csv', 'error');
        return;
    }

    importSelectedFile = file;

    // Show preview
    const dropContent = document.getElementById('import-drop-content');
    const filePreview = document.getElementById('import-file-preview');
    const fileName = document.getElementById('import-file-name');
    const fileSize = document.getElementById('import-file-size');

    if (dropContent) dropContent.style.display = 'none';
    if (filePreview) filePreview.style.display = 'block';
    if (fileName) fileName.textContent = file.name;
    if (fileSize) {
        const sizeKB = (file.size / 1024).toFixed(1);
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileSize.textContent = file.size > 1048576 ? `${sizeMB} MB` : `${sizeKB} KB`;
    }

    // Enable submit
    const submitBtn = document.getElementById('import-submit-btn');
    if (submitBtn) submitBtn.disabled = false;

    // Reset result section
    const resultSection = document.getElementById('import-result-section');
    if (resultSection) {
        resultSection.style.display = 'none';
        resultSection.innerHTML = '';
    }
};

window.clearImportFile = function (event) {
    if (event) event.stopPropagation();
    importSelectedFile = null;
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) fileInput.value = '';
    const dropContent = document.getElementById('import-drop-content');
    const filePreview = document.getElementById('import-file-preview');
    if (dropContent) dropContent.style.display = 'block';
    if (filePreview) filePreview.style.display = 'none';
    const submitBtn = document.getElementById('import-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
};

window.submitImport = async function () {
    if (!importSelectedFile) {
        showPurchaseToast('Please select a file first.', 'error');
        return;
    }

    const placedBy = document.getElementById('import-placed-by')?.value || 'Import';
    const currency = document.getElementById('import-currency')?.value || 'INR';
    const deliveryType = document.getElementById('import-delivery-type')?.value || 'sea';
    const deliveryDate = document.getElementById('import-delivery-date')?.value || '';
    const otherCharges = document.getElementById('import-other-charges')?.value || '0';
    const remarks = document.getElementById('import-remarks')?.value || '';

    // Show progress
    const progressSection = document.getElementById('import-progress-section');
    const progressBar = document.getElementById('import-progress-bar');
    const progressText = document.getElementById('import-progress-text');
    const submitBtn = document.getElementById('import-submit-btn');

    if (progressSection) progressSection.style.display = 'block';
    if (progressBar) progressBar.style.width = '20%';
    if (progressText) progressText.textContent = 'Uploading...';
    if (submitBtn) submitBtn.disabled = true;

    // Build FormData
    const formData = new FormData();
    formData.append('file', importSelectedFile);
    formData.append('order_placed_by', placedBy);
    formData.append('currency', currency);
    formData.append('delivery_type', deliveryType);
    if(deliveryDate) formData.append('delivery_date', deliveryDate);
    formData.append('other_charges', otherCharges);
    formData.append('remarks', remarks);

    // GST Parameters
    if (currency === 'INR') {
        const gstApplicable = document.getElementById('import-gst-applicable')?.checked || false;
        const gstPct = document.getElementById('import-gst-percentage')?.value || '18';
        formData.append('gst_applicable', gstApplicable.toString());
        formData.append('gst_percentage', gstPct);
    } else {
        formData.append('gst_applicable', 'false');
        formData.append('gst_percentage', '0');
    }

    try {
        if (progressBar) progressBar.style.width = '50%';
        if (progressText) progressText.textContent = 'Processing...';

        const response = await fetch(`${API_BASE}/purchase-orders/import-excel`, {
            method: 'POST',
            body: formData,
        });

        if (progressBar) progressBar.style.width = '80%';
        if (progressText) progressText.textContent = 'Finalizing...';

        const data = await response.json().catch(() => ({}));

        if (progressBar) progressBar.style.width = '100%';
        if (progressText) progressText.textContent = '100%';

        if (response.ok && data.success) {
            closeImportModal();
            showImportSuccessOverlay(data.orders_created || 0, data.items_created || 0, data.rows_skipped || 0);
            
            // Refresh orders list after a short delay
            setTimeout(() => {
                loadPurchaseOrders();
            }, 500);

        } else {
            // Error result
            const errorMsg = data.detail || data.message || 'Import failed. Please check your file format.';
            if (resultSection) {
                resultSection.style.display = 'block';
                resultSection.innerHTML = `
                    <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 16px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                            <div>
                                <div style="font-weight: 700; color: #ef4444; font-size: 0.95rem;">Import Failed</div>
                                <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 2px;">${errorMsg}</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            showPurchaseToast(errorMsg, 'error');
        }

    } catch (err) {
        console.error('Import error:', err);
        if (resultSection) {
            resultSection.style.display = 'block';
            resultSection.innerHTML = `
                <div style="background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 16px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                        <div>
                            <div style="font-weight: 700; color: #ef4444;">Connection Error</div>
                            <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 2px;">${err.message}</div>
                        </div>
                    </div>
                </div>
            `;
        }
        showPurchaseToast('Network error during import.', 'error');
    } finally {
        // Hide progress after a moment
        setTimeout(() => {
            if (progressSection) progressSection.style.display = 'none';
            if (submitBtn) submitBtn.disabled = false;
        }, 1500);
    }
};

// Drag & drop support for import zone
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('import-drop-zone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = '#10b981';
            dropZone.style.background = 'rgba(16,185,129,0.06)';
        });
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const fileInput = document.getElementById('import-file-input');
            // Create a new DataTransfer to set files on input
            const dt = new DataTransfer();
            dt.items.add(files[0]);
            if (fileInput) {
                fileInput.files = dt.files;
                handleImportFileSelect({ target: fileInput });
            }
        }
    });

});

// Add custom success pop-up generator for Imports
window.showImportSuccessOverlay = function(orders, items, skipped) {
    let overlay = document.getElementById('import-custom-success-popup');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'import-custom-success-popup';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '3000';
        overlay.style.background = 'rgba(15, 23, 42, 0.7)';
        overlay.style.backdropFilter = 'blur(4px)';
        document.body.appendChild(overlay);
    }
    
    overlay.innerHTML = `
        <div class="modal animate-in" style="max-width: 450px; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; padding: 30px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="width: 72px; height: 72px; background: rgba(16, 185, 129, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            </div>
            
            <h2 style="margin: 0 0 8px 0; color: var(--text-primary); font-size: 1.5rem;">Import Successful!</h2>
            <p style="margin: 0 0 24px 0; color: var(--text-muted); font-size: 0.95rem;">Your Excel data has been fully synced into the DB.</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 24px;">
                <div style="background: var(--bg-secondary); border-radius: 10px; padding: 15px;">
                    <div style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary); line-height: 1;">${orders}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Orders Created</div>
                </div>
                <div style="background: var(--bg-secondary); border-radius: 10px; padding: 15px;">
                    <div style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary); line-height: 1;">${items}</div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Items Parsed</div>
                </div>
            </div>
            
            ${skipped > 0 ? `<div style="color: #f59e0b; font-size: 0.85rem; margin-bottom: 20px;">Note: ${skipped} invalid row(s) were skipped.</div>` : ''}
            
            <button onclick="document.getElementById('import-custom-success-popup').classList.remove('active')" class="btn btn-primary" style="width: 100%; padding: 12px; font-size: 1rem;">Continue Working</button>
        </div>
    `;
    
    // Force a micro-delay to trigger the CSS transition
    setTimeout(() => overlay.classList.add('active'), 10);
};
