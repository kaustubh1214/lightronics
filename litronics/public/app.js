/**
 * Litronics Product Management System - Frontend JavaScript
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

// HSN Modal Elements
const hsnModal = document.getElementById('hsn-modal');
const hsnForm = document.getElementById('hsn-form');
const manageHsnLink = document.getElementById('manage-hsn-link');
const closeHsnModalBtn = document.getElementById('close-hsn-modal');
const cancelHsnBtn = document.getElementById('cancel-hsn-btn');

// Currency rates (will be fetched from API)
let currencyRates = { USD: 83.50, RMB: 11.50, INR: 1 };

// Choices.js instances for searchable dropdowns
// Choices.js instances for searchable dropdowns
let categoryChoices = null;
let supplierChoices = null;
let hsnChoices = null;

// Global Data Storage
let categoriesData = [];
let suppliersData = [];
let hsnCodesData = [];
let productsData = [];

// Edit Mode Tracking
let editingProductId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');

    // Initialize Navigation
    setupNavigation();

    // Initialize Modules
    try {
        initializeChoices(); // Initialize product module dropdowns

        // Initialize Purchase Module if available
        if (typeof initializePurchaseModule === 'function') {
            initializePurchaseModule();
        }

    } catch (e) {
        console.error('Initialization error:', e);
    }

    loadCategories();
    loadSuppliers();
    loadHsnCodes();
    loadCurrencyRates();
    loadProducts();

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

            // Only proceed if module view exists
            const targetView = document.getElementById(`${targetModule}-view`);
            if (!targetView) {
                console.warn(`View not found for module: ${targetModule}`);
                // For modules not yet implemented
                if (['products', 'purchase', 'dispatch'].includes(targetModule)) {
                    // Specific logic for implemented modules
                } else {
                    alert(`The ${targetModule} module is coming soon!`);
                    return;
                }
            }

            // Update nav state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update view state
            moduleViews.forEach(view => {
                view.classList.remove('active');
                view.style.display = 'none'; // Ensure display is none
            });

            if (targetView) {
                targetView.classList.add('active');
                targetView.style.display = 'block'; // Force display block
                console.log(`activated view: ${targetModule}-view`);
            }
        });
    });
}

// Initialize Choices.js dropdowns
// Initialize Choices.js dropdowns
function initializeChoices() {
    // Category: Single-select searchable
    categoryChoices = new Choices('#category_id', {
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

    // HSN Code: Single-select searchable
    hsnChoices = new Choices('#hsn_code_id', {
        searchEnabled: true,
        searchPlaceholderValue: 'Search HSN codes...',
        itemSelectText: '',
        placeholder: true,
        placeholderValue: 'Select HSN Code',
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
                // Format price fields on change/blur to show 4 decimal places (e.g., 0.2 -> 0.2000)
                if (id.includes('form_unit_price')) {
                    el.addEventListener('change', (e) => {
                        const val = parseFloat(e.target.value) || 0;
                        e.target.value = val.toFixed(4);
                        calculateLandedPrice(); // Recalculate with formatted value
                    });
                }
            }
        });

    // HSN code change updates BCD and GST from HSN data
    document.getElementById('hsn_code_id').addEventListener('change', (e) => {
        const hsnId = parseInt(e.target.value);
        const hsn = hsnCodesData.find(h => h.id === hsnId);

        if (hsn) {
            if (hsn.basic_custom_duty_percentage !== undefined) {
                document.getElementById('basic_custom_duty_percentage').value = hsn.basic_custom_duty_percentage;
            }
            if (hsn.gst_percentage !== undefined) {
                document.getElementById('gst_percentage').value = hsn.gst_percentage;
            }
            // Display HSN category
            const hsnCategoryField = document.getElementById('hsn_category_display');
            if (hsnCategoryField) {
                hsnCategoryField.value = hsn.hsn_category || '';
            }
        } else {
            const hsnCategoryField = document.getElementById('hsn_category_display');
            if (hsnCategoryField) hsnCategoryField.value = '';
        }
        calculateLandedPrice();
    });

    // Category change updates freight
    document.getElementById('category_id').addEventListener('change', (e) => {
        const catId = parseInt(e.target.value);
        const category = categoriesData.find(c => c.id === catId);

        if (category && category.freight_percentage !== undefined) {
            document.getElementById('freight_percentage').value = category.freight_percentage;
            calculateLandedPrice();
        }
    });

    // HSN Management
    manageHsnLink.addEventListener('click', (e) => {
        e.preventDefault();
        openHsnModal();
    });

    closeHsnModalBtn.addEventListener('click', () => closeHsnModal());
    cancelHsnBtn.addEventListener('click', () => closeHsnModal());
    hsnModal.addEventListener('click', (e) => {
        if (e.target === hsnModal) closeHsnModal();
    });

    hsnForm.addEventListener('submit', handleHsnFormSubmit);
}

// HSN Modal Functions
function openHsnModal() {
    hsnForm.reset();
    hsnModal.classList.add('active');
}

function closeHsnModal() {
    hsnModal.classList.remove('active');
}

async function handleHsnFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(hsnForm);
    const data = {};
    formData.forEach((value, key) => data[key] = value);

    const result = await fetchAPI('/hsn-codes', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    if (result.success) {
        showToast('HSN Code added successfully', 'success');
        closeHsnModal();
        await loadHsnCodes(); // Reload dropdown

        // Auto-select the new HSN
        if (hsnChoices) {
            hsnChoices.setChoiceByValue(result.id);
        }
    } else {
        showToast(result.error || result.detail || 'Error adding HSN Code', 'error');
    }
}

// API Calls
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

// Load dropdown data
async function loadCategories() {
    const result = await fetchAPI('/categories');
    if (result.success || result.data) {
        categoriesData = result.data || result;
        const choicesData = categoriesData.map(cat => ({
            value: cat.id,
            label: cat.category_name,
            customProperties: {
                freight: cat.freight_percentage
            }
        }));

        if (categoryChoices) {
            categoryChoices.setChoices(choicesData, 'value', 'label', true);
        }
        document.getElementById('total-categories').textContent = categoriesData.length;
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

async function loadHsnCodes() {
    const result = await fetchAPI('/hsn-codes');
    if (result.success || result.data) {
        hsnCodesData = result.data || result;
        const choicesData = hsnCodesData.map(hsn => ({
            value: hsn.id,
            label: `${hsn.hsn_code} - ${hsn.description || ''} [${hsn.hsn_category || ''}]`,
            customProperties: {
                bcd: hsn.basic_custom_duty_percentage,
                gst: hsn.gst_percentage,
                category: hsn.hsn_category
            }
        }));

        if (hsnChoices) {
            hsnChoices.setChoices(choicesData, 'value', 'label', true);
        }
    }
}

// Function to get HSN data by ID
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

        // Calculate average landed price
        if (productsData.length > 0) {
            const avg = productsData.reduce((sum, p) => sum + parseFloat(p.landed_price_inr || 0), 0) / productsData.length;
            document.getElementById('avg-price').textContent = `₹${avg.toFixed(2)}`;
        }
    }
}

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
        const tr = document.createElement('tr');
        tr.className = 'animate-in';
        tr.style.animationDelay = `${index * 0.05}s`;
        tr.innerHTML = `
            <td><strong>${product.part_code}</strong></td>
            <td>${product.description}</td>
            <td><span class="category-badge">${product.category_name || '-'}</span></td>
            <td>$${parseFloat(product.unit_price_usd || 0).toFixed(4)}</td>
            <td>¥${parseFloat(product.unit_price_rmb || 0).toFixed(4)}</td>
            <td>${product.basic_custom_duty_percentage || 0}%</td>
            <td>${product.freight_percentage || 0}%</td>
            <td>${product.gst_percentage || 18}%</td>
            <td style="color: var(--secondary); font-weight: 600;">₹${parseFloat(product.landed_price_inr || 0).toFixed(2)}</td>
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
}

// Update currency symbol
function updateCurrencySymbol() {
    const currency = document.getElementById('primary_currency').value;
    const symbolMap = { 'USD': '$', 'RMB': '¥', 'INR': '₹' };
    document.getElementById('currency-symbol').textContent = symbolMap[currency] || '$';
}

// Multi-currency handling
let currentProductPrices = { USD: 0, RMB: 0, INR: 0 };

// Modal functions
function openModal(product = null) {
    productForm.reset();

    // Track if we're editing
    editingProductId = product ? product.id : null;

    // Reset Choices
    if (categoryChoices) categoryChoices.removeActiveItems();
    if (supplierChoices) supplierChoices.removeActiveItems();
    if (hsnChoices) hsnChoices.removeActiveItems();

    document.getElementById('modal-title').textContent = product ? 'Edit Product' : 'Add New Product';

    if (product) {
        Object.keys(product).forEach(key => {
            const el = document.getElementById(key);
            if (el) el.value = product[key];
        });

        // Load all existing prices into separate inputs
        document.getElementById('form_unit_price_usd').value = parseFloat(product.unit_price_usd || 0).toFixed(4);
        document.getElementById('form_unit_price_rmb').value = parseFloat(product.unit_price_rmb || 0).toFixed(4);
        document.getElementById('form_unit_price_inr').value = parseFloat(product.unit_price_inr || 0).toFixed(4);

        // Set primary currency - No longer used in UI, auto-detected
        // const currency = product.primary_currency || 'USD';
        // document.getElementById('primary_currency').value = currency;

        // Use a timeout to ensure DOM is ready and Choices is steady
        setTimeout(() => {
            if (categoryChoices && product.category_id) {
                // Try both number and string to be safe
                categoryChoices.setChoiceByValue(parseInt(product.category_id));
                categoryChoices.setChoiceByValue(String(product.category_id));
            }

            if (hsnChoices && product.hsn_code_id) {
                hsnChoices.setChoiceByValue(parseInt(product.hsn_code_id));
                hsnChoices.setChoiceByValue(String(product.hsn_code_id));
            }

            // Handle supplier selection (multi-select)
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

        console.log('Editing Product Data:', product); // Debug log
    } else {
        // Default for new product
        // document.getElementById('primary_currency').value = 'USD';
        document.getElementById('form_unit_price_usd').value = '0.0000';
        document.getElementById('form_unit_price_rmb').value = '0.0000';
        document.getElementById('form_unit_price_inr').value = '0.0000';
    }

    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Recalculate based on loaded values - with slight delay to ensure values are set
    setTimeout(calculateLandedPrice, 100);
}

function closeModal() {
    productModal.classList.remove('active');
    document.body.style.overflow = '';
    editingProductId = null; // Reset edit mode
}

// Function to determine primary currency based on inputs
function getDeterminePrimaryCurrency() {
    const usd = parseFloat(document.getElementById('form_unit_price_usd').value) || 0;
    const rmb = parseFloat(document.getElementById('form_unit_price_rmb').value) || 0;
    const inr = parseFloat(document.getElementById('form_unit_price_inr').value) || 0;

    if (usd > 0) return 'USD';
    if (rmb > 0) return 'RMB';
    if (inr > 0) return 'INR';
    return 'USD'; // Default
}



// Form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(productForm);
    const data = {};

    // Process basic fields
    formData.forEach((value, key) => {
        // Skip explicitly handled fields
        if (!['supplier_ids', 'form_unit_price_usd', 'form_unit_price_rmb', 'form_unit_price_inr', 'primary_currency'].includes(key)) {
            if (value) {
                data[key] = isNaN(value) ? value : parseFloat(value) || value;
            }
        }
    });

    // Handle Pricing - Read directly from the 3 separate inputs
    data.unit_price_usd = parseFloat(document.getElementById('form_unit_price_usd').value) || 0;
    data.unit_price_rmb = parseFloat(document.getElementById('form_unit_price_rmb').value) || 0;
    data.unit_price_inr = parseFloat(document.getElementById('form_unit_price_inr').value) || 0;
    data.primary_currency = getDeterminePrimaryCurrency();

    // Get multiple select values
    const supplierSelect = document.getElementById('supplier_ids');
    data.supplier_ids = Array.from(supplierSelect.selectedOptions).map(opt => parseInt(opt.value));

    // Convert IDs to integers
    if (data.category_id) data.category_id = parseInt(data.category_id);
    if (data.hsn_code_id) data.hsn_code_id = parseInt(data.hsn_code_id);

    // Determine if creating or updating
    let result;
    if (editingProductId) {
        // Update existing product
        result = await fetchAPI(`/products/${editingProductId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    } else {
        // Create new product
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

// Calculate landed price
function calculateLandedPrice() {
    const container = document.getElementById('landed-price-container');
    if (!container) return;

    // Get input values
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

    // Helper to format currency
    const formatINR = (val) => '₹' + val.toFixed(4);

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
            const landedPrice = subtotal; // GST excluded from landed cost per user request

            html += `
                <div class="price-breakdown" style="margin-bottom: 15px; border: 1px solid var(--border); padding: 10px; border-radius: 6px;">
                    <div style="font-weight: 600; color: var(--primary); margin-bottom: 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">
                        Based on ${currency} Price (${symbol}${unitPrice.toFixed(4)})
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

// Search
function handleSearch(e) {
    const query = e.target.value.toLowerCase();
    const rows = productsTbody.querySelectorAll('tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
    });
}

// Delete product
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

// Edit product
async function editProduct(id) {
    const product = productsData.find(p => p.id === id);
    if (product) {
        openModal(product);
    } else {
        showToast('Product not found', 'error');
    }
}

// Toast notification
function showToast(message, type = 'success') {
    toast.className = `toast ${type} show`;
    toast.querySelector('.toast-message').textContent = message;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
