
import sqlite3

def check_indexes():
    conn = sqlite3.connect('litronics.db')
    cursor = conn.cursor()
    
    print("--- Indexes on purchase_orders ---")
    cursor.execute("PRAGMA index_list(purchase_orders)")
    indexes = cursor.fetchall()
    for idx in indexes:
        print(f"Index: {idx}")
        # seq, name, unique, origin, partial
        if idx[2] == 1: # unique
            print(f"  WARNING: Unique index found: {idx[1]}")
            
    print("\n--- Columns in purchase_orders ---")
    cursor.execute("PRAGMA table_info(purchase_orders)")
    cols = cursor.fetchall()
    for col in cols:
        print(col)
        
    conn.close()

if __name__ == "__main__":
    check_indexes()
