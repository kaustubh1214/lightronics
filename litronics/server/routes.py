"""
Litronics Product Management System - API Routes
FastAPI endpoint definitions
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import func, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import Product, Category, Supplier, HsnCode, CurrencyRate, PurchaseOrder, PurchasePayment, DispatchMaster, DispatchItem
from schemas import ProductCreate, ProductUpdate, PurchaseOrderCreate, PurchaseOrderUpdate, PurchasePaymentCreate, PurchaseBatchCreate, DispatchCreate, DispatchUpdate
from purchase_ids import generate_purchase_id as _generate_purchase_id, generate_order_number as _generate_order_number


# =============================================================================
# Router Setup
# =============================================================================

router = APIRouter(prefix="/api", tags=["API"])


# =============================================================================
# Product Routes
# =============================================================================

@router.get("/products")
def get_products(db: Session = Depends(get_db)):
    """Get all active products."""
    products = db.query(Product).filter(Product.is_active == True).all()
    result = []

    for p in products:
        result.append({
            "id": p.id,
            "part_code": p.part_code,
            "description": p.description,
            "category_name": p.category.category_name if p.category else None,
            "category_id": p.category_id,
            "pieces_per_unit": p.pieces_per_unit,
            "packaging_quantity": p.packaging_quantity,
            "hsn_code": p.hsn.hsn_code if p.hsn else None,
            "hsn_code_id": p.hsn_code_id,
            "unit_price_usd": p.unit_price_usd,
            "unit_price_rmb": p.unit_price_rmb,
            "unit_price_inr": p.unit_price_inr,
            "primary_currency": p.primary_currency,
            "basic_custom_duty_percentage": p.basic_custom_duty_percentage,
            "freight_percentage": p.freight_percentage,
            "gst_percentage": p.gst_percentage,
            "landed_price_inr": p.landed_price_inr,
            "supplier_ids": [s.id for s in p.suppliers],
        })

    return {"success": True, "data": result}


@router.post("/products")
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    """Create a new product with landed price calculation."""
    # Get currency rate
    rate_to_inr = 1.0
    if product.primary_currency != "INR":
        rate = db.query(CurrencyRate).filter(
            CurrencyRate.currency_code == product.primary_currency
        ).first()
        
        if rate:
            rate_to_inr = rate.rate_to_inr
        else:
            # Fallback hardcoded defaults if DB update missing
            defaults = {"USD": 83.50, "RMB": 11.50}
            rate_to_inr = defaults.get(product.primary_currency, 1.0)

    # Calculate landed price
    if product.primary_currency == "USD":
        base_price = (product.unit_price_usd or 0) * rate_to_inr
    elif product.primary_currency == "RMB":
        base_price = (product.unit_price_rmb or 0) * rate_to_inr
    else:
        base_price = product.unit_price_inr or 0

    bcd = base_price * (product.basic_custom_duty_percentage / 100)
    freight = base_price * (product.freight_percentage / 100)
    subtotal = base_price + bcd + freight
    gst = subtotal * (product.gst_percentage / 100)
    landed_price_inr = subtotal + gst

    # Safe division for USD landed price
    landed_price_usd = 0
    if rate_to_inr > 0:
        landed_price_usd = landed_price_inr / rate_to_inr

    # Create product
    db_product = Product(
        part_code=product.part_code,
        description=product.description,
        category_id=product.category_id,
        pieces_per_unit=product.pieces_per_unit,
        packaging_quantity=product.packaging_quantity,
        hsn_code_id=product.hsn_code_id,
        unit_price_usd=product.unit_price_usd,
        unit_price_rmb=product.unit_price_rmb,
        unit_price_inr=product.unit_price_inr,
        primary_currency=product.primary_currency,
        basic_custom_duty_percentage=product.basic_custom_duty_percentage,
        freight_percentage=product.freight_percentage,
        gst_percentage=product.gst_percentage,
        landed_price_inr=landed_price_inr,
        landed_price_usd=landed_price_usd,
    )

    # Link suppliers
    if product.supplier_ids:
        suppliers = db.query(Supplier).filter(
            Supplier.id.in_(product.supplier_ids)
        ).all()
        db_product.suppliers = suppliers

    try:
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Product with this Part Code already exists.")
    except Exception as e:
        db.rollback()
        print(f"Error creating product: {str(e)}") # Log for debug
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

    return {"success": True, "id": db_product.id, "message": "Product created"}


@router.delete("/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    """Soft delete a product by setting is_active to False."""
    product = db.query(Product).filter(Product.id == product_id).first()

    if product:
        product.is_active = False
        db.commit()

    return {"success": True, "message": "Product deleted"}


@router.put("/products/{product_id}")
def update_product(product_id: int, product: ProductUpdate, db: Session = Depends(get_db)):
    """Update an existing product with landed price recalculation."""
    db_product = db.query(Product).filter(
        Product.id == product_id,
        Product.is_active == True
    ).first()
    
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update fields if provided
    if product.part_code is not None:
        db_product.part_code = product.part_code
    if product.description is not None:
        db_product.description = product.description
    if product.category_id is not None:
        db_product.category_id = product.category_id
    if product.pieces_per_unit is not None:
        db_product.pieces_per_unit = product.pieces_per_unit
    if product.packaging_quantity is not None:
        db_product.packaging_quantity = product.packaging_quantity
    if product.hsn_code_id is not None:
        db_product.hsn_code_id = product.hsn_code_id
    if product.unit_price_usd is not None:
        db_product.unit_price_usd = product.unit_price_usd
    if product.unit_price_rmb is not None:
        db_product.unit_price_rmb = product.unit_price_rmb
    if product.unit_price_inr is not None:
        db_product.unit_price_inr = product.unit_price_inr
    if product.primary_currency is not None:
        db_product.primary_currency = product.primary_currency
    if product.basic_custom_duty_percentage is not None:
        db_product.basic_custom_duty_percentage = product.basic_custom_duty_percentage
    if product.freight_percentage is not None:
        db_product.freight_percentage = product.freight_percentage
    if product.gst_percentage is not None:
        db_product.gst_percentage = product.gst_percentage
    
    # Update suppliers if provided
    if product.supplier_ids is not None:
        suppliers = db.query(Supplier).filter(
            Supplier.id.in_(product.supplier_ids)
        ).all()
        db_product.suppliers = suppliers
    
    # Recalculate landed price
    rate_to_inr = 1.0
    primary_currency = db_product.primary_currency or "USD"
    if primary_currency != "INR":
        rate = db.query(CurrencyRate).filter(
            CurrencyRate.currency_code == primary_currency
        ).first()
        
        if rate:
            rate_to_inr = rate.rate_to_inr
        else:
            defaults = {"USD": 83.50, "RMB": 11.50}
            rate_to_inr = defaults.get(primary_currency, 1.0)

    if primary_currency == "USD":
        base_price = (db_product.unit_price_usd or 0) * rate_to_inr
    elif primary_currency == "RMB":
        base_price = (db_product.unit_price_rmb or 0) * rate_to_inr
    else:
        base_price = db_product.unit_price_inr or 0

    bcd = base_price * ((db_product.basic_custom_duty_percentage or 0) / 100)
    freight = base_price * ((db_product.freight_percentage or 0) / 100)
    subtotal = base_price + bcd + freight
    gst = subtotal * ((db_product.gst_percentage or 18) / 100)
    landed_price_inr = subtotal + gst
    
    landed_price_usd = 0
    if rate_to_inr > 0:
        landed_price_usd = landed_price_inr / rate_to_inr
    
    db_product.landed_price_inr = landed_price_inr
    db_product.landed_price_usd = landed_price_usd
    
    try:
        db.commit()
        db.refresh(db_product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Product with this Part Code already exists.")
    except Exception as e:
        db.rollback()
        print(f"Error updating product: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")
    
    return {"success": True, "id": db_product.id, "message": "Product updated successfully"}


@router.get("/products/by-part-code/{part_code}")
def get_product_by_part_code(part_code: str, db: Session = Depends(get_db)):
    """Get product details including HSN data by part code."""
    product = db.query(Product).filter(Product.part_code == part_code).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    hsn_data = None
    if product.hsn:
        hsn_data = {
            "id": product.hsn.id,
            "hsn_code": product.hsn.hsn_code,
            "description": product.hsn.description,
            "hsn_category": product.hsn.hsn_category,
            "basic_custom_duty_percentage": product.hsn.basic_custom_duty_percentage,
            "gst_percentage": product.hsn.gst_percentage,
        }

    return {
        "success": True,
        "data": {
            "id": product.id,
            "part_code": product.part_code,
            "description": product.description,
            "category_name": product.category.category_name if product.category else None,
            "pieces_per_unit": product.pieces_per_unit,
            "packaging_quantity": product.packaging_quantity,
            "unit_price_usd": product.unit_price_usd,
            "unit_price_rmb": product.unit_price_rmb,
            "unit_price_inr": product.unit_price_inr,
            "primary_currency": product.primary_currency,
            "basic_custom_duty_percentage": product.basic_custom_duty_percentage,
            "freight_percentage": product.freight_percentage,
            "gst_percentage": product.gst_percentage,
            "landed_price_inr": product.landed_price_inr,
            "landed_price_usd": product.landed_price_usd,
        }
    }


@router.get("/products/{product_id}/purchase-history")
def get_product_purchase_history(product_id: int, limit: int = 3, db: Session = Depends(get_db)):
    """Get the last N purchase prices for a product."""
    history = db.query(PurchaseOrder).filter(
        PurchaseOrder.product_id == product_id,
        PurchaseOrder.is_active == True
    ).order_by(PurchaseOrder.order_date.desc()).limit(limit).all()

    result = []
    for h in history:
        result.append({
            "order_date": h.order_date.strftime("%Y-%m-%d") if h.order_date else None,
            "supplier_name": h.supplier_name,
            "quantity": h.quantity,
            "unit_price": h.unit_price,
            "currency": h.price_currency,
            "order_number": h.order_number
        })
    
    return {"success": True, "data": result}


# =============================================================================
# Category Routes
# =============================================================================

@router.get("/categories")
def get_categories(db: Session = Depends(get_db)):
    """Get all categories."""
    cats = db.query(Category).all()

    return {
        "success": True,
        "data": [
            {
                "id": c.id,
                "category_name": c.category_name,
                "freight_percentage": c.freight_percentage,
            }
            for c in cats
        ]
    }


# =============================================================================
# Supplier Routes
# =============================================================================

@router.get("/suppliers")
def get_suppliers(db: Session = Depends(get_db)):
    """Get all active suppliers."""
    sups = db.query(Supplier).filter(Supplier.is_active == True).all()

    return {
        "success": True,
        "data": [
            {"id": s.id, "supplier_name": s.supplier_name}
            for s in sups
        ]
    }


# =============================================================================
# HSN Code Routes
# =============================================================================

@router.get("/hsn-codes")
def get_hsn_codes(db: Session = Depends(get_db)):
    """Get all HSN codes."""
    hsns = db.query(HsnCode).all()

    return {
        "success": True,
        "data": [
            {
                "id": h.id,
                "hsn_code": h.hsn_code,
                "description": h.description,
                "hsn_category": h.hsn_category,
                "basic_custom_duty_percentage": h.basic_custom_duty_percentage,
                "gst_percentage": h.gst_percentage,
            }
            for h in hsns
        ]
    }


@router.get("/hsn-codes/{hsn_id}")
def get_hsn_by_id(hsn_id: int, db: Session = Depends(get_db)):
    """Get HSN details by ID."""
    hsn = db.query(HsnCode).filter(HsnCode.id == hsn_id).first()

    if not hsn:
        raise HTTPException(status_code=404, detail="HSN code not found")

    return {
        "success": True,
        "data": {
            "id": hsn.id,
            "hsn_code": hsn.hsn_code,
            "description": hsn.description,
            "hsn_category": hsn.hsn_category,
            "basic_custom_duty_percentage": hsn.basic_custom_duty_percentage,
            "gst_percentage": hsn.gst_percentage,
        }
    }


@router.post("/hsn-codes")
def create_hsn_code(hsn: dict, db: Session = Depends(get_db)):
    """Create a new HSN code."""
    # Check if exists
    existing = db.query(HsnCode).filter(
        HsnCode.hsn_code == hsn.get("hsn_code")
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="HSN Code already exists")

    new_hsn = HsnCode(
        hsn_code=hsn.get("hsn_code"),
        description=hsn.get("description"),
        hsn_category=hsn.get("hsn_category"),
        basic_custom_duty_percentage=float(hsn.get("basic_custom_duty_percentage", 0)),
        gst_percentage=float(hsn.get("gst_percentage", 18)),
    )

    db.add(new_hsn)
    db.commit()
    db.refresh(new_hsn)

    return {"success": True, "id": new_hsn.id, "message": "HSN Code created successfully"}


# =============================================================================
# Currency Rate Routes
# =============================================================================

@router.get("/currency-rates")
def get_currency_rates(db: Session = Depends(get_db)):
    """Get all currency rates."""
    rates = db.query(CurrencyRate).all()

    return {
        "success": True,
        "data": [
            {"currency_code": r.currency_code, "rate_to_inr": r.rate_to_inr}
            for r in rates
        ]
    }


# =============================================================================
# Purchase Order Routes
# =============================================================================

def _get_currency_rate_to_inr(db: Session, currency_code: str) -> float:
    rate = db.query(CurrencyRate).filter(CurrencyRate.currency_code == currency_code).first()
    return float(rate.rate_to_inr) if rate and rate.rate_to_inr else 1.0


@router.get("/purchase-orders")
def get_purchase_orders(db: Session = Depends(get_db)):
    """Get all active purchase orders."""
    orders = db.query(PurchaseOrder).filter(
        PurchaseOrder.is_active == True
    ).order_by(PurchaseOrder.created_at.desc()).all()
    
    result = []
    for o in orders:
        result.append({
            "id": o.id,
            "purchase_id": o.purchase_id,  # Unique ID for tracking/reporting
            "order_number": o.order_number,
            "order_placed_by": o.order_placed_by,
            "order_date": o.order_date.isoformat() if o.order_date else None,
            "product_id": o.product_id,
            "part_code": o.part_code,
            "item_description": o.item_description,
            "hsn_code": o.hsn_code,
            "category_name": o.category_name,
            "supplier_id": o.supplier_id,
            "supplier_name": o.supplier_name,
            "quantity": o.quantity,
            "price_currency": o.price_currency,
            "price_usd": o.price_usd,
            "price_inr": o.price_inr,
            "price_rmb": o.price_rmb,
            "unit_price": o.unit_price,
            "subtotal": o.subtotal,
            "other_charges": o.other_charges,
            "total": o.total,
            "gst_applicable": o.gst_applicable,
            "gst_percentage": o.gst_percentage,
            "gst_amount": o.gst_amount,
            "final_total": o.final_total,
            "delivery_date": o.delivery_date.isoformat() if o.delivery_date else None,
            "delivery_type": o.delivery_type,
            "pi_status": o.pi_status,
            "remarks": o.remarks,
        })
    
    return {"success": True, "data": result}


@router.get("/purchase-orders/ready-to-dispatch")
def get_ready_to_dispatch_orders(db: Session = Depends(get_db)):
    """
    Get all purchase orders marked as 'ready_to_dispatch' status.
    These are the only orders that can be dispatched.
    This route MUST be defined before /purchase-orders/{order_id} to avoid routing conflicts.
    """
    orders = db.query(PurchaseOrder).filter(
        PurchaseOrder.pi_status == "ready_to_dispatch",
        PurchaseOrder.is_active == True
    ).order_by(PurchaseOrder.created_at.desc()).all()
    
    # Group by purchase_id
    batches = {}
    for o in orders:
        pid = o.purchase_id
        if pid not in batches:
            batches[pid] = {
                "purchase_id": pid,
                "order_number": o.order_number,
                "order_date": o.order_date.isoformat() if o.order_date else None,
                "supplier_id": o.supplier_id,
                "supplier_name": o.supplier_name,
                "delivery_type": o.delivery_type,
                "currency": o.price_currency,
                "items": []
            }
        
        batches[pid]["items"].append({
            "id": o.id,
            "part_code": o.part_code,
            "description": o.item_description,
            "hsn_code": o.hsn_code,
            "category_name": o.category_name,
            "quantity": o.quantity,
            "unit_price": o.unit_price,
            "price_currency": o.price_currency,
            "total": o.final_total
        })
    
    return {"success": True, "data": list(batches.values())}


@router.get("/purchase-orders/{order_id}")
def get_purchase_order(order_id: int, db: Session = Depends(get_db)):
    """Get a specific purchase order by ID."""
    order = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == order_id,
        PurchaseOrder.is_active == True
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    return {
        "success": True,
        "data": {
            "id": order.id,
            "purchase_id": order.purchase_id,  # Unique ID for tracking/reporting
            "order_number": order.order_number,
            "order_placed_by": order.order_placed_by,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "product_id": order.product_id,
            "part_code": order.part_code,
            "item_description": order.item_description,
            "hsn_code": order.hsn_code,
            "category_name": order.category_name,
            "supplier_id": order.supplier_id,
            "supplier_name": order.supplier_name,
            "quantity": order.quantity,
            "price_currency": order.price_currency,
            "price_usd": order.price_usd,
            "price_inr": order.price_inr,
            "price_rmb": order.price_rmb,
            "unit_price": order.unit_price,
            "subtotal": order.subtotal,
            "other_charges": order.other_charges,
            "total": order.total,
            "gst_applicable": order.gst_applicable,
            "gst_percentage": order.gst_percentage,
            "gst_amount": order.gst_amount,
            "final_total": order.final_total,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "delivery_type": order.delivery_type,
            "pi_status": order.pi_status,
            "remarks": order.remarks,
        }
    }


@router.post("/purchase-orders")
def create_purchase_order(order: PurchaseOrderCreate, db: Session = Depends(get_db)):
    """Create a new purchase order with unique purchase ID for tracking."""
    # Generate unique purchase ID and order number (shared logic; also used by model hooks).
    conn = db.connection()
    purchase_id = _generate_purchase_id(conn)
    order_number = _generate_order_number(conn)
    
    # Get product details if product_id is provided
    part_code = order.part_code
    item_description = order.item_description
    hsn_code = order.hsn_code
    category_name = order.category_name
    price_usd = order.price_usd
    price_inr = order.price_inr
    price_rmb = order.price_rmb
    
    if order.product_id:
        product = db.query(Product).filter(Product.id == order.product_id).first()
        if product:
            part_code = product.part_code
            item_description = product.description
            hsn_code = product.hsn.hsn_code if product.hsn else None
            category_name = product.category.category_name if product.category else None
            # Get reference prices from product
            price_usd = product.unit_price_usd
            price_inr = product.unit_price_inr
            price_rmb = product.unit_price_rmb
    
    # Get supplier name if supplier_id is provided
    supplier_name = order.supplier_name
    if order.supplier_id:
        supplier = db.query(Supplier).filter(Supplier.id == order.supplier_id).first()
        if supplier:
            supplier_name = supplier.supplier_name
    
    # Calculate totals
    unit_price = order.unit_price or 0
    quantity = order.quantity or 1
    rate_to_inr = _get_currency_rate_to_inr(db, order.price_currency or "INR")
    subtotal = (unit_price * rate_to_inr) * quantity
    other_charges = order.other_charges or 0
    total = subtotal + other_charges
    
    # Calculate GST if applicable
    gst_amount = 0
    if order.gst_applicable:
        gst_percentage = order.gst_percentage or 18
        gst_amount = total * (gst_percentage / 100)
    else:
        gst_percentage = 0
    
    final_total = total + gst_amount
    
    # Parse delivery date
    delivery_date = None
    if order.delivery_date:
        try:
            delivery_date = datetime.fromisoformat(order.delivery_date.replace('Z', '+00:00'))
        except:
            pass
    
    # Create purchase order with unique purchase_id
    db_order = PurchaseOrder(
        purchase_id=purchase_id,  # Unique ID for tracking/reporting
        order_number=order_number,
        order_placed_by=order.order_placed_by,
        product_id=order.product_id,
        part_code=part_code,
        item_description=item_description,
        hsn_code=hsn_code,
        category_name=category_name,
        supplier_id=order.supplier_id,
        supplier_name=supplier_name,
        quantity=quantity,
        price_currency=order.price_currency,
        price_usd=price_usd,
        price_inr=price_inr,
        price_rmb=price_rmb,
        unit_price=unit_price,
        subtotal=subtotal,
        other_charges=other_charges,
        total=total,
        gst_applicable=order.gst_applicable,
        gst_percentage=gst_percentage,
        gst_amount=gst_amount,
        final_total=final_total,
        delivery_date=delivery_date,
        delivery_type=order.delivery_type,
        pi_status="open",  # Always starts as 'open'
        remarks=order.remarks,
    )

    # Commit with a small retry to avoid rare uniqueness races (e.g., concurrent inserts).
    for attempt in range(2):
        try:
            db.add(db_order)
            db.commit()
            db.refresh(db_order)
            break
        except IntegrityError:
            db.rollback()
            if attempt == 1:
                raise
            # Regenerate IDs and try again.
            conn = db.connection()
            db_order.purchase_id = _generate_purchase_id(conn)
            db_order.order_number = _generate_order_number(conn)
    
    return {
        "success": True,
        "id": db_order.id,
        "purchase_id": db_order.purchase_id,  # Return unique purchase ID
        "order_number": db_order.order_number,
        "message": "Purchase order created successfully"
    }


@router.post("/purchase-orders/batch")
def create_purchase_order_batch(batch: PurchaseBatchCreate, db: Session = Depends(get_db)):
    """Create a batch of purchase orders (one PO, multiple items)."""
    conn = db.connection()
    
    # Generate common identifiers for the batch
    # We use a loop/retry mechanism similar to single create to ensure uniqueness if needed
    # (Though we removed UNIQUE constraints, it's good practice to generate valid IDs)
    purchase_id = _generate_purchase_id(conn)
    order_number = _generate_order_number(conn)
    
    # Common fields
    order_date = datetime.now()
    delivery_date = None
    if batch.delivery_date:
        try:
            delivery_date = datetime.fromisoformat(batch.delivery_date.replace('Z', '+00:00'))
        except:
            pass

    created_items = []
    
    try:
        for item in batch.items:
            # Get product details if product_id is provided
            part_code = item.part_code
            item_description = item.item_description
            hsn_code = item.hsn_code
            category_name = item.category_name
            price_usd = item.price_usd
            price_inr = item.price_inr
            price_rmb = item.price_rmb
            
            if item.product_id:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    part_code = product.part_code
                    item_description = product.description
                    hsn_code = product.hsn.hsn_code if product.hsn else None
                    category_name = product.category.category_name if product.category else None
                    if not price_usd: price_usd = product.unit_price_usd
                    if not price_inr: price_inr = product.unit_price_inr
                    if not price_rmb: price_rmb = product.unit_price_rmb
            
            # Use batch supplier if item supplier not specified (usually same)
            supplier_id = item.supplier_id if hasattr(item, 'supplier_id') else batch.supplier_id
            supplier_name = item.supplier_name if hasattr(item, 'supplier_name') else batch.supplier_name
            
            if not supplier_name and batch.supplier_id:
                sup = db.query(Supplier).filter(Supplier.id == batch.supplier_id).first()
                if sup: supplier_name = sup.supplier_name

            # Calculate totals
            unit_price = item.unit_price or 0
            quantity = item.quantity or 1
            rate_to_inr = _get_currency_rate_to_inr(db, item.price_currency or "USD")
            subtotal = (unit_price * rate_to_inr) * quantity
            other_charges = item.other_charges or 0
            total = subtotal + other_charges
            
            # Calculate GST
            gst_amount = 0
            if item.gst_applicable:
                gst_percentage = item.gst_percentage or 18
                gst_amount = total * (gst_percentage / 100)
            else:
                gst_percentage = 0
            
            final_total = total + gst_amount
            
            db_order = PurchaseOrder(
                purchase_id=purchase_id,
                order_number=order_number,
                order_placed_by=batch.order_placed_by,
                order_date=order_date,
                product_id=item.product_id,
                part_code=part_code,
                item_description=item_description,
                hsn_code=hsn_code,
                category_name=category_name,
                supplier_id=batch.supplier_id, 
                supplier_name=supplier_name,
                quantity=quantity,
                price_currency=item.price_currency,
                price_usd=price_usd,
                price_inr=price_inr,
                price_rmb=price_rmb,
                unit_price=unit_price,
                subtotal=subtotal,
                other_charges=other_charges,
                total=total,
                gst_applicable=item.gst_applicable,
                gst_percentage=gst_percentage,
                gst_amount=gst_amount,
                final_total=final_total,
                delivery_date=delivery_date,
                delivery_type=batch.delivery_type,
                pi_status="open",
                remarks=item.remarks or batch.global_remarks, # Merge or fallback
            )
            db.add(db_order)
            created_items.append(db_order)

        db.commit()
        # Refresh first item to get IDs if needed
        if created_items:
            db.refresh(created_items[0])

    except Exception as e:
        db.rollback()
        print(f"Error creating batch order: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating batch: {str(e)}")

    return {
        "success": True,
        "purchase_id": purchase_id,
        "order_number": order_number,
        "items_count": len(created_items),
        "message": "Purchase order batch created successfully"
    }


@router.put("/purchase-orders/{order_id}")
def update_purchase_order(
    order_id: int,
    order: PurchaseOrderUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing purchase order."""
    db_order = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == order_id,
        PurchaseOrder.is_active == True
    ).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    # Update fields if provided
    if order.order_placed_by is not None:
        db_order.order_placed_by = order.order_placed_by
    if order.quantity is not None:
        db_order.quantity = order.quantity
    if order.price_currency is not None:
        db_order.price_currency = order.price_currency
    if order.unit_price is not None:
        db_order.unit_price = order.unit_price
    if order.other_charges is not None:
        db_order.other_charges = order.other_charges
    if order.gst_applicable is not None:
        db_order.gst_applicable = order.gst_applicable
    if order.gst_percentage is not None:
        db_order.gst_percentage = order.gst_percentage
    if order.delivery_type is not None:
        db_order.delivery_type = order.delivery_type
    if order.pi_status is not None:
        db_order.pi_status = order.pi_status
    if order.remarks is not None:
        db_order.remarks = order.remarks
    
    # Parse delivery date if provided
    if order.delivery_date is not None:
        try:
            db_order.delivery_date = datetime.fromisoformat(
                order.delivery_date.replace('Z', '+00:00')
            )
        except:
            pass
    
    # Recalculate totals
    rate_to_inr = _get_currency_rate_to_inr(db, db_order.price_currency or "INR")
    db_order.subtotal = (db_order.unit_price * rate_to_inr) * db_order.quantity
    db_order.total = db_order.subtotal + db_order.other_charges
    
    if db_order.gst_applicable:
        db_order.gst_amount = db_order.total * (db_order.gst_percentage / 100)
    else:
        db_order.gst_amount = 0
    
    db_order.final_total = db_order.total + db_order.gst_amount
    
    db.commit()
    db.refresh(db_order)
    
    return {
        "success": True,
        "id": db_order.id,
        "message": "Purchase order updated successfully"
    }


@router.delete("/purchase-orders/{order_id}")
def delete_purchase_order(order_id: int, db: Session = Depends(get_db)):
    """Soft delete a purchase order."""
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    
    if order:
        order.is_active = False
        db.commit()
    
    return {"success": True, "message": "Purchase order deleted"}


@router.patch("/purchase-orders/{order_id}/status")
def update_purchase_order_status(
    order_id: int,
    status: str,
    db: Session = Depends(get_db)
):
    """Update just the PI status of a purchase order."""
    valid_statuses = ["open", "confirmed", "ready_to_dispatch", "shipped", "delivered", "cancelled"]
    
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    order = db.query(PurchaseOrder).filter(
        PurchaseOrder.id == order_id,
        PurchaseOrder.is_active == True
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    order.pi_status = status
    db.commit()
    
    return {"success": True, "message": f"Status updated to '{status}'"}


# =============================================================================
# Payment Routes
# =============================================================================

@router.post("/payments")
def create_payment(payment: PurchasePaymentCreate, db: Session = Depends(get_db)):
    """Record a new payment to a supplier."""
    # Verify supplier
    supplier = db.query(Supplier).filter(Supplier.id == payment.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Parse date
    payment_date = datetime.now()
    if payment.payment_date:
        try:
            payment_date = datetime.fromisoformat(payment.payment_date.replace('Z', '+00:00'))
        except:
            pass
            
    db_payment = PurchasePayment(
        supplier_id=payment.supplier_id,
        purchase_order_id=payment.purchase_order_id,
        amount=payment.amount,
        payment_date=payment_date,
        payment_mode=payment.payment_mode,
        reference_number=payment.reference_number,
        remarks=payment.remarks,
    )
    
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    
    return {"success": True, "id": db_payment.id, "message": "Payment recorded successfully"}


@router.get("/payments")
def get_payments(supplier_id: int = None, db: Session = Depends(get_db)):
    """Get all payments, optionally filtered by supplier."""
    query = db.query(PurchasePayment)
    
    if supplier_id:
        query = query.filter(PurchasePayment.supplier_id == supplier_id)
        
    payments = query.order_by(PurchasePayment.payment_date.desc()).all()
    
    result = []
    for p in payments:
        result.append({
            "id": p.id,
            "supplier_id": p.supplier_id,
            "supplier_name": p.supplier.supplier_name if p.supplier else "Unknown",
            "purchase_order_id": p.purchase_order_id,
            "po_number": p.purchase_order.order_number if p.purchase_order else None,
            "amount": p.amount,
            "payment_date": p.payment_date.isoformat(),
            "payment_mode": p.payment_mode,
            "reference_number": p.reference_number,
            "remarks": p.remarks,
        })
        
    return {"success": True, "data": result}


@router.get("/suppliers/payment-summary")
def get_supplier_payment_summary(db: Session = Depends(get_db)):
    """
    Get comprehensive pending balance summary for each supplier.
    Includes order counts, total values, payments made, and pending balance.
    """
    orders_subq = (
        db.query(
            PurchaseOrder.supplier_id.label("supplier_id"),
            func.count(PurchaseOrder.id).label("total_orders"),
            func.sum(case((PurchaseOrder.pi_status == "open", 1), else_=0)).label("open_orders"),
            func.sum(case((PurchaseOrder.pi_status == "confirmed", 1), else_=0)).label("confirmed_orders"),
            func.sum(case((PurchaseOrder.pi_status == "shipped", 1), else_=0)).label("shipped_orders"),
            func.sum(case((PurchaseOrder.pi_status == "delivered", 1), else_=0)).label("delivered_orders"),
            func.sum(func.coalesce(PurchaseOrder.final_total, 0)).label("total_purchase_value"),
        )
        .filter(PurchaseOrder.is_active == True, PurchaseOrder.pi_status != "cancelled")
        .group_by(PurchaseOrder.supplier_id)
        .subquery()
    )

    payments_subq = (
        db.query(
            PurchasePayment.supplier_id.label("supplier_id"),
            func.sum(func.coalesce(PurchasePayment.amount, 0)).label("total_paid"),
        )
        .group_by(PurchasePayment.supplier_id)
        .subquery()
    )

    rows = (
        db.query(
            Supplier.id.label("supplier_id"),
            Supplier.supplier_name,
            Supplier.supplier_code,
            Supplier.currency_preference.label("currency"),
            orders_subq.c.total_orders,
            orders_subq.c.open_orders,
            orders_subq.c.confirmed_orders,
            orders_subq.c.shipped_orders,
            orders_subq.c.delivered_orders,
            orders_subq.c.total_purchase_value,
            payments_subq.c.total_paid,
        )
        .outerjoin(orders_subq, orders_subq.c.supplier_id == Supplier.id)
        .outerjoin(payments_subq, payments_subq.c.supplier_id == Supplier.id)
        .filter(Supplier.is_active == True)
        .all()
    )

    result = []
    for r in rows:
        total_purchase_value = float(r.total_purchase_value or 0)
        total_paid = float(r.total_paid or 0)
        balance = total_purchase_value - total_paid
        result.append(
            {
                "supplier_id": r.supplier_id,
                "supplier_name": r.supplier_name,
                "supplier_code": r.supplier_code,
                "currency": r.currency,
                "total_orders": int(r.total_orders or 0),
                "open_orders": int(r.open_orders or 0),
                "confirmed_orders": int(r.confirmed_orders or 0),
                "shipped_orders": int(r.shipped_orders or 0),
                "delivered_orders": int(r.delivered_orders or 0),
                "total_purchase_value": round(total_purchase_value, 2),
                "total_paid": round(total_paid, 2),
                "balance_pending": round(balance, 2),
                "payment_status": "Paid"
                if round(balance, 2) <= 0
                else ("Partial" if total_paid > 0 else "Pending"),
            }
        )

    result.sort(key=lambda x: x["balance_pending"], reverse=True)
    return {"success": True, "data": result}


@router.get("/suppliers/{supplier_id}/payment-details")
def get_supplier_payment_details(supplier_id: int, db: Session = Depends(get_db)):
    """
    Get detailed payment information for a specific supplier.
    Includes order-wise breakdown with purchase IDs for tracking.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    # Get all orders for this supplier
    orders = db.query(PurchaseOrder).filter(
        PurchaseOrder.supplier_id == supplier_id,
        PurchaseOrder.is_active == True
    ).order_by(PurchaseOrder.created_at.desc()).all()
    
    # Get all payments for this supplier
    payments = db.query(PurchasePayment).filter(
        PurchasePayment.supplier_id == supplier_id
    ).order_by(PurchasePayment.payment_date.desc()).all()
    
    # Calculate totals
    total_order_value = sum(float(o.final_total or 0) for o in orders if o.pi_status != 'cancelled')
    total_paid = sum(float(p.amount or 0) for p in payments)
    
    # Build order-wise breakdown
    order_details = []
    for o in orders:
        # Find payments linked to this specific order
        order_payments = [p for p in payments if p.purchase_order_id == o.id]
        order_paid = sum(float(p.amount or 0) for p in order_payments)
        
        order_details.append({
            "id": o.id,
            "purchase_id": o.purchase_id,  # Unique tracking ID
            "order_number": o.order_number,
            "order_date": o.order_date.isoformat() if o.order_date else None,
            "part_code": o.part_code,
            "item_description": o.item_description,
            "quantity": o.quantity,
            "final_total": float(o.final_total or 0),
            "status": o.pi_status,
            "paid_amount": order_paid,
            "pending_amount": float(o.final_total or 0) - order_paid if o.pi_status != 'cancelled' else 0
        })
    
    # Build payment history
    payment_history = [{
        "id": p.id,
        "amount": float(p.amount),
        "payment_date": p.payment_date.isoformat() if p.payment_date else None,
        "payment_mode": p.payment_mode,
        "reference_number": p.reference_number,
        "linked_order_id": p.purchase_order_id,
        "linked_po_number": next((o.order_number for o in orders if o.id == p.purchase_order_id), None),
        "remarks": p.remarks
    } for p in payments]
    
    return {
        "success": True,
        "data": {
            "supplier": {
                "id": supplier.id,
                "name": supplier.supplier_name,
                "code": supplier.supplier_code,
                "currency": supplier.currency_preference
            },
            "summary": {
                "total_orders": len(orders),
                "total_order_value": round(total_order_value, 2),
                "total_paid": round(total_paid, 2),
                "balance_pending": round(total_order_value - total_paid, 2)
            },
            "orders": order_details,
            "payments": payment_history
        }
    }


@router.get("/purchase-orders/by-purchase-id/{purchase_id}")
def get_purchase_order_by_purchase_id(purchase_id: str, db: Session = Depends(get_db)):
    """
    Get a purchase order by its unique purchase_id.
    This enables easy lookup for tracking, reporting, and referencing.
    """
    order = db.query(PurchaseOrder).filter(
        PurchaseOrder.purchase_id == purchase_id,
        PurchaseOrder.is_active == True
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail=f"Purchase order with ID '{purchase_id}' not found")
    
    return {
        "success": True,
        "data": {
            "id": order.id,
            "purchase_id": order.purchase_id,
            "order_number": order.order_number,
            "order_placed_by": order.order_placed_by,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "product_id": order.product_id,
            "part_code": order.part_code,
            "item_description": order.item_description,
            "hsn_code": order.hsn_code,
            "category_name": order.category_name,
            "supplier_id": order.supplier_id,
            "supplier_name": order.supplier_name,
            "quantity": order.quantity,
            "price_currency": order.price_currency,
            "price_usd": order.price_usd,
            "price_inr": order.price_inr,
            "price_rmb": order.price_rmb,
            "unit_price": order.unit_price,
            "subtotal": order.subtotal,
            "other_charges": order.other_charges,
            "total": order.total,
            "gst_applicable": order.gst_applicable,
            "gst_percentage": order.gst_percentage,
            "gst_amount": order.gst_amount,
            "final_total": order.final_total,
            "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
            "delivery_type": order.delivery_type,
            "pi_status": order.pi_status,
            "remarks": order.remarks,
        }
    }


@router.get("/suppliers/{supplier_id}/orders")
def get_supplier_orders(supplier_id: int, db: Session = Depends(get_db)):
    """
    Get all purchase orders for a specific supplier.
    Useful for tracking supplier-specific procurement history.
    """
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    orders = db.query(PurchaseOrder).filter(
        PurchaseOrder.supplier_id == supplier_id,
        PurchaseOrder.is_active == True
    ).order_by(PurchaseOrder.created_at.desc()).all()
    
    result = [{
        "id": o.id,
        "purchase_id": o.purchase_id,
        "order_number": o.order_number,
        "order_placed_by": o.order_placed_by,
        "order_date": o.order_date.isoformat() if o.order_date else None,
        "part_code": o.part_code,
        "item_description": o.item_description,
        "quantity": o.quantity,
        "final_total": o.final_total,
        "pi_status": o.pi_status,
        "delivery_date": o.delivery_date.isoformat() if o.delivery_date else None,
    } for o in orders]
    
    return {
        "success": True,
        "supplier": {
            "id": supplier.id,
            "name": supplier.supplier_name
        },
        "data": result
    }



# =============================================================================
# Reports
# =============================================================================

@router.get("/reports/orders-payment-status")
def get_orders_payment_status(db: Session = Depends(get_db)):
    """
    Get payment status grouped by PRO (Purchase Batch).
    Aggregates all line items and payments for a single purchase_id.
    """
    # 1. Get all active orders
    orders = db.query(PurchaseOrder).filter(PurchaseOrder.is_active == True).all()
    
    # 2. Get all payments linked to orders
    payments = db.query(PurchasePayment).filter(PurchasePayment.purchase_order_id != None).all()
    
    # map order_id -> purchase_id
    order_id_to_pid = {o.id: o.purchase_id for o in orders}
    
    # Groups
    batches = {}
    
    # Group Orders
    for o in orders:
        pid = o.purchase_id
        if pid not in batches:
            batches[pid] = {
                "id": o.id, # Representative ID (first item)
                "purchase_id": pid,
                "order_number": o.order_number,
                "order_date": o.order_date,
                "supplier_name": o.supplier_name,
                "supplier_id": o.supplier_id,
                "part_codes": [],
                "currency": o.price_currency,
                "dispatch_status": o.pi_status, # Take from first item or aggregate?
                "total_amount": 0.0,
                "paid_amount": 0.0
            }
        
        b = batches[pid]
        b["total_amount"] += float(o.final_total or 0)
        b["part_codes"].append(o.part_code)
        # Update status logic? If any item is shipped, show shipped?
        # For now, stick to first item's status or specific logic
    
    # Group Payments
    for p in payments:
        if p.purchase_order_id in order_id_to_pid:
            pid = order_id_to_pid[p.purchase_order_id]
            if pid in batches:
                batches[pid]["paid_amount"] += float(p.amount or 0)
    
    # Format Result
    data = []
    for pid, b in batches.items():
        total = b["total_amount"]
        paid = b["paid_amount"]
        pending = total - paid
        
        if pending <= 0.01:
            status = "Paid"
        elif paid > 0:
            status = "Partial"
        else:
            status = "Pending"
            
        # Summary string
        parts = b["part_codes"]
        summary = f"{parts[0]} + {len(parts)-1} more" if len(parts) > 1 else (parts[0] if parts else "Unknown")
        
        data.append({
            "id": b["id"], # This is the ID of the first item, useful for linking payment
            "purchase_id": b["purchase_id"],
            "order_number": b["order_number"],
            "order_date": b["order_date"].isoformat() if b["order_date"] else None,
            "supplier_name": b["supplier_name"],
            "supplier_id": b["supplier_id"],
            "items_summary": summary,
            "currency": b["currency"],
            "total_amount": total,
            "paid_amount": paid,
            "pending_amount": 0 if pending < 0 else pending,
            "payment_status": status,
            "dispatch_status": b["dispatch_status"]
        })
        
    # Sort by date desc
    data.sort(key=lambda x: x["order_date"] or "", reverse=True)
        
    return {"success": True, "data": data}


# =============================================================================
# Dispatch Routes
# =============================================================================

# NOTE: The /purchase-orders/ready-to-dispatch route is defined earlier in the file
# (before /purchase-orders/{order_id}) to avoid routing conflicts.

@router.get("/dispatches")
def get_dispatches(db: Session = Depends(get_db)):
    """Get all active dispatches."""
    dispatches = db.query(DispatchMaster).filter(
        DispatchMaster.is_active == True
    ).order_by(DispatchMaster.created_at.desc()).all()
    
    result = []
    for d in dispatches:
        items_count = len(d.items) if d.items else 0
        result.append({
            "id": d.id,
            "dispatch_id": d.dispatch_id,
            "purchase_id": d.purchase_id,
            "dispatch_date": d.dispatch_date.isoformat() if d.dispatch_date else None,
            "dispatched_by": d.dispatched_by,
            "delivery_type": d.delivery_type,
            "consignment_type": d.consignment_type,
            "consignment_number": d.consignment_number,
            "consignment_saved_at": d.consignment_saved_at.isoformat() if d.consignment_saved_at else None,
            "expected_arrival_date": d.expected_arrival_date.isoformat() if d.expected_arrival_date else None,
            "supplier_id": d.supplier_id,
            "supplier_name": d.supplier_name,
            "currency": d.currency,
            "total_quantity": d.total_quantity,
            "total_amount": d.total_amount,
            "status": d.status,
            "items_count": items_count,
            "remarks": d.remarks
        })
    
    return {"success": True, "data": result}


@router.get("/dispatches/{dispatch_id}")
def get_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    """Get a specific dispatch with all items."""
    dispatch = db.query(DispatchMaster).filter(
        DispatchMaster.id == dispatch_id,
        DispatchMaster.is_active == True
    ).first()
    
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    items = []
    for item in dispatch.items:
        items.append({
            "id": item.id,
            "purchase_order_id": item.purchase_order_id,
            "part_code": item.part_code,
            "description": item.description,
            "hsn_code": item.hsn_code,
            "category_name": item.category_name,
            "supplier_name": item.supplier_name,
            "ordered_quantity": item.ordered_quantity,
            "dispatch_quantity": item.dispatch_quantity,
            "price_currency": item.price_currency,
            "original_price": item.original_price,
            "dispatch_price": item.dispatch_price,
            "total": item.total
        })
    
    return {
        "success": True,
        "data": {
            "id": dispatch.id,
            "dispatch_id": dispatch.dispatch_id,
            "purchase_id": dispatch.purchase_id,
            "dispatch_date": dispatch.dispatch_date.isoformat() if dispatch.dispatch_date else None,
            "dispatched_by": dispatch.dispatched_by,
            "delivery_type": dispatch.delivery_type,
            "consignment_type": dispatch.consignment_type,
            "consignment_number": dispatch.consignment_number,
            "consignment_saved_at": dispatch.consignment_saved_at.isoformat() if dispatch.consignment_saved_at else None,
            "expected_arrival_date": dispatch.expected_arrival_date.isoformat() if dispatch.expected_arrival_date else None,
            "supplier_id": dispatch.supplier_id,
            "supplier_name": dispatch.supplier_name,
            "currency": dispatch.currency,
            "total_quantity": dispatch.total_quantity,
            "total_amount": dispatch.total_amount,
            "status": dispatch.status,
            "remarks": dispatch.remarks,
            "items": items
        }
    }


@router.post("/dispatches")
def create_dispatch(dispatch: DispatchCreate, db: Session = Depends(get_db)):
    """Create a new dispatch record."""
    # Validate mandatory fields
    if not dispatch.delivery_type:
        raise HTTPException(status_code=400, detail="Delivery type is required")
    if not dispatch.consignment_type:
        raise HTTPException(status_code=400, detail="Consignment type is required")
    if not dispatch.consignment_number:
        raise HTTPException(status_code=400, detail="Consignment number is required")
    if not dispatch.expected_arrival_date:
        raise HTTPException(status_code=400, detail="Expected arrival date is required")
    if not dispatch.items or len(dispatch.items) == 0:
        raise HTTPException(status_code=400, detail="At least one item is required")
    
    # Parse expected arrival date
    try:
        expected_date = datetime.fromisoformat(dispatch.expected_arrival_date.replace('Z', '+00:00'))
    except:
        raise HTTPException(status_code=400, detail="Invalid expected arrival date format")
    
    # Get supplier info
    supplier_name = dispatch.supplier_name
    if dispatch.supplier_id and not supplier_name:
        supplier = db.query(Supplier).filter(Supplier.id == dispatch.supplier_id).first()
        if supplier:
            supplier_name = supplier.supplier_name
    
    # Create dispatch master
    now = datetime.now()
    db_dispatch = DispatchMaster(
        purchase_id=dispatch.purchase_id,
        dispatch_date=now,
        dispatched_by=dispatch.dispatched_by,
        delivery_type=dispatch.delivery_type,
        consignment_type=dispatch.consignment_type,
        consignment_number=dispatch.consignment_number,
        consignment_saved_at=now,
        expected_arrival_date=expected_date,
        supplier_id=dispatch.supplier_id,
        supplier_name=supplier_name,
        currency=dispatch.currency or "USD",
        remarks=dispatch.remarks
    )
    
    db.add(db_dispatch)
    db.flush()  # Get the ID without committing
    
    # Create dispatch items
    total_quantity = 0
    total_amount = 0.0
    
    for item in dispatch.items:
        # Validate dispatch quantity doesn't exceed ordered quantity
        if item.dispatch_quantity > item.ordered_quantity:
            db.rollback()
            raise HTTPException(
                status_code=400, 
                detail=f"Dispatch quantity ({item.dispatch_quantity}) cannot exceed ordered quantity ({item.ordered_quantity}) for {item.part_code}"
            )
        
        item_total = item.dispatch_quantity * item.dispatch_price
        
        db_item = DispatchItem(
            dispatch_id=db_dispatch.id,
            purchase_order_id=item.purchase_order_id,
            part_code=item.part_code,
            description=item.description,
            hsn_code=item.hsn_code,
            category_name=item.category_name,
            supplier_name=item.supplier_name,
            ordered_quantity=item.ordered_quantity,
            dispatch_quantity=item.dispatch_quantity,
            price_currency=item.price_currency,
            original_price=item.original_price,
            dispatch_price=item.dispatch_price,
            total=item_total
        )
        db.add(db_item)
        
        total_quantity += item.dispatch_quantity
        total_amount += item_total
        
        # Update the purchase order status to 'dispatched'
        if item.purchase_order_id:
            po = db.query(PurchaseOrder).filter(PurchaseOrder.id == item.purchase_order_id).first()
            if po:
                po.pi_status = "dispatched"
    
    # Update totals on dispatch master
    db_dispatch.total_quantity = total_quantity
    db_dispatch.total_amount = total_amount
    
    try:
        db.commit()
        db.refresh(db_dispatch)
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Error creating dispatch: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
    
    return {
        "success": True,
        "id": db_dispatch.id,
        "dispatch_id": db_dispatch.dispatch_id,
        "message": "Dispatch created successfully"
    }


@router.put("/dispatches/{dispatch_id}")
def update_dispatch(dispatch_id: int, dispatch: DispatchUpdate, db: Session = Depends(get_db)):
    """Update an existing dispatch record."""
    db_dispatch = db.query(DispatchMaster).filter(
        DispatchMaster.id == dispatch_id,
        DispatchMaster.is_active == True
    ).first()
    
    if not db_dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    # Update fields if provided
    if dispatch.dispatched_by is not None:
        db_dispatch.dispatched_by = dispatch.dispatched_by
    if dispatch.delivery_type is not None:
        db_dispatch.delivery_type = dispatch.delivery_type
    if dispatch.consignment_type is not None:
        db_dispatch.consignment_type = dispatch.consignment_type
    if dispatch.consignment_number is not None:
        db_dispatch.consignment_number = dispatch.consignment_number
        db_dispatch.consignment_saved_at = datetime.now()  # Update saved time when number changes
    if dispatch.expected_arrival_date is not None:
        try:
            db_dispatch.expected_arrival_date = datetime.fromisoformat(
                dispatch.expected_arrival_date.replace('Z', '+00:00')
            )
        except:
            pass
    if dispatch.status is not None:
        db_dispatch.status = dispatch.status
    if dispatch.remarks is not None:
        db_dispatch.remarks = dispatch.remarks
    
    # Update items if provided
    if dispatch.items:
        total_quantity = 0
        total_amount = 0.0
        
        for i, item_update in enumerate(dispatch.items):
            if i < len(db_dispatch.items):
                db_item = db_dispatch.items[i]
                
                if item_update.dispatch_quantity is not None:
                    # Validate quantity
                    if item_update.dispatch_quantity > db_item.ordered_quantity:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Dispatch quantity cannot exceed ordered quantity for {db_item.part_code}"
                        )
                    db_item.dispatch_quantity = item_update.dispatch_quantity
                
                if item_update.dispatch_price is not None:
                    db_item.dispatch_price = item_update.dispatch_price
                
                # Recalculate item total
                db_item.total = db_item.dispatch_quantity * db_item.dispatch_price
                
                total_quantity += db_item.dispatch_quantity
                total_amount += db_item.total
        
        # Update master totals
        db_dispatch.total_quantity = total_quantity
        db_dispatch.total_amount = total_amount
    
    try:
        db.commit()
        db.refresh(db_dispatch)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating dispatch: {str(e)}")
    
    return {
        "success": True,
        "id": db_dispatch.id,
        "message": "Dispatch updated successfully"
    }


@router.delete("/dispatches/{dispatch_id}")
def delete_dispatch(dispatch_id: int, db: Session = Depends(get_db)):
    """Soft delete a dispatch record."""
    dispatch = db.query(DispatchMaster).filter(DispatchMaster.id == dispatch_id).first()
    
    if dispatch:
        dispatch.is_active = False
        db.commit()
    
    return {"success": True, "message": "Dispatch deleted"}


@router.patch("/dispatches/{dispatch_id}/status")
def update_dispatch_status(dispatch_id: int, status: str, db: Session = Depends(get_db)):
    """Update just the status of a dispatch."""
    valid_statuses = ["dispatched", "in_transit", "delivered", "cancelled"]
    
    if status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
        )
    
    dispatch = db.query(DispatchMaster).filter(
        DispatchMaster.id == dispatch_id,
        DispatchMaster.is_active == True
    ).first()
    
    if not dispatch:
        raise HTTPException(status_code=404, detail="Dispatch not found")
    
    dispatch.status = status
    
    # If delivered, update related purchase orders
    if status == "delivered":
        for item in dispatch.items:
            if item.purchase_order_id:
                po = db.query(PurchaseOrder).filter(PurchaseOrder.id == item.purchase_order_id).first()
                if po:
                    po.pi_status = "delivered"
    
    db.commit()
    
    return {"success": True, "message": f"Status updated to '{status}'"}


# =============================================================================
# Health Check
# =============================================================================

@router.get("/health")
def health():
    """API health check endpoint."""
    return {"status": "OK"}
