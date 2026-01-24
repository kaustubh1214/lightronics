import sys
import os

# Add server directory to path
sys.path.append(os.path.join(os.getcwd(), 'server'))

from database import SessionLocal, engine, Base
from models import Product, Supplier, Category, HsnCode

def seed():
    print("Checking database...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Check Categories
        cat = db.query(Category).filter_by(category_name="Electronics").first()
        if not cat:
            cat = Category(category_name="Electronics", freight_percentage=5.0)
            db.add(cat)
            db.commit()
            print("Created Category: Electronics")
        
        # Check HSN
        hsn = db.query(HsnCode).filter_by(hsn_code="85411000").first()
        if not hsn:
            hsn = HsnCode(hsn_code="85411000", description="Diodes", basic_custom_duty_percentage=10.0)
            db.add(hsn)
            db.commit()
            print("Created HSN: 85411000")
            
        # Check Supplier
        sup = db.query(Supplier).filter_by(supplier_code="SUP-TEST-01").first()
        if not sup:
            sup = Supplier(
                supplier_name="Test Supplier Corp", 
                supplier_code="SUP-TEST-01", 
                country="China", 
                currency_preference="USD"
            )
            db.add(sup)
            db.commit()
            print("Created Supplier: Test Supplier Corp")
            
        # Check Product
        prod = db.query(Product).filter_by(part_code="TEST-CPU-001").first()
        if not prod:
            prod = Product(
                part_code="TEST-CPU-001", 
                description="Test CPU Module",
                category_id=cat.id,
                hsn_code_id=hsn.id,
                unit_price_usd=50.00,
                primary_currency="USD",
                gst_percentage=18.0
            )
            # Add relationship
            prod.suppliers.append(sup)
            db.add(prod)
            db.commit()
            print("Created Product: TEST-CPU-001")
            
        print("\n--- TEST DATA ---")
        print(f"Product Part Code: {prod.part_code}")
        print(f"Supplier Name: {sup.supplier_name}")
        
    except Exception as e:
        print(f"Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
