
from sqlalchemy import create_engine, text
import sys

try:
    engine = create_engine('sqlite:///litronics.db')
    with engine.connect() as conn:
        result = conn.execute(text("SELECT count(*) FROM purchase_orders"))
        count = result.scalar()
        print(f"Total Purchase Orders: {count}")
        
        if count > 0:
            result = conn.execute(text("SELECT * FROM purchase_orders LIMIT 1"))
            row = result.fetchone()
            print(f"Sample PO: {row}")
except Exception as e:
    print(f"Error: {e}")
