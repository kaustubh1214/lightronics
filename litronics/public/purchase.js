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
let activeTab = 'orders'; // 'orders' or 'items'

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

        // Initial Tab State
        switchPurchaseTab('orders');
        loadPurchaseOrders(); // Load data after setting tab

        setupPurchaseEventListeners();
        setupPaymentFormListener();
        setupPaymentFilterListeners();

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
    const filterBar = document.getElementById('purchase-filter-bar');
    const paymentsFilterBar = document.getElementById('payments-filter-bar');

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
                supplier_name: item.supplier_name,
                items_count: 0,
                total_value: 0,
                status: item.pi_status,
                items: []
            };
        }
        groups[key].items_count++;
        groups[key].total_value += parseFloat(item.final_total || 0);
        groups[key].items.push(item);
    });

    const sortedGroups = Object.values(groups).sort((a, b) => new Date(b.order_date) - new Date(a.order_date));

    tbody.innerHTML = '';
    if (sortedGroups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 30px;">No orders found.</td></tr>';
        return;
    }

    sortedGroups.forEach((group, index) => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        tr.style.animationDelay = `${index * 0.05}s`;

        const date = group.order_date ? new Date(group.order_date).toLocaleDateString('en-IN') : '-';

        tr.innerHTML = `
            <td>
                <strong>${group.order_number}</strong><br>
                <small class="text-muted" style="color:var(--text-muted)">${group.id}</small>
            </td>
            <td>${group.order_placed_by}</td>
            <td>${date}</td>
            <td>${group.supplier_name || '-'}</td>
            <td>${group.items_count}</td>
            <td style="font-weight:600;">₹${group.total_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
                    ${(group.status === 'open' || group.status === 'confirmed') ? `
                    <button class="btn btn-sm btn-success" onclick="markOrderReadyToDispatch('${group.id}')" title="Mark Ready to Dispatch">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                        Ready to Dispatch
                    </button>
                    ` : (group.status === 'ready_to_dispatch' ? `<span class="ready-badge">✓ Ready</span>` : (group.status === 'dispatched' ? `<span class="status-badge status-dispatched">Dispatched</span>` : ''))}
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
window.markOrderReadyToDispatch = async function (purchaseId) {
    // Find all items with this purchase_id
    const itemsToUpdate = purchaseOrdersData.filter(item => item.purchase_id === purchaseId);

    if (itemsToUpdate.length === 0) {
        showPurchaseToast('No items found for this order', 'error');
        return;
    }

    // Confirm action
    if (!confirm(`Mark ${itemsToUpdate.length} item(s) in order ${purchaseId} as Ready to Dispatch?`)) {
        return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Update each item's status
    for (const item of itemsToUpdate) {
        const result = await fetchPurchaseAPI(`/purchase-orders/${item.id}/status?status=ready_to_dispatch`, { method: 'PATCH' });
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
        }
    }

    if (successCount > 0) {
        showPurchaseToast(`${successCount} item(s) marked as Ready to Dispatch! They will now appear in the Dispatch module.`, 'success');
        loadPurchaseOrders();
    }

    if (errorCount > 0) {
        showPurchaseToast(`${errorCount} item(s) failed to update`, 'error');
    }
}

// =============================================================================
// Batch / Add Item Logic
// =============================================================================

function setupPurchaseEventListeners() {
    // Product Select - Fetch Details & Last Prices
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

                const currSel = document.getElementById('purchase-price-currency');
                if (currSel) {
                    currSel.value = product.primary_currency || 'USD';
                    updateUnitDisplay();
                }

                loadLast3Prices(productId);
            }
        });
    }

    // Currency Change
    const currSel = document.getElementById('purchase-price-currency');
    if (currSel) currSel.addEventListener('change', updateUnitDisplay);

    // Search
    const searchInput = document.getElementById('purchase-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderCurrentView());
    }

    // Filter Inputs
    ['filter-purchase-id', 'filter-part-code', 'filter-supplier', 'filter-status', 'filter-delivery-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderCurrentView);
    });

    // Buttons
    document.getElementById('add-item-to-batch-btn').addEventListener('click', addItemToBatch);
    document.getElementById('submit-batch-order-btn').addEventListener('click', submitBatchOrder);
}

function updateUnitDisplay() {
    const currency = document.getElementById('purchase-price-currency').value;
    const symEl = document.getElementById('purchase-currency-symbol');
    const unitIn = document.getElementById('purchase-unit-price');

    const symbols = { USD: '$', RMB: '¥', INR: '₹' };
    if (symEl) symEl.textContent = symbols[currency] || '$';

    if (unitIn) {
        if (currency === 'USD') unitIn.value = document.getElementById('purchase-price-usd').value;
        else if (currency === 'RMB') unitIn.value = document.getElementById('purchase-price-rmb').value;
        else unitIn.value = document.getElementById('purchase-price-inr').value;
    }
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
    console.log('Adding/Updating item in batch...');
    const pid = document.getElementById('purchase-product-id').value;
    const qty = document.getElementById('purchase-quantity').value;
    const price = document.getElementById('purchase-unit-price').value;
    const currency = document.getElementById('purchase-price-currency').value;

    if (!qty || !price) {
        showPurchaseToast('Please select product (or enter details), quantity and price.', 'error');
        return;
    }

    const rate = currencyRatesForPurchase[currency] || 1;
    const otherCharges = parseFloat(document.getElementById('purchase-other-charges').value || 0);
    const totalINR = (parseFloat(price) * rate * parseInt(qty)) + otherCharges;

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
        other_charges: otherCharges,
        gst_applicable: document.getElementById('purchase-gst-applicable').checked,
        gst_percentage: parseFloat(document.getElementById('purchase-gst-percentage').value) || 18,
        total_estimated: totalINR
    };

    if (editingItemIndex > -1) {
        // --- Update Existing Item Logic ---
        const original = currentBatchItems[editingItemIndex];

        // Simple comparison to check if changes were made
        const hasChanges =
            original.quantity !== newItem.quantity ||
            original.unit_price !== newItem.unit_price ||
            original.price_currency !== newItem.price_currency ||
            original.other_charges !== newItem.other_charges ||
            original.part_code !== newItem.part_code ||
            original.gst_applicable !== newItem.gst_applicable;

        if (!hasChanges) {
            showPurchaseToast('No changes were made to the item.', 'warning');
            editingItemIndex = -1;
            renderBatchItems();
            resetPurchaseItemForm();
            return;
        }

        // Update the item
        currentBatchItems[editingItemIndex] = { ...original, ...newItem, total_estimated: totalINR };
        showPurchaseToast('Item updated successfully.', 'success');
        editingItemIndex = -1; // Reset mode
    } else {
        // --- Add New Item Logic ---
        currentBatchItems.push(newItem);
    }

    renderBatchItems();
    resetPurchaseItemForm();
}

function resetPurchaseItemForm() {
    // Reset inputs
    if (productChoices) {
        productChoices.removeActiveItems();
        productChoices.setChoiceByValue('');
    }

    const productSelect = document.getElementById('purchase-product-id');
    if (productSelect) productSelect.value = "";

    safeSetValue('purchase-quantity', 1);
    safeSetValue('purchase-other-charges', 0);
    safeSetValue('purchase-unit-price', '');
    safeSetValue('purchase-part-code', '');
    safeSetValue('purchase-item-description', '');
    safeSetValue('purchase-hsn-code', '');
    safeSetValue('purchase-category-name', '');

    // Reset Button State
    const btn = document.getElementById('add-item-to-batch-btn');
    if (btn) {
        btn.innerHTML = "+ Add Item";
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-primary');
    }

    // Reset editing index just in case called externally
    // But usually addItemToBatch handles it. If canceled specifically, we might need a distinct cancel.

    document.getElementById('last-prices-display').style.display = 'none';
}

// State for tracking item being edited
let editingItemIndex = -1;

function renderBatchItems() {
    const tbody = document.getElementById('batch-items-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (currentBatchItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No items added.</td></tr>';
        return;
    }

    currentBatchItems.forEach((item, index) => {
        const tr = document.createElement('tr');

        // Highlight logic
        if (index === editingItemIndex) {
            tr.style.background = 'rgba(255, 193, 7, 0.15)'; // Warning hints at editing
            tr.style.borderLeft = '4px solid var(--warning)';
        }

        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (e.target.closest('.action-btn')) return;
            editItemFromBatch(index);
        };

        tr.innerHTML = `
            <td>${item.part_code}</td>
            <td>${item.item_description?.substring(0, 20) || ''}</td>
            <td>${item.quantity}</td>
            <td>${item.price_currency} ${item.unit_price}</td>
            <td>₹${item.total_estimated.toFixed(2)}</td>
            <td>
                <button class="action-btn" onclick="removeItemFromBatch(${index})" style="color:red;" title="Remove">&times;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editItemFromBatch(index) {
    const item = currentBatchItems[index];
    if (!item) return;

    editingItemIndex = index; // Set global state
    renderBatchItems(); // Re-render to show highlight

    // Change Button to Indicate Update
    const btn = document.getElementById('add-item-to-batch-btn');
    if (btn) {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:8px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Update Item`;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-warning');
    }

    // Populate the form fields with item data
    if (productChoices && item.product_id) {
        productChoices.setChoiceByValue(item.product_id);
    }

    safeSetValue('purchase-part-code', item.part_code);
    safeSetValue('purchase-item-description', item.item_description);
    safeSetValue('purchase-quantity', item.quantity);
    safeSetValue('purchase-unit-price', item.unit_price);

    // Set currency
    if (item.price_currency) {
        const currEl = document.getElementById('purchase-price-currency');
        if (currEl) currEl.value = item.price_currency;
    }

    safeSetValue('purchase-other-charges', item.other_charges);
    safeSetValue('purchase-hsn-code', item.hsn_code);
    safeSetValue('purchase-category-name', item.category_name);

    // GST
    const gstCheck = document.getElementById('purchase-gst-applicable');
    if (gstCheck) gstCheck.checked = item.gst_applicable;
    safeSetValue('purchase-gst-percentage', item.gst_percentage);

    // Set hidden price fields
    safeSetValue('purchase-price-usd', item.price_usd);
    safeSetValue('purchase-price-rmb', item.price_rmb);
    safeSetValue('purchase-price-inr', item.price_inr);

    showPurchaseToast(`Editing item #${index + 1}`, 'info');
}

window.removeItemFromBatch = function (index) {
    currentBatchItems.splice(index, 1);
    renderBatchItems();
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

    if (!placedBy || !supplierId) {
        showPurchaseToast('Please fill Order Placed By and Supplier.', 'error');
        return;
    }




    if (currentBatchItems.length === 0) {
        showPurchaseToast('Please add at least one item.', 'error');
        return;
    }

    const supplier = suppliersForPurchase.find(s => s.id == supplierId);

    const payload = {
        order_placed_by: placedBy,
        supplier_id: parseInt(supplierId),
        supplier_name: supplier ? supplier.supplier_name : '',
        delivery_date: document.getElementById('purchase-delivery-date').value || null,
        delivery_type: document.getElementById('purchase-delivery-type').value,
        global_remarks: document.getElementById('purchase-remarks').value,
        items: currentBatchItems
    };

    const result = await fetchPurchaseAPI('/purchase-orders/batch', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    if (result.success) {
        showPurchaseToast('Batch created successfully!', 'success');
        closePurchaseModal();
        loadPurchaseOrders();
    } else {
        showPurchaseToast(result.error || result.detail || 'Failed to create batch.', 'error');
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
            // Reset Form for New Entry
            loadProductsForPurchase();
            loadSuppliersForPurchase();

            currentBatchItems = [];
            editingItemIndex = -1; // Reset Edit State
            renderBatchItems();
            resetPurchaseItemForm();
            safeSetValue('purchase-order-placed-by', '');
            safeSetValue('purchase-remarks', '');

            if (purchaseSupplierChoices) purchaseSupplierChoices.setChoiceByValue('');

            document.getElementById('last-prices-display').style.display = 'none';
            const title = document.getElementById('purchase-form-title');
            if (title) title.textContent = 'New Purchase Order';
        }
    }
}

window.closePurchaseModal = function () {
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

    // Open Modal in Edit Mode (prevents clearing)
    openPurchaseModal(true);

    const titleEl = document.getElementById('purchase-form-title');
    if (titleEl) titleEl.textContent = `Edit Purchase Order (${purchaseId})`;

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
        const rate = currencyRatesForPurchase[o.price_currency] || 1;
        // Re-calculate estimated total in INR for display
        const estimated = (parseFloat(o.unit_price || 0) * rate * parseFloat(o.quantity || 0)) + parseFloat(o.other_charges || 0);

        return {
            tempId: Date.now() + Math.random(),
            product_id: o.product_id, // Now available from backend
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
            total_estimated: estimated
        };
    });

    renderBatchItems();
    showPurchaseToast(`Loaded ${currentBatchItems.length} items for editing.`, 'info');
}

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
