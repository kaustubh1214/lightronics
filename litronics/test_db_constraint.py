
import sqlite3
import datetime

def test_duplicate_insert():
    conn = sqlite3.connect('litronics.db')
    cursor = conn.cursor()
    
    # 1. Insert first row
    try:
        cursor.execute("""
            INSERT INTO purchase_orders (
                purchase_id, order_number, order_placed_by, order_date,
                supplier_name, quantity, price_currency, price_usd, price_inr, price_rmb,
                unit_price, subtotal, other_charges, total, gst_applicable, gst_percentage, gst_amount, final_total
            ) VALUES (
                'TEST-UNIQUE-1', 'ORD-1', 'Tester', '2025-01-01',
                'Supplier A', 1, 'USD', 10, 0, 0, 10, 10, 0, 10, 1, 18, 1.8, 11.8
            )
        """)
        conn.commit()
        print("First row inserted.")
    except Exception as e:
        print(f"First row failed: {e}")
        return

    # 2. Insert second row with SAME purchase_id
    try:
        cursor.execute("""
            INSERT INTO purchase_orders (
                purchase_id, order_number, order_placed_by, order_date,
                supplier_name, quantity, price_currency, price_usd, price_inr, price_rmb,
                unit_price, subtotal, other_charges, total, gst_applicable, gst_percentage, gst_amount, final_total
            ) VALUES (
                'TEST-UNIQUE-1', 'ORD-2', 'Tester', '2025-01-01',
                'Supplier A', 1, 'USD', 10, 0, 0, 10, 10, 0, 10, 1, 18, 1.8, 11.8
            )
        """)
        conn.commit()
        print("Second row inserted (Duplicate purchase_id worked!).")
        
        # Cleanup
        cursor.execute("DELETE FROM purchase_orders WHERE purchase_id='TEST-UNIQUE-1'")
        conn.commit()
        print("Test data cleaned up.")
        
    except Exception as e:
        print(f"Second row failed (Constraint still active!): {e}")

    conn.close()

if __name__ == "__main__":
    test_duplicate_insert()
