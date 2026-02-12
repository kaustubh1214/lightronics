/**
 * Litronics Product Management System - Frontend JavaScript
 * Updated to use unified HSN Category Master
 */

const API_BASE = '/api';

// DOM Elements
const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const addProductBtn = document.getElementById('add-product-btn');
const closeModalBtn = document.getElementById('close-modal');
const cancelBtn = document.getElementById('cancel-btn');
const productsTbody = document.getElementById('products-tbody');
const searchInput = document.getElementById('search-input');
const toast = document.getElementById('toast');

// Category Modal Elements (replaces old HSN modal)
const categoryModal = document.getElementById('category-modal');
const categoryForm = document.getElementById('category-form');
const addNewCategoryLink = document.getElementById('add-new-category-link');
const closeCategoryModalBtn = document.getElementById('close-category-modal');
const cancelCategoryBtn = document.getElementById('cancel-category-btn');

// Currency rates (will be fetched from API)
let currencyRates = { USD: 83.50, RMB: 11.50, INR: 1 };

// Choices.js instances for searchable dropdowns
let hsnCategoryChoices = null;
let supplierChoices = null;

// Global Data Storage
let hsnCategoryMasterData = [];
let suppliersData = [];
let productsData = [];

// Legacy data (backward compat)
let categoriesData = [];
let hsnCodesData = [];

// Edit Mode Tracking
let editingProductId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');

    // Initialize Navigation
    setupNavigation();

    // Initialize Modules
    try {
        initializeChoices();

        // Initialize Purchase Module if available
        if (typeof initializePurchaseModule === 'function') {
            initializePurchaseModule();
        }

    } catch (e) {
        console.error('Initialization error:', e);
    }

    loadHsnCategoryMaster();
    loadSuppliers();
    loadCurrencyRates();
    loadProducts();

    // Legacy loads (for purchase module backward compat)
    loadCategories();
    loadHsnCodes();

    try {
        setupEventListeners();
    } catch (e) {
        console.error('Event listeners error:', e);
    }
});

function setupNavigation() {
    console.log('Setting up navigation...');
    const navItems = document.querySelectorAll('.nav-item');
    const moduleViews = document.querySelectorAll('.module-view');

    console.log(`Found ${navItems.length} nav items and ${moduleViews.length} module views`);

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetModule = item.dataset.module;
            console.log(`Navigating to: ${targetModule}`);

            const targetView = document.getElementById(`${targetModule}-view`);
            if (!targetView) {
                console.warn(`View not found for module: ${targetModule}`);
                if (['products', 'purchase', 'dispatch'].includes(targetModule)) {
                    // Specific logic for implemented modules
                } else {
                    alert(`The ${targetModule} module is coming soon!`);
                    return;
                }
            }

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            moduleViews.forEach(view => {
                view.classList.remove('active');
                view.style.display = 'none';
            });

            if (targetView) {
                targetView.classList.add('active');
                targetView.style.display = 'block';
                console.log(`activated view: ${targetModule}-view`);
            }
        });
    });
}

// Initialize Choices.js dropdowns
function initializeChoices() {
    // HSN Category Master: Single-select searchable (replaces old category + HSN dropdowns)
    hsnCategoryChoices = new Choices('#hsn_category_id', {
        searchEnabled: true,
        searchPlaceholderValue: 'Search categories...',
        itemSelectText: '',
        placeholder: true,
        placeholderValue: 'Select Category',
        allowHTML: true,
        shouldSort: false
    });

    // Supplier: Multi-select searchable
    supplierChoices = new Choices('#supplier_ids', {
        searchEnabled: true,
        searchPlaceholderValue: 'Search suppliers...',
        removeItemButton: true,
        itemSelectText: '',
        placeholder: true,
        placeholderValue: 'Select Suppliers',
        allowHTML: true,
        shouldSort: false
    });
}

// Event Listeners
function setupEventListeners() {
    addProductBtn.addEventListener('click', () => openModal());
    closeModalBtn.addEventListener('click', () => closeModal());
    cancelBtn.addEventListener('click', () => closeModal());
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) closeModal();
    });
    productForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', handleSearch);

    // Price calculation listeners
    ['form_unit_price_usd', 'form_unit_price_rmb', 'form_unit_price_inr',
        'basic_custom_duty_percentage', 'freight_percentage', 'gst_percentage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', calculateLandedPrice);
                if (id.includes('form_unit_price')) {
                    el.addEventListener('change', (e) => {
                        const val = parseFloat(e.target.value) || 0;
                        // USD & RMB = 6 decimals, INR = 3 decimals
                        if (id.includes('inr')) {
                            e.target.value = val.toFixed(3);
                        } else {
                            e.target.value = val.toFixed(6);
                        }
                        calculateLandedPrice();
                    });
                }
            }
        });

    // =========================================================================
    // HSN Category Master change → auto-fill HSN Code, BCD%, GST%
    // =========================================================================
    document.getElementById('hsn_category_id').addEventListener('change', (e) => {
        const selectedId = parseInt(e.target.value);
        const entry = hsnCategoryMasterData.find(c => c.id === selectedId);

        if (entry) {
            // Auto-fill HSN Code (read-only)
            const hsnField = document.getElementById('auto_hsn_code');
            if (hsnField) hsnField.value = entry.hsn_code || '';

            // Auto-fill Custom Duty %
            const bcdField = document.getElementById('basic_custom_duty_percentage');
            if (bcdField) bcdField.value = entry.custom_duty_percentage || 0;

            // Auto-fill GST %
            const gstField = document.getElementById('gst_percentage');
            if (gstField) gstField.value = entry.gst_percentage || 18;
        } else {
            // Clear auto-filled fields
            const hsnField = document.getElementById('auto_hsn_code');
            if (hsnField) hsnField.value = '';
            const bcdField = document.getElementById('basic_custom_duty_percentage');
            if (bcdField) bcdField.value = 0;
            const gstField = document.getElementById('gst_percentage');
            if (gstField) gstField.value = 18;
        }

        calculateLandedPrice();
    });

    // =========================================================================
    // Category Modal (Add New Category) events
    // =========================================================================
    if (addNewCategoryLink) {
        addNewCategoryLink.addEventListener('click', (e) => {
            e.preventDefault();
            openCategoryModal();
        });
    }

    if (closeCategoryModalBtn) {
        closeCategoryModalBtn.addEventListener('click', () => closeCategoryModal());
    }
    if (cancelCategoryBtn) {
        cancelCategoryBtn.addEventListener('click', () => closeCategoryModal());
    }
    if (categoryModal) {
        categoryModal.addEventListener('click', (e) => {
            if (e.target === categoryModal) closeCategoryModal();
        });
    }
    if (categoryForm) {
        categoryForm.addEventListener('submit', handleCategoryFormSubmit);
    }
}


// =============================================================================
// Category Modal Functions (replaces old HSN modal)
// =============================================================================

function openCategoryModal() {
    categoryForm.reset();
    categoryModal.classList.add('active');
}

function closeCategoryModal() {
    categoryModal.classList.remove('active');
}

async function handleCategoryFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(categoryForm);
    const data = {};
    formData.forEach((value, key) => data[key] = value);

    // Convert numeric fields
    data.custom_duty_percentage = parseFloat(data.custom_duty_percentage) || 0;
    data.gst_percentage = parseFloat(data.gst_percentage) || 18;

    const result = await fetchAPI('/hsn-category-master', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    if (result.success) {
        showToast('Category added successfully!', 'success');
        closeCategoryModal();
        await loadHsnCategoryMaster(); // Reload dropdown

        // Auto-select the newly created category
        if (hsnCategoryChoices && result.id) {
            setTimeout(() => {
                hsnCategoryChoices.setChoiceByValue(result.id);
                hsnCategoryChoices.setChoiceByValue(String(result.id));

                // Trigger auto-fill
                const event = new Event('change');
                document.getElementById('hsn_category_id').dispatchEvent(event);
            }, 100);
        }
    } else {
        showToast(result.error || result.detail || 'Error adding category', 'error');
    }
}


// =============================================================================
// API Calls
// =============================================================================

async function fetchAPI(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        showToast('Error connecting to server', 'error');
        return { success: false, error: error.message };
    }
}


// =============================================================================
// Data Loading
// =============================================================================

async function loadHsnCategoryMaster() {
    const result = await fetchAPI('/hsn-category-master');
    if (result.success || result.data) {
        hsnCategoryMasterData = result.data || result;
        const choicesData = hsnCategoryMasterData.map(entry => ({
            value: entry.id,
            label: `${entry.category_name}  [HSN: ${entry.hsn_code}]`,
            customProperties: {
                hsn_code: entry.hsn_code,
                duty: entry.custom_duty_percentage,
                gst: entry.gst_percentage,
            }
        }));

        if (hsnCategoryChoices) {
            hsnCategoryChoices.setChoices(choicesData, 'value', 'label', true);
        }

        // Update categories count stat
        const el = document.getElementById('total-categories');
        if (el) el.textContent = hsnCategoryMasterData.length;
    }
}

// Legacy: load old categories (for purchase module backward compat)
async function loadCategories() {
    const result = await fetchAPI('/categories');
    if (result.success || result.data) {
        categoriesData = result.data || result;
    }
}

// Legacy: load old HSN codes (for purchase module backward compat)
async function loadHsnCodes() {
    const result = await fetchAPI('/hsn-codes');
    if (result.success || result.data) {
        hsnCodesData = result.data || result;
    }
}

async function loadSuppliers() {
    const result = await fetchAPI('/suppliers');
    if (result.success || result.data) {
        suppliersData = result.data || result;
        const choicesData = suppliersData.map(sup => ({
            value: sup.id,
            label: sup.supplier_name
        }));

        if (supplierChoices) {
            supplierChoices.setChoices(choicesData, 'value', 'label', true);
        }
        document.getElementById('total-suppliers').textContent = suppliersData.length;
    }
}

// Function to get HSN data by ID (legacy compat)
function getHsnById(hsnId) {
    return hsnCodesData.find(hsn => hsn.id === parseInt(hsnId));
}

async function loadCurrencyRates() {
    const result = await fetchAPI('/currency-rates');
    if (result.success || result.data) {
        const data = result.data || result;
        data.forEach(rate => {
            currencyRates[rate.currency_code] = parseFloat(rate.rate_to_inr);
        });
        document.getElementById('usd-rate').textContent = `₹${currencyRates.USD?.toFixed(2) || '83.50'}`;
        document.getElementById('rmb-rate').textContent = `₹${currencyRates.RMB?.toFixed(2) || '11.50'}`;
    }
}

async function loadProducts() {
    const result = await fetchAPI('/products');
    if (result.success || result.data) {
        productsData = result.data || result;
        renderProducts(productsData);
        document.getElementById('total-products').textContent = productsData.length;

        if (productsData.length > 0) {
            const avg = productsData.reduce((sum, p) => sum + parseFloat(p.landed_price_inr || 0), 0) / productsData.length;
            document.getElementById('avg-price').textContent = `₹${avg.toFixed(2)}`;
        }
    }
}


// =============================================================================
// Rendering
// =============================================================================

function renderProducts(products) {
    productsTbody.innerHTML = '';

    if (products.length === 0) {
        productsTbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    No products found. Click "Add Product" to create one.
                </td>
            </tr>
        `;
        return;
    }

    products.forEach((product, index) => {
        const hasPrice = (parseFloat(product.unit_price_usd || 0) > 0) ||
            (parseFloat(product.unit_price_rmb || 0) > 0) ||
            (parseFloat(product.unit_price_inr || 0) > 0);

        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        tr.style.animationDelay = `${index * 0.05}s`;
        tr.dataset.hasPrice = hasPrice ? 'yes' : 'no';

        if (!hasPrice) {
            tr.classList.add('no-price-row');
        }

        const priceUsd = hasPrice
            ? `$${parseFloat(product.unit_price_usd || 0).toFixed(6)}`
            : '<span class="no-price-badge">⚠ No Price</span>';
        const priceRmb = hasPrice
            ? `¥${parseFloat(product.unit_price_rmb || 0).toFixed(6)}`
            : '';

        const landedDisplay = hasPrice
            ? `₹${parseFloat(product.landed_price_inr || 0).toFixed(2)}`
            : '<span class="no-price-badge">Pending</span>';

        tr.innerHTML = `
            <td><strong>${product.part_code}</strong></td>
            <td>${product.description}</td>
            <td><span class="category-badge">${product.category_name || '-'}</span></td>
            <td>${priceUsd}</td>
            <td>${priceRmb}</td>
            <td>${product.basic_custom_duty_percentage || 0}%</td>
            <td>${product.freight_percentage || 0}%</td>
            <td>${product.gst_percentage || 18}%</td>
            <td style="color: ${hasPrice ? 'var(--secondary)' : 'var(--text-muted)'}; font-weight: 600;">${landedDisplay}</td>
            <td>
                <button class="action-btn" onclick="editProduct(${product.id})" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="action-btn" onclick="deleteProduct(${product.id})" title="Delete" style="color: var(--danger);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </td>
        `;
        productsTbody.appendChild(tr);
    });

    // Update no-price count in stats
    const noPriceCount = products.filter(p =>
        (parseFloat(p.unit_price_usd || 0) === 0) &&
        (parseFloat(p.unit_price_rmb || 0) === 0) &&
        (parseFloat(p.unit_price_inr || 0) === 0)
    ).length;

    // After render, reapply any active filter
    applyProductFilters();
}


// =============================================================================
// Modal Functions
// =============================================================================

function openModal(product = null) {
    productForm.reset();

    editingProductId = product ? product.id : null;

    // Reset Choices
    if (hsnCategoryChoices) hsnCategoryChoices.removeActiveItems();
    if (supplierChoices) supplierChoices.removeActiveItems();

    // Clear auto-filled fields
    const hsnField = document.getElementById('auto_hsn_code');
    if (hsnField) hsnField.value = '';

    document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add New Product';

    if (product) {
        Object.keys(product).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = product[key];
        });

        // Load prices
        document.getElementById('form_unit_price_usd').value = parseFloat(product.unit_price_usd || 0).toFixed(6);
        document.getElementById('form_unit_price_rmb').value = parseFloat(product.unit_price_rmb || 0).toFixed(6);
        document.getElementById('form_unit_price_inr').value = parseFloat(product.unit_price_inr || 0).toFixed(3);

        setTimeout(() => {
            // Set the HSN Category Master dropdown
            if (hsnCategoryChoices && product.hsn_category_id) {
                hsnCategoryChoices.setChoiceByValue(parseInt(product.hsn_category_id));
                hsnCategoryChoices.setChoiceByValue(String(product.hsn_category_id));

                // Auto-fill the HSN/duty/GST fields from selected category
                const entry = hsnCategoryMasterData.find(c => c.id === parseInt(product.hsn_category_id));
                if (entry) {
                    const hf = document.getElementById('auto_hsn_code');
                    if (hf) hf.value = entry.hsn_code || '';
                    document.getElementById('basic_custom_duty_percentage').value = entry.custom_duty_percentage || 0;
                    document.getElementById('gst_percentage').value = entry.gst_percentage || 18;
                }
            }

            // Handle supplier selection
            if (product.supplier_ids && supplierChoices) {
                const idsNum = Array.isArray(product.supplier_ids)
                    ? product.supplier_ids.map(id => parseInt(id))
                    : [parseInt(product.supplier_ids)];

                const idsStr = idsNum.map(id => String(id));

                supplierChoices.setChoiceByValue(idsNum);
                supplierChoices.setChoiceByValue(idsStr);
            }

            console.log('Choices set for product:', product.id);
        }, 50);

        console.log('Editing Product Data:', product);
    } else {
        document.getElementById('form_unit_price_usd').value = '0.000000';
        document.getElementById('form_unit_price_rmb').value = '0.000000';
        document.getElementById('form_unit_price_inr').value = '0.000';
    }

    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(calculateLandedPrice, 100);
}

function closeModal() {
    productModal.classList.remove('active');
    document.body.style.overflow = '';
    editingProductId = null;
}


// =============================================================================
// Form Submission
// =============================================================================

function getDeterminePrimaryCurrency() {
    const usd = parseFloat(document.getElementById('form_unit_price_usd').value) || 0;
    const rmb = parseFloat(document.getElementById('form_unit_price_rmb').value) || 0;
    const inr = parseFloat(document.getElementById('form_unit_price_inr').value) || 0;

    if (usd > 0) return 'USD';
    if (rmb > 0) return 'RMB';
    if (inr > 0) return 'INR';
    return 'USD';
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(productForm);
    const data = {};

    formData.forEach((value, key) => {
        if (!['supplier_ids', 'form_unit_price_usd', 'form_unit_price_rmb', 'form_unit_price_inr', 'primary_currency'].includes(key)) {
            if (value) {
                data[key] = isNaN(value) ? value : parseFloat(value) || value;
            }
        }
    });

    // Pricing
    data.unit_price_usd = parseFloat(document.getElementById('form_unit_price_usd').value) || 0;
    data.unit_price_rmb = parseFloat(document.getElementById('form_unit_price_rmb').value) || 0;
    data.unit_price_inr = parseFloat(document.getElementById('form_unit_price_inr').value) || 0;
    data.primary_currency = getDeterminePrimaryCurrency();

    // Suppliers
    const supplierSelect = document.getElementById('supplier_ids');
    data.supplier_ids = Array.from(supplierSelect.selectedOptions).map(opt => parseInt(opt.value));

    // HSN Category Master ID
    if (data.hsn_category_id) data.hsn_category_id = parseInt(data.hsn_category_id);

    // Submit
    let result;
    if (editingProductId) {
        result = await fetchAPI(`/products/${editingProductId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    } else {
        result = await fetchAPI('/products', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    if (result.success || result.id) {
        showToast(editingProductId ? 'Product updated successfully!' : 'Product created successfully!', 'success');
        closeModal();
        loadProducts();
    } else {
        showToast(result.error || result.detail || 'Error saving product', 'error');
    }
}


// =============================================================================
// Calculate Landed Price
// =============================================================================

function calculateLandedPrice() {
    const container = document.getElementById('landed-price-container');
    if (!container) return;

    const prices = {
        'USD': parseFloat(document.getElementById('form_unit_price_usd').value) || 0,
        'RMB': parseFloat(document.getElementById('form_unit_price_rmb').value) || 0,
        'INR': parseFloat(document.getElementById('form_unit_price_inr').value) || 0
    };

    const bcdPercent = parseFloat(document.getElementById('basic_custom_duty_percentage').value) || 0;
    const freightPercent = parseFloat(document.getElementById('freight_percentage').value) || 0;
    const gstPercent = parseFloat(document.getElementById('gst_percentage').value) || 18;

    let html = '';
    let hasPrice = false;

    const formatINR = (val) => '₹' + val.toFixed(3);

    ['USD', 'RMB', 'INR'].forEach(currency => {
        const unitPrice = prices[currency];
        if (unitPrice > 0) {
            hasPrice = true;
            const rate = currencyRates[currency] || 1;
            const symbol = { 'USD': '$', 'RMB': '¥', 'INR': '₹' }[currency];

            const basePrice = unitPrice * rate;
            const bcdValue = basePrice * (bcdPercent / 100);
            const freightValue = basePrice * (freightPercent / 100);
            const subtotal = basePrice + bcdValue + freightValue;
            const gstValue = subtotal * (gstPercent / 100);
            const landedPrice = subtotal;

            html += `
                <div class="price-breakdown" style="margin-bottom: 15px; border: 1px solid var(--border); padding: 10px; border-radius: 6px;">
                    <div style="font-weight: 600; color: var(--primary); margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
                        Based on ${currency} Price (${symbol}${unitPrice.toFixed(currency === 'INR' ? 3 : 6)})
                    </div>
                    <div class="price-row">
                        <span>Base Price (INR):</span>
                        <span>${formatINR(basePrice)}</span>
                    </div>
                    <div class="price-row">
                        <span>+ Custom Duty (${bcdPercent}%):</span>
                        <span>${formatINR(bcdValue)}</span>
                    </div>
                    <div class="price-row">
                        <span>+ Freight (${freightPercent}%):</span>
                        <span>${formatINR(freightValue)}</span>
                    </div>
                    <div class="price-row" style="color: var(--text-muted); font-size: 0.9em;">
                        <span>+ GST (${gstPercent}%):</span>
                        <span>${formatINR(gstValue)}</span>
                    </div>
                    <div class="price-row total" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border);">
                        <span>Landed Price:</span>
                        <span>${formatINR(landedPrice)}</span>
                    </div>
                </div>
            `;
        }
    });

    if (!hasPrice) {
        html = `
            <div class="price-breakdown empty-state">
                <p style="text-align:center; color: var(--text-muted);">Enter a price (USD, RMB, or INR) to see calculation</p>
            </div>
        `;
    }

    container.innerHTML = html;
}


// =============================================================================
// Utility Functions
// =============================================================================

function handleSearch(e) {
    applyProductFilters();
}

// Apply both search and price filter together
function applyProductFilters() {
    const query = (document.getElementById('search-input').value || '').toLowerCase();
    const priceFilter = (document.getElementById('price-filter') || {}).value || 'all';
    const rows = productsTbody.querySelectorAll('tr');

    rows.forEach(row => {
        // Skip empty-state rows
        if (!row.dataset.hasPrice && row.dataset.hasPrice !== 'yes' && row.dataset.hasPrice !== 'no') {
            return;
        }

        let showBySearch = true;
        let showByPrice = true;

        // Search filter
        if (query) {
            const text = row.textContent.toLowerCase();
            showBySearch = text.includes(query);
        }

        // Price filter
        if (priceFilter === 'no-price') {
            showByPrice = row.dataset.hasPrice === 'no';
        } else if (priceFilter === 'with-price') {
            showByPrice = row.dataset.hasPrice === 'yes';
        }

        row.style.display = (showBySearch && showByPrice) ? '' : 'none';
    });
}

async function deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const result = await fetchAPI(`/products/${id}`, { method: 'DELETE' });
    if (result.success || result.message) {
        showToast('Product deleted successfully', 'success');
        loadProducts();
    } else {
        showToast('Error deleting product', 'error');
    }
}

async function editProduct(id) {
    const product = productsData.find(p => p.id === id);
    if (product) {
        openModal(product);
    } else {
        showToast('Product not found', 'error');
    }
}

function showToast(message, type = 'success') {
    toast.className = `toast ${type} show`;
    toast.querySelector('.toast-message').textContent = message;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
