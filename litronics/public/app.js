/**
 * Litronics Product Management System - Frontend JavaScript
 */

const API_BASE = 'http://localhost:8000/api';

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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('App initializing...');
    try {
        initializeChoices(); // Initialize searchable dropdowns first
        console.log('Choices initialized');
    } catch (e) {
        console.error('Choices init error:', e);
    }

    loadCategories();
    loadSuppliers();
    loadHsnCodes();
    loadCurrencyRates();
    loadProducts();

    try {
        setupEventListeners();
        console.log('Event listeners set up');
    } catch (e) {
        console.error('Event listeners error:', e);
    }
});

// Initialize Choices.js dropdowns
function initializeChoices() {
    // Category: Single-select searchable
    categoryChoices = new Choices('#category_id', {
        searchEnabled: true,
        searchPlaceholderValue: 'Search categories...',
        itemSelectText: '',
        allowHTML: true
    });

    // Supplier: Multi-select searchable
    supplierChoices = new Choices('#supplier_ids', {
        searchEnabled: true,
        searchPlaceholderValue: 'Search suppliers...',
        removeItemButton: true,
        itemSelectText: '',
        allowHTML: true
    });

    // HSN Code: Single-select searchable
    hsnChoices = new Choices('#hsn_code_id', {
        searchEnabled: true,
        searchPlaceholderValue: 'Search HSN codes...',
        itemSelectText: '',
        allowHTML: true
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
    ['currency_amount', 'primary_currency',
        'basic_custom_duty_percentage', 'freight_percentage', 'gst_percentage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', calculateLandedPrice);
        });

    // Update currency symbol and recalculate when currency changes
    document.getElementById('primary_currency').addEventListener('change', (e) => {
        updateCurrencySymbol();
        calculateLandedPrice();
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
            <td style="color: var(--secondary); font-weight: 600;">₹${parseFloat(product.landed_price_inr || 0).toFixed(4)}</td>
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

// Modal functions
function openModal(product = null) {
    productForm.reset();

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

        // Set currency amount for edit mode
        const currency = product.primary_currency || 'USD';
        let amount = 0;
        if (currency === 'USD') amount = product.unit_price_usd;
        else if (currency === 'RMB') amount = product.unit_price_rmb;
        else if (currency === 'INR') amount = product.unit_price_inr;

        document.getElementById('currency_amount').value = parseFloat(amount || 0);
        document.getElementById('primary_currency').value = currency;

        document.getElementById('category_id').value = product.category_id || '';
        if (categoryChoices) categoryChoices.setChoiceByValue(product.category_id);

        document.getElementById('hsn_code_id').value = product.hsn_code_id || '';
        if (hsnChoices) hsnChoices.setChoiceByValue(product.hsn_code_id);

        // Handle supplier selection (multi-select)
        if (product.supplier_ids && supplierChoices) {
            supplierChoices.setChoiceByValue(product.supplier_ids);
        }
    }

    updateCurrencySymbol();
    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    calculateLandedPrice();
}

function closeModal() {
    productModal.classList.remove('active');
    document.body.style.overflow = '';
}

// Form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(productForm);
    const data = {};

    // Process basic fields
    formData.forEach((value, key) => {
        if (!['supplier_ids', 'currency_amount', 'unit_price_usd', 'unit_price_rmb', 'unit_price_inr'].includes(key)) {
            if (value) {
                data[key] = isNaN(value) ? value : parseFloat(value) || value;
            }
        }
    });

    // Handle Pricing
    const currency = document.getElementById('primary_currency').value;
    const amount = parseFloat(document.getElementById('currency_amount').value) || 0;

    data.primary_currency = currency;
    data.unit_price_usd = currency === 'USD' ? amount : 0;
    data.unit_price_rmb = currency === 'RMB' ? amount : 0;
    data.unit_price_inr = currency === 'INR' ? amount : 0;

    // Get multiple select values
    const supplierSelect = document.getElementById('supplier_ids');
    data.supplier_ids = Array.from(supplierSelect.selectedOptions).map(opt => parseInt(opt.value));

    // Convert IDs to integers
    if (data.category_id) data.category_id = parseInt(data.category_id);
    if (data.hsn_code_id) data.hsn_code_id = parseInt(data.hsn_code_id);

    const result = await fetchAPI('/products', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    if (result.success || result.id) {
        showToast('Product saved successfully!', 'success');
        closeModal();
        loadProducts();
    } else {
        showToast(result.error || result.detail || 'Error saving product', 'error');
    }
}

// Calculate landed price
function calculateLandedPrice() {
    const currency = document.getElementById('primary_currency').value;
    const unitPrice = parseFloat(document.getElementById('currency_amount').value) || 0;

    const rate = currencyRates[currency] || 1;
    const bcdPercent = parseFloat(document.getElementById('basic_custom_duty_percentage').value) || 0;
    const freightPercent = parseFloat(document.getElementById('freight_percentage').value) || 0;
    const gstPercent = parseFloat(document.getElementById('gst_percentage').value) || 18;

    const basePrice = unitPrice * rate;
    const bcdValue = basePrice * (bcdPercent / 100);
    const freightValue = basePrice * (freightPercent / 100);
    const subtotal = basePrice + bcdValue + freightValue;
    const gstValue = subtotal * (gstPercent / 100);
    const landedPrice = subtotal + gstValue;

    document.getElementById('calc-base-price').textContent = `₹${basePrice.toFixed(4)}`;
    document.getElementById('calc-bcd').textContent = `₹${bcdValue.toFixed(4)}`;
    document.getElementById('calc-freight').textContent = `₹${freightValue.toFixed(4)}`;
    document.getElementById('calc-gst').textContent = `₹${gstValue.toFixed(4)}`;
    document.getElementById('calc-landed-price').textContent = `₹${landedPrice.toFixed(4)}`;
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
