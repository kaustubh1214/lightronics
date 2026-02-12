/**
 * Litronics Product Management System - Dispatch Module JavaScript
 * Handles Dispatch creation, tracking, and management
 */

// =============================================================================
// Global Data Storage
// =============================================================================

let dispatchesData = [];
let readyToDispatchOrders = [];
let currentDispatchItems = [];
let editingDispatchId = null;
let dispatchCurrencyRates = { USD: 83.50, RMB: 11.50, INR: 1 };

// =============================================================================
// Initialize Dispatch Module
// =============================================================================

function initializeDispatchModule() {
    console.log('Initializing Dispatch Module...');

    // Load data
    loadReadyToDispatchOrders();
    loadDispatches();
    loadDispatchCurrencyRates();

    // Setup event listeners
    setupDispatchEventListeners();
}

// =============================================================================
// API Calls
// =============================================================================

async function fetchDispatchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`/api${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || 'API Error');
        }
        return data;
    } catch (error) {
        console.error('Dispatch API Error:', error);
        showDispatchToast(error.message || 'Error connecting to server', 'error');
        return { success: false, error: error.message };
    }
}

// =============================================================================
// Data Loading
// =============================================================================

async function loadReadyToDispatchOrders() {
    const result = await fetchDispatchAPI('/purchase-orders/ready-to-dispatch');
    if (result.success && result.data) {
        readyToDispatchOrders = result.data;
        populatePurchaseOrderDropdown();
        updateDispatchStats();
    }
}

async function loadDispatches() {
    const result = await fetchDispatchAPI('/dispatches');
    if (result.success && result.data) {
        dispatchesData = result.data;
        renderDispatches();
        updateDispatchStats();
    }
}

async function loadDispatchCurrencyRates() {
    const result = await fetchDispatchAPI('/currency-rates');
    if (result.success && result.data) {
        result.data.forEach(rate => {
            dispatchCurrencyRates[rate.currency_code] = parseFloat(rate.rate_to_inr);
        });
    }
}

// =============================================================================
// UI Rendering
// =============================================================================

function populatePurchaseOrderDropdown() {
    const select = document.getElementById('dispatch-purchase-order');
    if (!select) return;

    select.innerHTML = '<option value="">Select Purchase Order</option>';

    readyToDispatchOrders.forEach(order => {
        const option = document.createElement('option');
        option.value = order.purchase_id;
        option.dataset.order = JSON.stringify(order);
        option.textContent = `${order.purchase_id} - ${order.supplier_name} (${order.items.length} items)`;
        select.appendChild(option);
    });
}

function renderDispatches() {
    const tbody = document.getElementById('dispatch-tbody');
    if (!tbody) return;

    // Use calcFilteredDispatches to avoid cache conflicts
    const filteredDispatches = typeof calcFilteredDispatches === 'function' ? calcFilteredDispatches() : dispatchesData;

    console.log('Rendering dispatches, count:', filteredDispatches.length);

    if (filteredDispatches.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    No dispatch records found matching your filters.
                </td>
            </tr>
        `;
        return;
    }
    // ... rest of renderDispatches is same, just need to close the block or target carefully
    // I will use StartLine/EndLine to target just the function call and top part

    tbody.innerHTML = filteredDispatches.map((d, index) => {
        const statusClass = getStatusClass(d.status);
        const dispatchDate = d.dispatch_date ? new Date(d.dispatch_date).toLocaleDateString() : '-';
        const expectedDate = d.expected_arrival_date ? new Date(d.expected_arrival_date).toLocaleDateString() : '-';
        const statusLabel = (d.status || '').replace(/_/g, ' ').toUpperCase();

        return `
            <tr class="animate-in" style="animation-delay: ${index * 0.03}s;">
                <td title="${d.dispatch_id}"><strong>${d.dispatch_id}</strong></td>
                <td title="${d.purchase_id}">${d.purchase_id}</td>
                <td>${dispatchDate}</td>
                <td title="${d.dispatched_by || ''}">${d.dispatched_by || '-'}</td>
                <td title="${d.supplier_name || ''}">${d.supplier_name || '-'}</td>
                <td title="${d.consignment_number || ''}">${d.consignment_number || '-'}</td>
                <td>${d.delivery_type || '-'}</td>
                <td>${expectedDate}</td>
                <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                <td>
                    <button class="action-btn" onclick="viewDispatch(${d.id})" title="View Details">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="updateDispatchStatusUI(${d.id}, '${d.status}')" title="Update Status">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="deleteDispatch(${d.id})" title="Delete" style="color: var(--danger);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ...

function calcFilteredDispatches() {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.toLowerCase() : '';
    };

    const dispatchId = getVal('filter-dispatch-id');
    const purchaseId = getVal('filter-dispatch-purchase-id');
    const supplier = getVal('filter-dispatch-supplier');
    const consignment = getVal('filter-dispatch-consignment');
    const dispatchedBy = getVal('filter-dispatch-by');

    // Exact match for dropdowns (but case insensitive)
    const elDelivery = document.getElementById('filter-dispatch-delivery');
    const delivery = elDelivery ? elDelivery.value : '';

    const elStatus = document.getElementById('filter-dispatch-status');
    const status = elStatus ? elStatus.value : '';

    const elDate = document.getElementById('filter-dispatch-date');
    const dispatchDate = elDate ? elDate.value : '';

    const elExpected = document.getElementById('filter-expected-date');
    const expectedDate = elExpected ? elExpected.value : '';

    console.log('Filtering with:', { status, delivery, dispatchId });

    return dispatchesData.filter(d => {
        if (dispatchId && !d.dispatch_id.toLowerCase().includes(dispatchId)) return false;
        if (purchaseId && !d.purchase_id.toLowerCase().includes(purchaseId)) return false;
        if (supplier && !(d.supplier_name || '').toLowerCase().includes(supplier)) return false;
        if (consignment && !(d.consignment_number || '').toLowerCase().includes(consignment)) return false;
        if (dispatchedBy && !(d.dispatched_by || '').toLowerCase().includes(dispatchedBy)) return false;

        if (delivery && (d.delivery_type || '').toString().toLowerCase().trim() !== delivery.toLowerCase().trim()) return false;
        if (status && (d.status || '').toString().toLowerCase().trim() !== status.toLowerCase().trim()) return false;

        if (dispatchDate) {
            const dDate = d.dispatch_date ? d.dispatch_date.substring(0, 10) : '';
            if (dDate !== dispatchDate) return false;
        }

        if (expectedDate) {
            const eDate = d.expected_arrival_date ? d.expected_arrival_date.substring(0, 10) : '';
            if (eDate !== expectedDate) return false;
        }

        return true;
    });
}

// NOTE: Filter event listeners are handled inline in index.html via applyDispatchFilters().
// Do NOT attach renderDispatches to filter elements here — it conflicts with inline filtering.

function getStatusClass(status) {
    const classes = {
        'ready_to_dispatch': 'status-pending', // New status
        'dispatched': 'status-open',
        'in_transit': 'status-confirmed',
        'delivered': 'status-delivered',
        'cancelled': 'status-cancelled'
    };
    return classes[status] || 'status-open';
}

function updateDispatchStats() {
    console.log('Updating dispatch stats...'); // Debug log
    const totalDispatches = document.getElementById('total-dispatches');
    const pendingDispatches = document.getElementById('pending-dispatches');
    const readyOrders = document.getElementById('ready-to-dispatch-count');

    if (totalDispatches) totalDispatches.textContent = dispatchesData.length;
    if (pendingDispatches) {
        const pending = dispatchesData.filter(d => d.status !== 'delivered' && d.status !== 'cancelled').length;
        pendingDispatches.textContent = pending;
    }
    if (readyOrders) readyOrders.textContent = readyToDispatchOrders.length;
}

// =============================================================================
// Event Listeners (non-filter only)
// =============================================================================

function setupDispatchEventListeners() {
    // Purchase order selection
    const poSelect = document.getElementById('dispatch-purchase-order');
    if (poSelect) {
        poSelect.addEventListener('change', onPurchaseOrderSelected);
    }

    // Submit dispatch button
    const submitBtn = document.getElementById('submit-dispatch-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitDispatch);
    }

    // NOTE: Filter listeners are handled inline in index.html
    // via applyDispatchFilters(). Do NOT add filter listeners here.
}

function resetDispatchFilters() {
    // Delegate to inline function if it exists
    if (typeof clearDispatchFiltersInline === 'function') {
        clearDispatchFiltersInline();
    }
}

function onPurchaseOrderSelected(e) {
    const selectedOption = e.target.selectedOptions[0];
    if (!selectedOption || !selectedOption.dataset.order) {
        currentDispatchItems = [];
        renderDispatchItemsTable();
        return;
    }

    const order = JSON.parse(selectedOption.dataset.order);

    // Populate header fields
    document.getElementById('dispatch-supplier-name').value = order.supplier_name || '';
    document.getElementById('dispatch-delivery-type').value = order.delivery_type || 'sea';
    document.getElementById('dispatch-currency').value = order.currency || 'USD';

    // Store supplier ID
    document.getElementById('dispatch-supplier-id').value = order.supplier_id || '';

    // Populate items
    currentDispatchItems = order.items.map(item => ({
        purchase_order_id: item.id,
        part_code: item.part_code,
        description: item.description || '',
        hsn_code: item.hsn_code || '',
        category_name: item.category_name || '',
        supplier_name: order.supplier_name || '',
        ordered_quantity: item.quantity,
        dispatch_quantity: item.quantity, // Default to full quantity
        price_currency: item.price_currency || order.currency || 'USD',
        original_price: item.unit_price || 0,
        dispatch_price: item.unit_price || 0 // Default to original price
    }));

    renderDispatchItemsTable();
    calculateDispatchTotals();
}

function renderDispatchItemsTable() {
    const tbody = document.getElementById('dispatch-items-tbody');
    if (!tbody) return;

    if (currentDispatchItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted);">
                    Select a purchase order to load items
                </td>
            </tr>
        `;
        return;
    }

    const currencySymbol = getCurrencySymbol(document.getElementById('dispatch-currency')?.value || 'USD');

    tbody.innerHTML = currentDispatchItems.map((item, index) => {
        const total = (item.dispatch_quantity * item.dispatch_price).toFixed(2);
        return `
            <tr>
                <td><strong>${item.part_code}</strong></td>
                <td>${item.description}</td>
                <td>${item.category_name || '-'}</td>
                <td>${item.ordered_quantity}</td>
                <td>
                    <input type="number" class="dispatch-qty-input" 
                           value="${item.dispatch_quantity}" 
                           min="0" max="${item.ordered_quantity}"
                           onchange="updateDispatchItemQty(${index}, this.value)"
                           style="width: 70px; padding: 4px 8px;">
                </td>
                <td>
                    <div class="input-with-icon" style="width: 100px;">
                        <span class="input-icon">${currencySymbol}</span>
                        <input type="number" class="dispatch-price-input" 
                               value="${item.dispatch_price.toFixed(6)}" 
                               step="0.000001"
                               onchange="updateDispatchItemPrice(${index}, this.value)"
                               style="padding-left: 24px;">
                    </div>
                </td>
                <td><strong>${currencySymbol}${total}</strong></td>
                <td>${item.supplier_name || '-'}</td>
            </tr>
        `;
    }).join('');
}

function updateDispatchItemQty(index, value) {
    const qty = parseInt(value) || 0;
    const item = currentDispatchItems[index];

    // Validate quantity
    if (qty > item.ordered_quantity) {
        showDispatchToast(`Quantity cannot exceed ordered quantity (${item.ordered_quantity})`, 'error');
        // Reset to ordered quantity
        currentDispatchItems[index].dispatch_quantity = item.ordered_quantity;
    } else if (qty < 0) {
        currentDispatchItems[index].dispatch_quantity = 0;
    } else {
        currentDispatchItems[index].dispatch_quantity = qty;
    }

    renderDispatchItemsTable();
    calculateDispatchTotals();
}

function updateDispatchItemPrice(index, value) {
    currentDispatchItems[index].dispatch_price = parseFloat(value) || 0;
    renderDispatchItemsTable();
    calculateDispatchTotals();
}

function calculateDispatchTotals() {
    let totalQty = 0;
    let totalAmount = 0;

    currentDispatchItems.forEach(item => {
        totalQty += item.dispatch_quantity;
        totalAmount += item.dispatch_quantity * item.dispatch_price;
    });

    const totalQtyEl = document.getElementById('dispatch-total-qty');
    const totalAmountEl = document.getElementById('dispatch-total-amount');
    const currencySymbol = getCurrencySymbol(document.getElementById('dispatch-currency')?.value || 'USD');

    if (totalQtyEl) totalQtyEl.textContent = totalQty;
    if (totalAmountEl) totalAmountEl.textContent = `${currencySymbol}${totalAmount.toFixed(2)}`;
}

function getCurrencySymbol(currency) {
    return { 'USD': '$', 'RMB': '¥', 'INR': '₹' }[currency] || '$';
}

// =============================================================================
// Dispatch CRUD Operations
// =============================================================================

async function submitDispatch() {
    // Validate mandatory fields
    const purchaseId = document.getElementById('dispatch-purchase-order').value;
    const dispatchedBy = document.getElementById('dispatch-dispatched-by').value;
    const deliveryType = document.getElementById('dispatch-delivery-type').value;
    const consignmentType = document.getElementById('dispatch-consignment-type').value;
    const consignmentNumber = document.getElementById('dispatch-consignment-number').value;
    const expectedDate = document.getElementById('dispatch-expected-date').value;

    if (!purchaseId) {
        showDispatchToast('Please select a Purchase Order', 'error');
        return;
    }
    if (!dispatchedBy) {
        showDispatchToast('Please enter Dispatched By name', 'error');
        return;
    }
    if (!deliveryType) {
        showDispatchToast('Please select Delivery Type', 'error');
        return;
    }
    if (!consignmentType) {
        showDispatchToast('Please select Consignment Type', 'error');
        return;
    }
    if (!consignmentNumber) {
        showDispatchToast('Please enter Consignment Number', 'error');
        return;
    }
    if (!expectedDate) {
        showDispatchToast('Please select Expected Arrival Date', 'error');
        return;
    }
    if (currentDispatchItems.length === 0) {
        showDispatchToast('No items to dispatch', 'error');
        return;
    }

    // Check if any items have dispatch quantity
    const hasItems = currentDispatchItems.some(item => item.dispatch_quantity > 0);
    if (!hasItems) {
        showDispatchToast('At least one item must have dispatch quantity > 0', 'error');
        return;
    }

    const payload = {
        purchase_id: purchaseId,
        dispatched_by: dispatchedBy,
        delivery_type: deliveryType,
        consignment_type: consignmentType,
        consignment_number: consignmentNumber,
        expected_arrival_date: expectedDate,
        supplier_id: parseInt(document.getElementById('dispatch-supplier-id').value) || null,
        supplier_name: document.getElementById('dispatch-supplier-name').value,
        currency: document.getElementById('dispatch-currency').value || 'USD',
        remarks: document.getElementById('dispatch-remarks').value,
        items: currentDispatchItems.filter(item => item.dispatch_quantity > 0)
    };

    const result = await fetchDispatchAPI('/dispatches', {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    if (result.success) {
        showDispatchToast(`Dispatch ${result.dispatch_id} created successfully!`, 'success');
        closeDispatchModal();
        loadDispatches();
        loadReadyToDispatchOrders(); // Refresh available orders
    } else {
        showDispatchToast(result.error || 'Error creating dispatch', 'error');
    }
}

async function viewDispatch(id) {
    const result = await fetchDispatchAPI(`/dispatches/${id}`);
    if (!result.success || !result.data) {
        showDispatchToast('Error loading dispatch details', 'error');
        return;
    }

    const dispatch = result.data;

    // Populate view modal
    const modal = document.getElementById('dispatch-view-modal');
    if (!modal) return;

    document.getElementById('view-dispatch-id').textContent = dispatch.dispatch_id;
    document.getElementById('view-purchase-id').textContent = dispatch.purchase_id;
    document.getElementById('view-dispatch-date').textContent = dispatch.dispatch_date
        ? new Date(dispatch.dispatch_date).toLocaleString() : '-';
    document.getElementById('view-dispatched-by').textContent = dispatch.dispatched_by || '-';
    document.getElementById('view-supplier-name').textContent = dispatch.supplier_name || '-';
    document.getElementById('view-delivery-type').textContent = dispatch.delivery_type || '-';
    document.getElementById('view-consignment-type').textContent = dispatch.consignment_type || '-';
    document.getElementById('view-consignment-number').textContent = dispatch.consignment_number || '-';
    document.getElementById('view-consignment-saved').textContent = dispatch.consignment_saved_at
        ? new Date(dispatch.consignment_saved_at).toLocaleString() : '-';
    document.getElementById('view-expected-date').textContent = dispatch.expected_arrival_date
        ? new Date(dispatch.expected_arrival_date).toLocaleDateString() : '-';
    document.getElementById('view-status').textContent = dispatch.status || '-';
    document.getElementById('view-currency').textContent = dispatch.currency || '-';
    document.getElementById('view-total-qty').textContent = dispatch.total_quantity || 0;
    document.getElementById('view-total-amount').textContent = `${getCurrencySymbol(dispatch.currency)}${(dispatch.total_amount || 0).toFixed(2)}`;

    // Render items
    const itemsTbody = document.getElementById('view-dispatch-items-tbody');
    if (itemsTbody && dispatch.items) {
        const symbol = getCurrencySymbol(dispatch.currency);
        itemsTbody.innerHTML = dispatch.items.map(item => `
            <tr>
                <td><strong>${item.part_code}</strong></td>
                <td>${item.description || '-'}</td>
                <td>${item.category_name || '-'}</td>
                <td>${item.ordered_quantity}</td>
                <td>${item.dispatch_quantity}</td>
                <td>${symbol}${(item.dispatch_price || 0).toFixed(6)}</td>
                <td><strong>${symbol}${(item.total || 0).toFixed(2)}</strong></td>
            </tr>
        `).join('');
    }

    modal.classList.add('active');
}

function closeDispatchViewModal() {
    const modal = document.getElementById('dispatch-view-modal');
    if (modal) modal.classList.remove('active');
}

async function updateDispatchStatusUI(id, currentStatus) {
    const statuses = ['dispatched', 'in_transit', 'delivered', 'cancelled'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    const confirmed = confirm(`Update status from "${currentStatus}" to "${nextStatus}"?`);
    if (!confirmed) return;

    const result = await fetchDispatchAPI(`/dispatches/${id}/status?status=${nextStatus}`, {
        method: 'PATCH'
    });

    if (result.success) {
        showDispatchToast(`Status updated to "${nextStatus}"`, 'success');
        loadDispatches();
    } else {
        showDispatchToast(result.error || 'Error updating status', 'error');
    }
}

async function deleteDispatch(id) {
    if (!confirm('Are you sure you want to delete this dispatch?')) return;

    const result = await fetchDispatchAPI(`/dispatches/${id}`, { method: 'DELETE' });

    if (result.success) {
        showDispatchToast('Dispatch deleted successfully', 'success');
        loadDispatches();
    } else {
        showDispatchToast(result.error || 'Error deleting dispatch', 'error');
    }
}

// =============================================================================
// Modal Control
// =============================================================================

function openDispatchModal() {
    // Reset form
    document.getElementById('dispatch-form').reset();
    currentDispatchItems = [];
    editingDispatchId = null;

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dispatch-expected-date').min = today;

    // Refresh available orders
    loadReadyToDispatchOrders();

    // Clear items table
    renderDispatchItemsTable();
    calculateDispatchTotals();

    // Update title
    document.getElementById('dispatch-form-title').textContent = 'New Dispatch';

    // Show form view
    document.getElementById('dispatch-view').style.display = 'none';
    document.getElementById('dispatch-form-view').style.display = 'block';
}

function closeDispatchModal() {
    document.getElementById('dispatch-form-view').style.display = 'none';
    document.getElementById('dispatch-view').style.display = 'block';
}

// =============================================================================
// Search
// =============================================================================

function handleDispatchSearch(e) {
    renderDispatches();
}

// =============================================================================
// Toast Notification
// =============================================================================

function showDispatchToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.className = `toast ${type} show`;
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// =============================================================================
// Auto-initialize when DOM is ready
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Delay initialization to ensure other modules load first
    setTimeout(() => {
        if (document.getElementById('dispatch-view')) {
            initializeDispatchModule();
        }
    }, 100);
});
