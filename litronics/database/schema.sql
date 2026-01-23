-- Litronics Product Management Database Schema
-- PostgreSQL Database

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS product_suppliers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS hsn_codes CASCADE;
DROP TABLE IF EXISTS currency_rates CASCADE;
DROP TABLE IF EXISTS freight_rates CASCADE;

-- =====================================================
-- CURRENCY RATES TABLE
-- Stores current exchange rates for different currencies
-- =====================================================
CREATE TABLE currency_rates (
    id SERIAL PRIMARY KEY,
    currency_code VARCHAR(10) NOT NULL UNIQUE,
    currency_name VARCHAR(50) NOT NULL,
    rate_to_inr DECIMAL(15, 4) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default currency rates
INSERT INTO currency_rates (currency_code, currency_name, rate_to_inr) VALUES
('USD', 'US Dollar', 83.50),
('RMB', 'Chinese Yuan', 11.50),
('INR', 'Indian Rupee', 1.00);

-- =====================================================
-- CATEGORIES TABLE
-- Product categories (Alu E-Cap, Capacitors, etc.)
-- =====================================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    freight_type VARCHAR(20) DEFAULT 'sea' CHECK (freight_type IN ('sea', 'air')),
    freight_percentage DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample categories based on the spreadsheet
INSERT INTO categories (category_name, freight_type, freight_percentage) VALUES
('Alu E-Cap - 3k hrs', 'sea', 4.00),
('Alu E-Cap - 6-8k hrs', 'sea', 4.00),
('Alu E-Cap - 8k hrs', 'sea', 4.00),
('Capacitors', 'sea', 3.50),
('Resistors', 'air', 2.00),
('ICs', 'air', 5.00),
('Transistors', 'air', 3.00),
('Diodes', 'sea', 2.50),
('Connectors', 'sea', 3.00),
('LEDs', 'air', 2.00);

-- =====================================================
-- HSN CODES TABLE
-- HSN codes with basic custom duty percentages and category
-- =====================================================
CREATE TABLE hsn_codes (
    id SERIAL PRIMARY KEY,
    hsn_code VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(255),
    hsn_category VARCHAR(100),  -- Category for the HSN (e.g., ZZZ, Capacitors)
    basic_custom_duty_percentage DECIMAL(5, 2) NOT NULL DEFAULT 0,
    gst_percentage DECIMAL(5, 2) NOT NULL DEFAULT 18,  -- GST % applicable for this HSN
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample HSN codes for electronic components
INSERT INTO hsn_codes (hsn_code, description, hsn_category, basic_custom_duty_percentage, gst_percentage) VALUES
('85322500', 'Aluminum Electrolytic Capacitors', 'Capacitors', 7.50, 18.00),
('85322400', 'Ceramic Capacitors', 'Capacitors', 7.50, 18.00),
('85322990', 'Other Fixed Capacitors', 'Capacitors', 7.50, 18.00),
('85321000', 'Tantalum Capacitors', 'Capacitors', 7.50, 18.00),
('85334090', 'Variable Resistors', 'Resistors', 7.50, 18.00),
('85423100', 'Processors and Controllers', 'ICs', 0.00, 18.00),
('85411000', 'Diodes', 'Diodes', 0.00, 18.00),
('85412100', 'Transistors', 'Transistors', 0.00, 18.00),
('85414020', 'LEDs', 'LEDs', 0.00, 18.00),
('94059900', 'LED Bulbs and Lighting Parts', 'ZZZ', 10.00, 18.00);

-- =====================================================
-- SUPPLIERS TABLE
-- Multiple suppliers can supply the same product
-- =====================================================
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    supplier_code VARCHAR(50) UNIQUE,
    supplier_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(50),
    currency_preference VARCHAR(10) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample suppliers from spreadsheet
INSERT INTO suppliers (supplier_code, supplier_name, country, currency_preference) VALUES
('AXB001', 'Axboom', 'China', 'RMB'),
('ENF001', 'Enfalion', 'China', 'RMB');

-- =====================================================
-- PRODUCTS TABLE
-- Main products table with all pricing and calculation fields
-- =====================================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    part_code VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255) NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    pieces_per_unit INTEGER DEFAULT 1,
    packaging_quantity INTEGER DEFAULT 1,  -- pieces per pack
    hsn_code_id INTEGER REFERENCES hsn_codes(id),
    
    -- Pricing fields (in original currency)
    unit_price_usd DECIMAL(15, 4) DEFAULT 0,
    unit_price_rmb DECIMAL(15, 4) DEFAULT 0,
    unit_price_inr DECIMAL(15, 4) DEFAULT 0,
    primary_currency VARCHAR(10) DEFAULT 'USD',
    
    -- Solder points (for calculation)
    solder_points INTEGER DEFAULT 2,
    
    -- Custom duty and freight
    basic_custom_duty_percentage DECIMAL(5, 2) DEFAULT 0,
    freight_percentage DECIMAL(5, 2) DEFAULT 0,
    
    -- GST
    gst_percentage DECIMAL(5, 2) DEFAULT 18.00,
    
    -- Calculated fields (stored for quick access, updated via trigger/application)
    bcd_value DECIMAL(15, 4) DEFAULT 0,           -- Basic Custom Duty value
    freight_value DECIMAL(15, 4) DEFAULT 0,
    landed_price_inr DECIMAL(15, 4) DEFAULT 0,    -- Final landed price in INR
    landed_price_usd DECIMAL(15, 4) DEFAULT 0,    -- Landed price in USD
    
    -- Additional pricing
    selling_price DECIMAL(15, 4) DEFAULT 0,
    markup_percentage DECIMAL(5, 2) DEFAULT 0,
    
    -- Inventory related
    bom_count INTEGER DEFAULT 0,
    
    -- Metadata
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- PRODUCT_SUPPLIERS TABLE (Many-to-Many)
-- Links products to multiple suppliers
-- =====================================================
CREATE TABLE product_suppliers (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    supplier_part_code VARCHAR(100),
    supplier_price DECIMAL(15, 4),
    supplier_currency VARCHAR(10) DEFAULT 'USD',
    lead_time_days INTEGER DEFAULT 30,
    minimum_order_quantity INTEGER DEFAULT 1,
    is_preferred BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, supplier_id)
);

-- =====================================================
-- FUNCTION: Calculate Landed Price
-- Calculates the landed price based on multiple factors
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_landed_price(
    p_unit_price DECIMAL,
    p_currency VARCHAR,
    p_bcd_percentage DECIMAL,
    p_freight_percentage DECIMAL,
    p_gst_percentage DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    v_rate_to_inr DECIMAL;
    v_price_inr DECIMAL;
    v_bcd_value DECIMAL;
    v_freight_value DECIMAL;
    v_subtotal DECIMAL;
    v_gst_value DECIMAL;
    v_landed_price DECIMAL;
BEGIN
    -- Get currency rate
    SELECT rate_to_inr INTO v_rate_to_inr 
    FROM currency_rates 
    WHERE currency_code = p_currency;
    
    IF v_rate_to_inr IS NULL THEN
        v_rate_to_inr := 1;
    END IF;
    
    -- Convert to INR
    v_price_inr := p_unit_price * v_rate_to_inr;
    
    -- Calculate BCD
    v_bcd_value := v_price_inr * (p_bcd_percentage / 100);
    
    -- Calculate Freight
    v_freight_value := v_price_inr * (p_freight_percentage / 100);
    
    -- Subtotal before GST
    v_subtotal := v_price_inr + v_bcd_value + v_freight_value;
    
    -- Calculate GST
    v_gst_value := v_subtotal * (p_gst_percentage / 100);
    
    -- Final Landed Price
    v_landed_price := v_subtotal + v_gst_value;
    
    RETURN ROUND(v_landed_price, 4);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER: Auto-update landed price on product insert/update
-- =====================================================
CREATE OR REPLACE FUNCTION update_product_landed_price()
RETURNS TRIGGER AS $$
DECLARE
    v_unit_price DECIMAL;
    v_currency VARCHAR;
BEGIN
    -- Determine which price to use based on primary currency
    IF NEW.primary_currency = 'USD' THEN
        v_unit_price := NEW.unit_price_usd;
    ELSIF NEW.primary_currency = 'RMB' THEN
        v_unit_price := NEW.unit_price_rmb;
    ELSE
        v_unit_price := NEW.unit_price_inr;
    END IF;
    
    v_currency := NEW.primary_currency;
    
    -- Calculate and set landed price
    NEW.landed_price_inr := calculate_landed_price(
        v_unit_price,
        v_currency,
        NEW.basic_custom_duty_percentage,
        NEW.freight_percentage,
        NEW.gst_percentage
    );
    
    -- Also calculate USD equivalent
    NEW.landed_price_usd := NEW.landed_price_inr / 
        (SELECT rate_to_inr FROM currency_rates WHERE currency_code = 'USD');
    
    NEW.updated_at := CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_landed_price
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_product_landed_price();

-- =====================================================
-- VIEW: Products with full details
-- =====================================================
CREATE OR REPLACE VIEW v_product_details AS
SELECT 
    p.id,
    p.part_code,
    p.description,
    c.category_name,
    p.pieces_per_unit,
    p.packaging_quantity,
    h.hsn_code,
    h.description AS hsn_description,
    p.unit_price_usd,
    p.unit_price_rmb,
    p.unit_price_inr,
    p.primary_currency,
    p.basic_custom_duty_percentage,
    p.freight_percentage,
    p.gst_percentage,
    p.landed_price_inr,
    p.landed_price_usd,
    p.solder_points,
    p.bom_count,
    p.is_active,
    STRING_AGG(s.supplier_name, ', ') AS suppliers
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN hsn_codes h ON p.hsn_code_id = h.id
LEFT JOIN product_suppliers ps ON p.id = ps.product_id
LEFT JOIN suppliers s ON ps.supplier_id = s.id
GROUP BY p.id, c.category_name, h.hsn_code, h.description;

-- =====================================================
-- SAMPLE DATA: Insert some products from the spreadsheet
-- =====================================================
INSERT INTO products (
    part_code, description, category_id, pieces_per_unit, packaging_quantity,
    hsn_code_id, unit_price_usd, unit_price_rmb, primary_currency,
    solder_points, basic_custom_duty_percentage, freight_percentage, gst_percentage
) VALUES
('P3365', 'E Cap 10uf/50V 8*12mm 3000 hrs', 1, 1, 1, 1, 0.0080, 0.05696, 'USD', 2, 0, 4, 18),
('P2111', 'E Cap 10uf/50V 5*11mm 3000 hrs', 1, 1, 1, 1, 0.0040, 0.0284, 'USD', 2, 0, 4, 18),
('P4938', 'E Cap 47uf/25V 5*11mm 3000hrs 105D', 1, 1, 1, 1, 0.0039, 0.028, 'USD', 2, 0.37, 4, 18),
('P6414', 'E Cap 100uf/16v 3000 hours 5*11mm', 1, 1, 1, 1, 0.0038, 0.0250, 'USD', 2, 0.35, 4, 18),
('P6300', 'E Cap 330uf/25V (8*12mm) 3000 hrs, 105D', 1, 1, 1, 1, 0.0090, 0.07, 'USD', 2, 0.83, 4, 18),
('P4972', 'E Cap 100uf/100V 6000-8000k hrs (10*14mm)', 2, 1, 1, 1, 0.0200, 0.13, 'USD', 2, 1.73, 4, 18),
('P6218', 'E Cap 10uf/50V 5*11mm 8000 hrs', 2, 1, 1, 1, 0.0050, 0.036, 'USD', 2, 0.37, 4, 18),
('P6196', 'E Cap 2.2uf/400v 8*12mm 5000 hours', 2, 1, 1, 1, 0.0080, 0.057, 'USD', 2, 0.92, 4, 18),
('P6140', 'E Cap 4.7uf/400V (8*12mm)', 2, 1, 1, 1, 0.0135, 0.096, 'USD', 2, 1.24, 4, 18),
('P6195', 'E Cap 4.7uf/50V 5*11 5000 hours', 2, 1, 1, 1, 0.0051, 0.036, 'USD', 2, 0.47, 4, 18);

-- Link products to suppliers
INSERT INTO product_suppliers (product_id, supplier_id, is_preferred) 
SELECT p.id, s.id, TRUE
FROM products p
CROSS JOIN suppliers s
WHERE s.supplier_name = 'Axboom'
LIMIT 10;

INSERT INTO product_suppliers (product_id, supplier_id, is_preferred) 
SELECT p.id, s.id, FALSE
FROM products p
CROSS JOIN suppliers s
WHERE s.supplier_name = 'Enfalion'
LIMIT 10;

-- =====================================================
-- Grant permissions (adjust as needed)
-- =====================================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;

SELECT 'Litronics Database Schema Created Successfully!' AS status;
