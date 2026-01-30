
import sqlite3

def check_db():
    conn = sqlite3.connect('litronics.db')
    c = conn.cursor()
    
    # List tables
    c.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = c.fetchall()
    print("Tables:", [t[0] for t in tables])
    
    # Check purchase_orders structure
    for table in ['purchase_orders', 'purchase_orders_old']:
        if (table,) in tables:
            print(f"\nStructure of {table}:")
            c.execute(f"PRAGMA table_info({table})")
            for col in c.fetchall():
                print(col)
                
            # Check for nulls
            try:
                c.execute(f"SELECT COUNT(*) FROM {table} WHERE purchase_id IS NULL OR purchase_id = ''")
                nulls = c.fetchone()[0]
                print(f"Rows with null/empty purchase_id in {table}: {nulls}")
            except Exception as e:
                print(f"Error checking nulls: {e}")

    conn.close()

if __name__ == "__main__":
    check_db()
