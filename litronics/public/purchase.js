/**
 * Litronics Product Management System - Purchase Module JavaScript
 */

// API_BASE is defined in app.js

// =============================================================================
// Global Data Storage
// =============================================================================

let purchaseOrdersData = [];
let productsForPurchase = [];
let suppliersForPurchase = [];
let currencyRatesForPurchase = { USD: 83.50, RMB: 11.50, INR: 1 };

// Choices.js instances
let productChoices = null;
let purchaseSupplierChoices = null;

// =============================================================================
// Initialize Purchase Module
// =============================================================================

function initializePurchaseModule() {
    try {
        console.log('Initializing Purchase Module...');

        // Check if critical elements exist
        const purchaseView = document.getElementById('purchase-view');
        if (!purchaseView) {
            console.error('Purchase view not found!');
            return;
        }

        initializePurchaseChoices();
        loadProductsForPurchase();
        loadSuppliersForPurchase();
        loadCurrencyRatesForPurchase();
        loadPurchaseOrders();
        setupPurchaseEventListeners();
        console.log('Purchase Module Initialized Successfully');
    } catch (e) {
        console.error('Error initializing purchase module:', e);
    }
}

// =============================================================================
// Initialize Choices.js Dropdowns
// =============================================================================

function initializePurchaseChoices() {
    // Product dropdown
    const productSelect = document.getElementById('purchase-product-id');
    if (productSelect) {
        if (productChoices) productChoices.destroy();
        productChoices = new Choices('#purchase-product-id', {
            searchEnabled: true,
            searchPlaceholderValue: 'Search products by part code...',
            itemSelectText: '',
            allowHTML: true,
            placeholder: true,
            placeholderValue: 'Select a product',
        });
    }

    // Supplier dropdown
    const supplierSelect = document.getElementById('purchase-supplier-id');
    if (supplierSelect) {
        if (purchaseSupplierChoices) purchaseSupplierChoices.destroy();
        purchaseSupplierChoices = new Choices('#purchase-supplier-id', {
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
// Event Listeners
// =============================================================================

function setupPurchaseEventListeners() {
    // Use closePurchaseModal for the Back/Cancel buttons
    // Note: onclick is often used in HTML, but consistent listeners are good
    const purchaseOrderForm = document.getElementById('purchase-order-form');
    const purchaseSearchInput = document.getElementById('purchase-search-input');

    // Form submission
    if (purchaseOrderForm) {
        purchaseOrderForm.addEventListener('submit', handlePurchaseFormSubmit);
    }

    // Payment Form
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
    }

    // Search
    if (purchaseSearchInput) {
        purchaseSearchInput.addEventListener('input', handlePurchaseSearch);
    }

    // Product selection - auto-fill related fields
    const productSelect = document.getElementById('purchase-product-id');
    if (productSelect) {
        productSelect.addEventListener('change', (e) => {
            const productId = parseInt(e.target.value);
            const product = productsForPurchase.find(p => p.id === productId);

            if (product) {
                // Auto-fill fields from product data
                safeSetValue('purchase-part-code', product.part_code || '');
                safeSetValue('purchase-item-description', product.description || '');
                safeSetValue('purchase-hsn-code', product.hsn_code || '');
                safeSetValue('purchase-category-name', product.category_name || '');

                // Set reference prices
                safeSetValue('purchase-price-usd', product.unit_price_usd || 0);
                safeSetValue('purchase-price-rmb', product.unit_price_rmb || 0);
                safeSetValue('purchase-price-inr', product.landed_price_inr || 0);

                // Set unit price based on selected currency
                updatePurchaseUnitPrice();
                calculatePurchaseTotal();
            }
        });
    }

    // Currency change
    const currencySelect = document.getElementById('purchase-price-currency');
    if (currencySelect) {
        currencySelect.addEventListener('change', () => {
            updatePurchaseCurrencySymbol();
            updatePurchaseUnitPrice();
            calculatePurchaseTotal();
        });
    }

    // Price/quantity changes - recalculate totals
    ['purchase-unit-price', 'purchase-quantity', 'purchase-other-charges',
        'purchase-gst-applicable', 'purchase-gst-percentage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', calculatePurchaseTotal);
                el.addEventListener('change', calculatePurchaseTotal);
            }
        });
}

function safeSetValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

// =============================================================================
// API Calls
// =============================================================================

async function fetchPurchaseAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        if (typeof showPurchaseToast === 'function') {
            showPurchaseToast('Error connecting to server', 'error');
        } else {
            alert('API Error: ' + error.message);
        }
        return { success: false, error: error.message };
    }
}

// =============================================================================
// Load Data
// =============================================================================

async function loadProductsForPurchase() {
    const result = await fetchPurchaseAPI('/products');
    if (result.success || result.data) {
        productsForPurchase = result.data || result;

        const choicesData = productsForPurchase.map(p => ({
            value: p.id,
            label: `${p.part_code} - ${p.description}`,
            customProperties: p
        }));

        if (productChoices) {
            productChoices.setChoices(choicesData, 'value', 'label', true);
        }
    }
}

async function loadSuppliersForPurchase() {
    const result = await fetchPurchaseAPI('/suppliers');
    if (result.success || result.data) {
        suppliersForPurchase = result.data || result;

        const choicesData = suppliersForPurchase.map(s => ({
            value: s.id,
            label: s.supplier_name
        }));

        if (purchaseSupplierChoices) {
            purchaseSupplierChoices.setChoices(choicesData, 'value', 'label', true);
        }
    }
}

async function loadCurrencyRatesForPurchase() {
    const result = await fetchPurchaseAPI('/currency-rates');
    if (result.success || result.data) {
        const data = result.data || result;
        data.forEach(rate => {
            currencyRatesForPurchase[rate.currency_code] = parseFloat(rate.rate_to_inr);
        });
    }
}

async function loadPurchaseOrders() {
    const result = await fetchPurchaseAPI('/purchase-orders');
    if (result.success || result.data) {
        purchaseOrdersData = result.data || result;
        renderPurchaseOrders(purchaseOrdersData);

        // Update stats
        const totalOrders = document.getElementById('total-purchase-orders');
        if (totalOrders) {
            totalOrders.textContent = purchaseOrdersData.length;
        }

        const openOrders = document.getElementById('open-purchase-orders');
        if (openOrders) {
            openOrders.textContent = purchaseOrdersData.filter(o => o.pi_status === 'open').length;
        }

        const totalValue = document.getElementById('total-purchase-value');
        if (totalValue && purchaseOrdersData.length > 0) {
            const total = purchaseOrdersData.reduce((sum, o) => sum + parseFloat(o.final_total || 0), 0);
            totalValue.textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        }
    }
}

// =============================================================================
// Render Purchase Orders Table
// =============================================================================

function renderPurchaseOrders(orders) {
    const purchaseOrdersTbody = document.getElementById('purchase-orders-tbody');
    if (!purchaseOrdersTbody) return;

    purchaseOrdersTbody.innerHTML = '';

    if (!orders || orders.length === 0) {
        purchaseOrdersTbody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    No purchase orders found. Click "New Order" to create one.
                </td>
            </tr>
        `;
        return;
    }

    orders.forEach((order, index) => {
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        tr.style.animationDelay = `${index * 0.05}s`;

        // Status badge color
        const statusColors = {
            'open': 'status-open',
            'confirmed': 'status-confirmed',
            'shipped': 'status-shipped',
            'delivered': 'status-delivered',
            'cancelled': 'status-cancelled'
        };
        const statusClass = statusColors[order.pi_status] || 'status-open';

        // Format delivery date
        const deliveryDate = order.delivery_date
            ? new Date(order.delivery_date).toLocaleDateString('en-IN')
            : '-';

        // Currency symbol
        const symbol = { USD: '$', RMB: '¥', INR: '₹' }[order.price_currency] || '₹';

        tr.innerHTML = `
            <td>
                <div style="display: flex; flex-direction: column;">
                    <strong>${order.order_number}</strong>
                    <small style="color: var(--text-muted); font-size: 0.75em;" title="Purchase ID for tracking">${order.purchase_id || '-'}</small>
                </div>
            </td>
            <td>${order.order_placed_by}</td>
            <td>${order.part_code || '-'}</td>
            <td>${order.supplier_name || '-'}</td>
            <td>${order.quantity}</td>
            <td>${symbol}${parseFloat(order.unit_price || 0).toFixed(2)}</td>
            <td>₹${parseFloat(order.other_charges || 0).toFixed(2)}</td>
            <td>₹${parseFloat(order.gst_amount || 0).toFixed(2)}</td>
            <td style="color: var(--secondary); font-weight: 600;">₹${parseFloat(order.final_total || 0).toFixed(2)}</td>
            <td>${deliveryDate}</td>
            <td><span class="status-badge ${statusClass}">${(order.pi_status || 'OPEN').toUpperCase()}</span></td>
            <td>
                <button class="action-btn" onclick="viewPurchaseOrder(${order.id})" title="View" style="cursor:pointer; color: var(--primary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
                <button class="action-btn" onclick="editPurchaseOrder(${order.id})" title="Edit" style="cursor:pointer; color: var(--secondary);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="action-btn" onclick="deletePurchaseOrder(${order.id})" title="Delete" style="cursor:pointer; color: var(--danger);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </td>
        `;
        purchaseOrdersTbody.appendChild(tr);
    });
}

// =============================================================================
// View Switching Functions (Replaces Modal)
// =============================================================================

function openPurchaseModal(order = null) {
    try {
        console.log('Opening Purchase Form View', order);
        const purchaseView = document.getElementById('purchase-view');
        const purchaseFormView = document.getElementById('purchase-form-view');
        const purchaseOrderForm = document.getElementById('purchase-order-form');

        if (!purchaseView || !purchaseFormView || !purchaseOrderForm) {
            alert('Error: View elements not found!');
            return;
        }

        // Hide List, Show Form
        purchaseView.style.display = 'none';
        purchaseFormView.style.display = 'block';

        purchaseOrderForm.reset();

        // Reset Choices
        if (productChoices) productChoices.removeActiveItems();
        if (purchaseSupplierChoices) purchaseSupplierChoices.removeActiveItems();

        const formTitle = document.getElementById('purchase-form-title');
        if (formTitle) {
            formTitle.textContent = order ? 'Edit Purchase Order' : 'New Purchase Order';
        }

        // Set defaults
        safeSetValue('purchase-quantity', 1);
        safeSetValue('purchase-other-charges', 0);
        const gstCheck = document.getElementById('purchase-gst-applicable');
        if (gstCheck) gstCheck.checked = true;
        safeSetValue('purchase-gst-percentage', 18);

        if (order) {
            // Edit mode - fill form
            safeSetValue('purchase-order-id', order.id);
            safeSetValue('purchase-order-placed-by', order.order_placed_by || '');
            safeSetValue('purchase-part-code', order.part_code || '');
            safeSetValue('purchase-item-description', order.item_description || '');
            safeSetValue('purchase-hsn-code', order.hsn_code || '');
            safeSetValue('purchase-category-name', order.category_name || '');

            if (order.supplier_id && purchaseSupplierChoices) {
                purchaseSupplierChoices.setChoiceByValue(order.supplier_id.toString());
            }

            safeSetValue('purchase-quantity', order.quantity || 1);
            safeSetValue('purchase-price-currency', order.price_currency || 'USD');
            safeSetValue('purchase-price-usd', order.price_usd || 0);
            safeSetValue('purchase-price-rmb', order.price_rmb || 0);
            safeSetValue('purchase-price-inr', order.price_inr || 0);
            safeSetValue('purchase-unit-price', order.unit_price || 0);
            safeSetValue('purchase-other-charges', order.other_charges || 0);
            if (gstCheck) gstCheck.checked = order.gst_applicable !== false;
            safeSetValue('purchase-gst-percentage', order.gst_percentage || 18);

            safeSetValue('purchase-delivery-date', order.delivery_date ? order.delivery_date.split('T')[0] : '');
            safeSetValue('purchase-delivery-type', order.delivery_type || 'sea');
            safeSetValue('purchase-remarks', order.remarks || '');
        } else {
            safeSetValue('purchase-order-id', '');
        }

        updatePurchaseCurrencySymbol();
        calculatePurchaseTotal();

    } catch (e) {
        console.error('Error opening form view:', e);
        alert('Error opening form: ' + e.message);
    }
}

function closePurchaseModal() {
    const purchaseView = document.getElementById('purchase-view');
    const purchaseFormView = document.getElementById('purchase-form-view');

    if (purchaseFormView) purchaseFormView.style.display = 'none';
    if (purchaseView) purchaseView.style.display = 'block';
}

// =============================================================================
// Form Submission
// =============================================================================

async function handlePurchaseFormSubmit(e) {
    e.preventDefault();

    const orderId = document.getElementById('purchase-order-id').value;
    const isEdit = orderId && orderId !== '';

    // ... validation ...
    const data = {
        order_placed_by: document.getElementById('purchase-order-placed-by').value,
        product_id: parseInt(document.getElementById('purchase-product-id').value) || null,
        part_code: document.getElementById('purchase-part-code').value,
        item_description: document.getElementById('purchase-item-description').value,
        hsn_code: document.getElementById('purchase-hsn-code').value,
        category_name: document.getElementById('purchase-category-name').value,
        supplier_id: parseInt(document.getElementById('purchase-supplier-id').value) || null,
        quantity: parseInt(document.getElementById('purchase-quantity').value) || 1,
        price_currency: document.getElementById('purchase-price-currency').value,
        price_usd: parseFloat(document.getElementById('purchase-price-usd').value) || 0,
        price_rmb: parseFloat(document.getElementById('purchase-price-rmb').value) || 0,
        price_inr: parseFloat(document.getElementById('purchase-price-inr').value) || 0,
        unit_price: parseFloat(document.getElementById('purchase-unit-price').value) || 0,
        other_charges: parseFloat(document.getElementById('purchase-other-charges').value) || 0,
        gst_applicable: document.getElementById('purchase-gst-applicable').checked,
        gst_percentage: parseFloat(document.getElementById('purchase-gst-percentage').value) || 18,
        delivery_date: document.getElementById('purchase-delivery-date').value || null,
        delivery_type: document.getElementById('purchase-delivery-type').value,
        remarks: document.getElementById('purchase-remarks').value,
    };

    const endpoint = isEdit ? `/purchase-orders/${orderId}` : '/purchase-orders';
    const method = isEdit ? 'PUT' : 'POST';

    const result = await fetchPurchaseAPI(endpoint, {
        method: method,
        body: JSON.stringify(data)
    });

    if (result.success || result.id) {
        showPurchaseToast(
            isEdit ? 'Purchase order updated successfully!' : `Purchase order ${result.order_number} created!`,
            'success'
        );
        closePurchaseModal();
        loadPurchaseOrders();
    } else {
        showPurchaseToast(result.error || result.detail || 'Error saving purchase order', 'error');
    }
}

// =============================================================================
// Search
// =============================================================================

function handlePurchaseSearch(e) {
    const query = e.target.value.toLowerCase();
    const rows = document.getElementById('purchase-orders-tbody').querySelectorAll('tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// =============================================================================
// Helper Functions
// =============================================================================

function updatePurchaseCurrencySymbol() {
    const currencyEl = document.getElementById('purchase-price-currency');
    if (currencyEl) {
        const symbol = { 'USD': '$', 'RMB': '¥', 'INR': '₹' }[currencyEl.value] || '$';
        const sEl = document.getElementById('purchase-currency-symbol');
        if (sEl) sEl.textContent = symbol;
    }
}

function updatePurchaseUnitPrice() {
    const currencyEl = document.getElementById('purchase-price-currency');
    if (!currencyEl) return;
    let price = 0;
    if (currencyEl.value === 'USD') price = parseFloat(document.getElementById('purchase-price-usd').value) || 0;
    else if (currencyEl.value === 'RMB') price = parseFloat(document.getElementById('purchase-price-rmb').value) || 0;
    else price = parseFloat(document.getElementById('purchase-price-inr').value) || 0;
    const unitPriceEl = document.getElementById('purchase-unit-price');
    if (unitPriceEl) unitPriceEl.value = price;
}

function calculatePurchaseTotal() {
    const unitPrice = parseFloat(document.getElementById('purchase-unit-price').value) || 0;
    const quantity = parseInt(document.getElementById('purchase-quantity').value) || 1;
    const otherCharges = parseFloat(document.getElementById('purchase-other-charges').value) || 0;
    const gstCheck = document.getElementById('purchase-gst-applicable');
    const gstApplicable = gstCheck ? gstCheck.checked : true;
    const gstPercentage = parseFloat(document.getElementById('purchase-gst-percentage').value) || 18;
    const currency = document.getElementById('purchase-price-currency').value;
    const rate = currencyRatesForPurchase[currency] || 1;

    // Convert to INR for display
    const unitPriceInr = unitPrice * rate;  // If currency is INR, rate is 1. If USD, rate is 83.5.
    // wait, logic in inline was: (unitPrice * rate) * quantity.
    // Let's stick to simple logic matching existing code.

    const subtotal = (unitPrice * rate) * quantity;
    const total = subtotal + otherCharges;
    const gstAmount = gstApplicable ? total * (gstPercentage / 100) : 0;
    const finalTotal = total + gstAmount;

    const setC = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = '₹' + v.toFixed(2); };
    setC('calc-purchase-subtotal', subtotal);
    setC('calc-purchase-other', otherCharges);
    setC('calc-purchase-total', total);
    setC('calc-purchase-gst', gstAmount);
    setC('calc-purchase-final', finalTotal);
}

// =============================================================================
// Toast Notification
// =============================================================================

function showPurchaseToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.className = `toast ${type} show`;
        const msg = toast.querySelector('.toast-message');
        if (msg) msg.textContent = message;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// =============================================================================
// Export for Global Access
// =============================================================================

function viewPurchaseOrder(id) {
    const order = purchaseOrdersData.find(o => o.id === id);
    if (order) {
        // Simple view implementation - reuse edit form in read-only or just populate
        // For now, let's just use the edit modal as a view
        openPurchaseModal(order);
    }
}

function editPurchaseOrder(id) {
    const order = purchaseOrdersData.find(o => o.id === id);
    if (order) {
        openPurchaseModal(order);
    }
}

async function deletePurchaseOrder(id) {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    const result = await fetchPurchaseAPI(`/purchase-orders/${id}`, { method: 'DELETE' });
    if (result.success) {
        showPurchaseToast('Purchase order deleted successfully');
        loadPurchaseOrders();
    } else {
        showPurchaseToast(result.error || result.detail || 'Error deleting order', 'error');
    }
}

window.viewPurchaseOrder = viewPurchaseOrder;
window.editPurchaseOrder = editPurchaseOrder;
window.deletePurchaseOrder = deletePurchaseOrder;
window.initializePurchaseModule = initializePurchaseModule;
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;

// =============================================================================
// Payment Functions
// =============================================================================

window.openPaymentSummaryModal = function () {
    console.log('--- Opening Payment Summary Modal ---');
    const modal = document.getElementById('payment-summary-modal');

    if (modal) {
        // Just add the active class; CSS handles display/opacity/visibility
        modal.classList.add('active');

        // Failsafe: Explicitly set styles just in case CSS fails to load or conflict
        modal.style.display = 'flex';
        modal.style.position = 'fixed'; // Ensure it's fixed
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw'; // Explicit full width
        modal.style.height = '100vh'; // Explicit full height
        modal.style.backgroundColor = 'rgba(0,0,0,0.8)'; // Explicit bg
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
        modal.style.zIndex = '9999'; // Nuclear option z-index
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Move to end of body to avoid stacking context issues
        document.body.appendChild(modal);

        console.log('Class "active" added to payment modal');
        console.log('Modal computed display:', window.getComputedStyle(modal).display);
        console.log('Modal computed zIndex:', window.getComputedStyle(modal).zIndex);
        console.log('Modal computed visibility:', window.getComputedStyle(modal).visibility);

        // Load content
        const tbody = document.getElementById('payment-summary-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px;">Loading data...</td></tr>';
        }

        loadPaymentSummary().then(() => {
            console.log('Payment summary data loaded successfully');
        }).catch(err => {
            console.error('Failed to load payment summary:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--danger);">Error: ${err.message}</td></tr>`;
            }
        });
    } else {
        console.error('CRITICAL: Element #payment-summary-modal not found in DOM');
        alert('Internal Error: Payment modal element missing. Please check index.html.');
    }
};

// Global Safety: Close modals on Escape key
document.addEventListener('keydown', function (event) {
    if (event.key === "Escape") {
        if (window.closePaymentSummaryModal) window.closePaymentSummaryModal();
        if (window.closePaymentFormModal) window.closePaymentFormModal();
        if (window.closePurchaseModal) window.closePurchaseModal();
        if (typeof closeModal === 'function') closeModal(); // Product modal
    }
});

function closePaymentSummaryModal() {
    const modal = document.getElementById('payment-summary-modal');
    if (modal) {
        modal.classList.remove('active');
        // Clean up explicit styles
        modal.style.display = '';
        modal.style.position = '';
        modal.style.top = '';
        modal.style.left = '';
        modal.style.width = '';
        modal.style.height = '';
        modal.style.backgroundColor = '';
        modal.style.opacity = '';
        modal.style.visibility = '';
        modal.style.zIndex = '';
        document.body.style.overflow = '';
    }
}

async function loadPaymentSummary() {
    const tbody = document.getElementById('payment-summary-tbody');
    if (!tbody) return;

    try {
        const result = await fetchPurchaseAPI('/suppliers/payment-summary');

        if (result.success) {
            tbody.innerHTML = '';
            // Check if result.data is array or if result IS the array (handling both formats just in case)
            const data = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No pending payments.</td></tr>';
                return;
            }

            data.forEach(item => {
                const tr = document.createElement('tr');

                // Payment status badge styling
                const statusColor = item.payment_status === 'Paid' ? 'var(--success)' :
                    (item.payment_status === 'Partial' ? 'var(--warning)' : 'var(--danger)');

                tr.innerHTML = `
                    <td>
                        <div style="display: flex; flex-direction: column;">
                            <strong>${item.supplier_name}</strong>
                            <small style="color: var(--text-muted);">${item.supplier_code || ''}</small>
                        </div>
                    </td>
                    <td>
                        <span title="Total: ${item.total_orders} | Open: ${item.open_orders} | Delivered: ${item.delivered_orders}">
                            ${item.total_orders} orders
                        </span>
                    </td>
                    <td>₹${parseFloat(item.total_purchase_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="color: var(--success);">₹${parseFloat(item.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td style="color: var(--danger); font-weight: bold;">₹${parseFloat(item.balance_pending || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td>
                        <span class="status-badge" style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.75em;">
                            ${item.payment_status}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm" style="margin-right: 5px; background: var(--bg-input); color: var(--text-primary);" 
                                onclick="viewSupplierPaymentDetails(${item.supplier_id})" title="View Details">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                        ${item.balance_pending > 0 ? `
                        <button class="btn btn-sm btn-primary" onclick="openPaymentFormModal(${item.supplier_id}, '${item.supplier_name.replace(/'/g, "\\'")}', ${item.balance_pending})">
                            Pay
                        </button>
                        ` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            console.error('API Error:', result);
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading data. ' + (result.error || result.detail || '') + '</td></tr>';
        }
    } catch (e) {
        console.error('Load Summary Error:', e);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Connection Error</td></tr>';
    }
}

// View detailed payment information for a supplier
async function viewSupplierPaymentDetails(supplierId) {
    try {
        const result = await fetchPurchaseAPI(`/suppliers/${supplierId}/payment-details`);

        if (result.success) {
            // Create a detailed view modal or alert
            const data = result.data;
            const supplier = data.supplier || {}; // Fallback if structure differs
            // Actually API returns: {id:..., supplier_id:..., ...} ? 
            // Wait, let's check routes.py response structure for /suppliers/{id}/payment-details
            // It returns {success:true, data: {supplier:..., summary:..., orders:..., payments:...}}
            // So data.supplier is correct.

            const summary = data.summary || {};
            const orders = data.orders || [];

            let ordersList = orders.map(o =>
                `• ${o.order_number}: ${o.part_code || 'N/A'} - ₹${(o.final_total || 0).toLocaleString('en-IN')} (${o.status})`
            ).join('\n');

            if (!ordersList) ordersList = 'No orders found';

            const message = `
=== ${supplier.name || supplier.supplier_name || 'Supplier'} Payment Details ===

Summary:
- Total Orders: ${summary.total_orders}
- Total Value: ₹${(summary.total_order_value || 0).toLocaleString('en-IN')}
- Total Paid: ₹${(summary.total_paid || 0).toLocaleString('en-IN')}
- Balance Pending: ₹${(summary.balance_pending || 0).toLocaleString('en-IN')}

Orders:
${ordersList}
            `;

            alert(message.trim());
        } else {
            showPurchaseToast('Error loading supplier details', 'error');
        }
    } catch (e) {
        console.error('Error:', e);
        showPurchaseToast('Error loading supplier details', 'error');
    }
}

// Export the new function
window.viewSupplierPaymentDetails = viewSupplierPaymentDetails;

window.openPaymentFormModal = function (supplierId, supplierName, balance) {
    const modal = document.getElementById('payment-form-modal');
    if (modal) {
        document.getElementById('pay-supplier-id').value = supplierId;
        document.getElementById('pay-supplier-name').value = supplierName;
        document.getElementById('pay-amount').value = balance > 0 ? balance : '';
        document.getElementById('pay-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('pay-reference').value = '';
        document.getElementById('pay-remarks').value = '';

        modal.classList.add('active');
        // Failsafe styles
        modal.style.display = 'flex';
        modal.style.zIndex = '2600'; // Higher than summary
        // Note: we don't toggle overflow here because summary modal is likely already open and handles it, 
        // or we want to keep background frozen. Doubling up is fine.
    }
};

function closePaymentFormModal() {
    const modal = document.getElementById('payment-form-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
        modal.style.zIndex = '';
    }
}

async function handlePaymentSubmit(e) {
    e.preventDefault();

    const data = {
        supplier_id: parseInt(document.getElementById('pay-supplier-id').value),
        amount: parseFloat(document.getElementById('pay-amount').value),
        payment_date: document.getElementById('pay-date').value,
        payment_mode: document.getElementById('pay-mode').value,
        reference_number: document.getElementById('pay-reference').value,
        remarks: document.getElementById('pay-remarks').value
    };

    const result = await fetchPurchaseAPI('/payments', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    if (result.success) {
        showPurchaseToast('Payment recorded successfully!', 'success');
        closePaymentFormModal();
        loadPaymentSummary(); // Refresh summary table
    } else {
        showPurchaseToast(result.detail || 'Error recording payment', 'error');
    }
}

// Export Payment Functions
// Attached to window above
window.closePaymentSummaryModal = closePaymentSummaryModal;
window.closePaymentFormModal = closePaymentFormModal;

