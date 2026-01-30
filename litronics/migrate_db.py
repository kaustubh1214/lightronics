
import sqlite3
import os

DB_PATH = "litronics.db"

def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database {DB_PATH} not found.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Starting migration...")

    # 1. Rename existing table
    try:
        cursor.execute("ALTER TABLE purchase_orders RENAME TO purchase_orders_old")
    except sqlite3.OperationalError as e:
        if "no such table" in str(e):
            print("Table purchase_orders does not exist.")
            return
        else:
            print(f"Error renaming table: {e}")
            # Check if it was already renamed or new one created?
            # We'll assume if rename fails, we might check if _old exists.
            pass

    # 2. Create new table without UNIQUE on purchase_id and order_number
    # (Copied from schema.sql but without UNIQUE constraints on those fields)
    create_table_sql = """
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
    cursor.execute(create_table_sql)

    # 3. Copy data
    # We need to map columns explicitly to be safe
    # We will exclude 'id' to let it regenerate, OR keep it if we want to preserve history IDs. 
    # Better to keep IDs if possible, but AUTOINCREMENT might conflict if we are not careful.
    # Actually, simpler to copy everything.
    
    # Get columns of old table
    cursor.execute("PRAGMA table_info(purchase_orders_old)")
    columns = [info[1] for info in cursor.fetchall()]
    col_str = ", ".join(columns)
    
    insert_sql = f"INSERT INTO purchase_orders ({col_str}) SELECT {col_str} FROM purchase_orders_old"
    cursor.execute(insert_sql)

    # 4. Create indices (Index on purchase_id is still good for performance, just not unique)
    cursor.execute("CREATE INDEX idx_purchase_orders_purchase_id ON purchase_orders(purchase_id)")

    # 5. Drop old table
    cursor.execute("DROP TABLE purchase_orders_old")

    print("Migration complete. UNIQUE constraints removed from purchase_id and order_number.")
    
    conn.commit()
    conn.close()

if __name__ == "__main__":
    migrate()
