"""
Migration Script: Add purchase_id column to purchase_orders table
Run this script to update existing database with the new purchase_id field.

Usage:
    cd server
    python migrate_add_purchase_id.py
"""

import os
import sys
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from database import engine, SessionLocal


def run_migration():
    """Add purchase_id column to purchase_orders table and populate existing records."""
    
    print("=" * 60)
    print("Migration: Adding purchase_id to purchase_orders table")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        # Check if column already exists
        check_query = text("""
            SELECT COUNT(*) as count FROM pragma_table_info('purchase_orders') 
            WHERE name = 'purchase_id'
        """)
        result = db.execute(check_query).fetchone()
        
        if result and result[0] > 0:
            print("\n[OK] Column 'purchase_id' already exists. Skipping column creation.")
        else:
            print("\n[->] Adding 'purchase_id' column to purchase_orders table...")
            
            # Add the column (SQLite doesn't support NOT NULL on ALTER, so we add nullable first)
            alter_query = text("""
                ALTER TABLE purchase_orders ADD COLUMN purchase_id VARCHAR(50)
            """)
            db.execute(alter_query)
            db.commit()
            print("  [OK] Column added successfully.")
        
        # Populate existing records with purchase_id if they don't have one
        print("\n[->] Populating purchase_id for existing records...")
        
        # Get all records without purchase_id
        select_query = text("""
            SELECT id, order_date FROM purchase_orders 
            WHERE purchase_id IS NULL OR purchase_id = ''
            ORDER BY id
        """)
        records = db.execute(select_query).fetchall()
        
        if not records:
            print("  [OK] All records already have purchase_id.")
        else:
            print(f"  [->] Found {len(records)} records to update...")
            
            # Group by date and assign sequential IDs
            date_counters = {}
            
            for record in records:
                record_id = record[0]
                order_date = record[1]
                
                # Parse the date or use current date
                if order_date:
                    if isinstance(order_date, str):
                        try:
                            order_date = datetime.fromisoformat(order_date.replace('Z', '+00:00'))
                        except:
                            order_date = datetime.now()
                    date_str = order_date.strftime('%Y%m%d')
                else:
                    date_str = datetime.now().strftime('%Y%m%d')
                
                # Get next sequence number for this date
                if date_str not in date_counters:
                    date_counters[date_str] = 0
                date_counters[date_str] += 1
                
                # Generate purchase_id
                purchase_id = f"PUR-{date_str}-{date_counters[date_str]:04d}"
                
                # Update the record
                update_query = text("""
                    UPDATE purchase_orders SET purchase_id = :purchase_id WHERE id = :id
                """)
                db.execute(update_query, {"purchase_id": purchase_id, "id": record_id})
            
            db.commit()
            print(f"  [OK] Updated {len(records)} records with unique purchase_ids.")
        
        # Create index if it doesn't exist
        print("\n[->] Creating index on purchase_id (if not exists)...")
        try:
            index_query = text("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_purchase_id 
                ON purchase_orders(purchase_id)
            """)
            db.execute(index_query)
            db.commit()
            print("  [OK] Index created/verified successfully.")
        except Exception as e:
            print(f"  [WARN] Index creation skipped (may already exist): {str(e)[:50]}")
        
        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n[ERROR] Migration failed with error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()
