
import sqlite3

def fix_migration():
    conn = sqlite3.connect('litronics.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    try:
        # 1. Drop the partially created 'purchase_orders' if it exists.
        print("Dropping 'purchase_orders' if exists...")
        c.execute("DROP TABLE IF EXISTS purchase_orders")

        # 2. Create the new 'purchase_orders' table (WITHOUT UNIQUE constraints on purchase_id/order_number)
        print("Creating new 'purchase_orders' table...")
        create_sql = """
        CREATE TABLE purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            purchase_id VARCHAR(50) NOT NULL,
            order_number VARCHAR(50) NOT NULL,
            order_placed_by VARCHAR(100) NOT NULL,
            order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            product_id INTEGER REFERENCES products(id),
            part_code VARCHAR(50),
            item_description VARCHAR(255),
            hsn_code VARCHAR(20),
            category_name VARCHAR(100),
            supplier_id INTEGER REFERENCES suppliers(id),
            supplier_name VARCHAR(150),
            quantity INTEGER DEFAULT 1,
            price_currency VARCHAR(10) DEFAULT 'USD',
            price_usd DECIMAL(15, 4) DEFAULT 0,
            price_inr DECIMAL(15, 4) DEFAULT 0,
            price_rmb DECIMAL(15, 4) DEFAULT 0,
            unit_price DECIMAL(15, 4) DEFAULT 0,
            subtotal DECIMAL(15, 4) DEFAULT 0,
            other_charges DECIMAL(15, 4) DEFAULT 0,
            total DECIMAL(15, 4) DEFAULT 0,
            gst_applicable BOOLEAN DEFAULT TRUE,
            gst_percentage DECIMAL(5, 2) DEFAULT 18,
            gst_amount DECIMAL(15, 4) DEFAULT 0,
            final_total DECIMAL(15, 4) DEFAULT 0,
            delivery_date TIMESTAMP,
            delivery_type VARCHAR(50) DEFAULT 'sea',
            pi_status VARCHAR(50) DEFAULT 'open',
            remarks TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
        c.execute(create_sql)
        c.execute("CREATE INDEX idx_purchase_orders_purchase_id ON purchase_orders(purchase_id)")

        # 3. Migrate data from 'purchase_orders_old'
        # We need to explicitly select columns that exist in old table.
        # Based on inspection, 'purchase_id' was missing in old table.
        
        print("Reading data from 'purchase_orders_old'...")
        c.execute("SELECT * FROM purchase_orders_old")
        rows = c.fetchall()
        
        print(f"Migrating {len(rows)} rows...")
        
        for row in rows:
            # Convert row to dict for easier handling
            data = dict(row)
            
            # Map purchase_id = order_number since it was missing
            p_id = data['order_number']
            
            # Construct INSERT
            keys = list(data.keys())
            # Add purchase_id key
            keys.append('purchase_id')
            values = list(data.values())
            values.append(p_id)
            
            placeholders = ", ".join(["?"] * len(keys))
            columns = ", ".join(keys)
            
            sql = f"INSERT INTO purchase_orders ({columns}) VALUES ({placeholders})"
            c.execute(sql, values)

        # 4. Cleanup
        print("Dropping 'purchase_orders_old'...")
        c.execute("DROP TABLE purchase_orders_old")
        
        conn.commit()
        print("Migration fixed and completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    fix_migration()
