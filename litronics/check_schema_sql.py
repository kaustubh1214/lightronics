
import sqlite3

def check_schema_sql():
    conn = sqlite3.connect('litronics.db')
    cursor = conn.cursor()
    
    print("--- CREATE TABLE Statement for purchase_orders ---")
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='purchase_orders'")
    row = cursor.fetchone()
    if row:
        print(row[0])
    else:
        print("Table not found!")
        
    print("\n--- Index Details ---")
    cursor.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='purchase_orders'")
    indexes = cursor.fetchall()
    for idx in indexes:
        print(f"Index: {idx[0]}")
        print(f"SQL: {idx[1]}")
        
    conn.close()

if __name__ == "__main__":
    check_schema_sql()
