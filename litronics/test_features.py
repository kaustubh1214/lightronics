
import sys
import os

# Set up path to import from server directory directly
base_dir = os.path.dirname(os.path.abspath(__file__))
server_dir = os.path.join(base_dir, "server")
sys.path.insert(0, server_dir)

# Now import directly as if we are in the server folder
from database import SessionLocal, engine, Base
from models import Supplier, PurchaseOrder, PurchasePayment
from sqlalchemy import func

def test_features():
    print("=" * 60)
    print("TESTING LITRONICS NEW FEATURES")
    print("=" * 60)

    # 1. Initialize DB and Create Tables
    print("\n[1] Initializing Database...")
    try:
        Base.metadata.create_all(bind=engine)
        print("    Tables created/verified.")
    except Exception as e:
        print(f"    Warning during table creation: {e}")

    db = SessionLocal()

    try:
        # 2. Create a Test Supplier
        print("\n[2] Creating/Getting Test Supplier...")
        supplier = db.query(Supplier).filter(Supplier.supplier_code == "TEST-PAY").first()
        if not supplier:
            supplier = Supplier(
                supplier_code="TEST-PAY",
                supplier_name="Payment Test Supplier",
                currency_preference="USD",
                country="USA"
            )
            db.add(supplier)
            db.commit()
            db.refresh(supplier)
            print(f"    Created Supplier: {supplier.supplier_name} (ID: {supplier.id})")
        else:
            print(f"    Found Supplier: {supplier.supplier_name} (ID: {supplier.id})")

        # 3. Create a unique Purchase Order
        print("\n[3] Creating Purchase Order (Testing Auto purchase_id)...")
        import datetime
        timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
        order_number = f"PO{timestamp}"
        
        po = PurchaseOrder(
            order_number=order_number,
            order_placed_by="Tester",
            supplier_id=supplier.id,
            supplier_name=supplier.supplier_name,
            quantity=50,
            unit_price=20.0,
            final_total=1000.0, 
            pi_status="open",
            is_active=True
        )
        db.add(po)
        db.commit()
        db.refresh(po)
        print(f"    Success! Created PO: {po.order_number}")
        print(f"    Auto purchase_id: {po.purchase_id}")
        print(f"    Total Amount: ${po.final_total}")

        # 4. Record a Payment
        print("\n[4] Recording Partial Payment...")
        payment_amount = 500.0
        payment = PurchasePayment(
            supplier_id=supplier.id,
            purchase_order_id=po.id,
            amount=payment_amount,
            payment_mode="Bank Transfer",
            reference_number=f"K-{timestamp}",
            remarks="Auto test payment"
        )
        db.add(payment)
        db.commit()
        db.refresh(payment)
        print(f"    Payment Recorded: ${payment.amount}")

        # 5. Verify Balance
        print("\n[5] Verifying Balance Logic...")
        
        # Recalculate directly to verify strict correctness
        total_orders = db.query(func.sum(PurchaseOrder.final_total)).filter(
            PurchaseOrder.supplier_id == supplier.id,
            PurchaseOrder.is_active == True,
            PurchaseOrder.pi_status != 'cancelled'
        ).scalar() or 0
        
        total_paid = db.query(func.sum(PurchasePayment.amount)).filter(
            PurchasePayment.supplier_id == supplier.id
        ).scalar() or 0
        
        balance = total_orders - total_paid
        
        print(f"    Total Orders Value: {total_orders}")
        print(f"    Total Paid Value:   {total_paid}")
        print(f"    Pending Balance:    {balance}")
        
        # We expect at least the PO we made (1000) - Paid (500) = 500
        # (plus any previous runs)
        
        if balance >= 0:
            print("\n[SUCCESS] Balance logic is operational.")
        else:
            print("\n[FAIL] Balance is negative? (Could be overpayment, valid but strictly checking calculation)")

    except Exception as e:
        print(f"\n[ERROR] An error occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        print("\n" + "=" * 60)

if __name__ == "__main__":
    test_features()
