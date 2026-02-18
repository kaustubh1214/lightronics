"""
Litronics Product Management System - SQLAlchemy Models
Database table definitions
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Table,
    text,
)
from sqlalchemy import event
from sqlalchemy.orm import relationship

from database import Base
from purchase_ids import generate_missing_ids


# =============================================================================
# Association Tables
# =============================================================================

# Many-to-Many: Products <-> Suppliers
product_suppliers = Table(
    'product_suppliers',
    Base.metadata,
    Column('product_id', Integer, ForeignKey('products.id'), primary_key=True),
    Column('supplier_id', Integer, ForeignKey('suppliers.id'), primary_key=True)
)


# =============================================================================
# Currency Rate Model
# =============================================================================

class CurrencyRate(Base):
    """Stores exchange rates for different currencies."""
    __tablename__ = "currency_rates"

    id = Column(Integer, primary_key=True, index=True)
    currency_code = Column(String(10), unique=True, nullable=False)
    currency_name = Column(String(50), nullable=False)
    rate_to_inr = Column(Float, nullable=False, default=1)
    updated_at = Column(DateTime, default=datetime.now)


# =============================================================================
# HSN Category Master Model (merged Category + HSN)
# =============================================================================

class HsnCategoryMaster(Base):
    """Unified master for HSN codes and categories.
    
    Fields:
        - hsn_code:  The HSN (Harmonized System of Nomenclature) code
        - category_name:  Human-readable category / description
        - custom_duty_percentage:  Basic Custom Duty %
        - gst_percentage:  GST %
    """
    __tablename__ = "hsn_category_master"

    id = Column(Integer, primary_key=True, index=True)
    hsn_code = Column(String(20), nullable=False)
    category_name = Column(String(150), unique=True, nullable=False)
    custom_duty_percentage = Column(Float, default=0)
    gst_percentage = Column(Float, default=18)
    created_at = Column(DateTime, default=datetime.now)

    # Relationships
    products = relationship("Product", back_populates="hsn_category_master")



# =============================================================================
# Category Model
# =============================================================================

class Category(Base):
    """Product categories (Alu E-Cap, Capacitors, etc.)"""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String(100), unique=True, nullable=False)
    freight_type = Column(String(20), default="sea")  # sea or air
    freight_percentage = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.now)

    # Relationships
    products = relationship("Product", back_populates="category")


# =============================================================================
# HSN Code Model
# =============================================================================

class HsnCode(Base):
    """HSN codes with basic custom duty percentages and category."""
    __tablename__ = "hsn_codes"

    id = Column(Integer, primary_key=True, index=True)
    hsn_code = Column(String(20), unique=True, nullable=False)
    description = Column(String(255))
    hsn_category = Column(String(100))  # Category for the HSN (e.g., ZZZ)
    basic_custom_duty_percentage = Column(Float, default=0)
    gst_percentage = Column(Float, default=18)  # GST % applicable for this HSN
    created_at = Column(DateTime, default=datetime.now)

    # Relationships
    products = relationship("Product", back_populates="hsn")


# =============================================================================
# Supplier Model
# =============================================================================

class Supplier(Base):
    """Multiple suppliers can supply the same product."""
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_code = Column(String(50), unique=True)
    supplier_name = Column(String(150), nullable=False)
    contact_person = Column(String(100))
    email = Column(String(100))
    phone = Column(String(50))
    address = Column(String(500))
    country = Column(String(50))
    currency_preference = Column(String(10), default="USD")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)

    # Relationships
    products = relationship(
        "Product",
        secondary=product_suppliers,
        back_populates="suppliers"
    )
    payments = relationship("PurchasePayment", back_populates="supplier")


# =============================================================================
# Product Model
# =============================================================================

class Product(Base):
    """Main products table with all pricing and calculation fields."""
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    part_code = Column(String(50), unique=True, nullable=False)
    description = Column(String(255), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"))
    pieces_per_unit = Column(Integer, default=1)
    packaging_quantity = Column(Integer, default=1)
    hsn_code_id = Column(Integer, ForeignKey("hsn_codes.id"))

    # NEW: Reference to unified HSN Category Master
    hsn_category_id = Column(Integer, ForeignKey("hsn_category_master.id"))

    # Pricing
    unit_price_usd = Column(Float, default=0)
    unit_price_rmb = Column(Float, default=0)
    unit_price_inr = Column(Float, default=0)
    primary_currency = Column(String(10), default="USD")
    solder_points = Column(Integer, default=2)

    # Duties & Taxes
    basic_custom_duty_percentage = Column(Float, default=0)
    freight_percentage = Column(Float, default=0)
    gst_percentage = Column(Float, default=18)

    # Calculated
    landed_price_inr = Column(Float, default=0)
    landed_price_usd = Column(Float, default=0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    category = relationship("Category", back_populates="products")
    hsn = relationship("HsnCode", back_populates="products")
    hsn_category_master = relationship("HsnCategoryMaster", back_populates="products")
    suppliers = relationship(
        "Supplier",
        secondary=product_suppliers,
        back_populates="products"
    )


# =============================================================================
# CKD Costing Model
# =============================================================================

class CKDCosting(Base):
    """CKD (Completely Knocked Down) Costing Table"""
    __tablename__ = "ckd_costing"

    id = Column(Integer, primary_key=True, index=True)

    # Product Info
    prod_code = Column(String(50), nullable=False)
    prod_name = Column(String(255), nullable=False)
    category = Column(String(100))

    # Pricing
    usd_price = Column(Float, default=0)
    solder_points = Column(Integer, default=2)
    rmb_price = Column(Float, default=0)

    # Rates
    rmb_rate = Column(Float, default=13.31)  # RMB to some base
    usd_rate = Column(Float, default=91.91)  # USD to INR

    # Calculated Values
    value = Column(Float, default=0)  # Base value
    rate_of_bcd = Column(Float, default=0)  # Basic Custom Duty rate
    with_bcd = Column(Float, default=0)  # Value with BCD
    freight_percentage = Column(Float, default=4)  # Freight %
    landed_price = Column(Float, default=0)  # Final landed price

    # BOM & Pricing
    count_of_bom = Column(Integer, default=0)  # Bill of Materials count
    dollar_price = Column(Float, default=0)  # $ Price

    # Supplier & Sale
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    supplier = relationship("Supplier")
    sale_percentage = Column(Float, default=18)  # Sale margin %
    selling_price = Column(Float, default=0)  # SP - Selling Price

    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


# =============================================================================
# Purchase Order Model
# =============================================================================

class PurchaseOrder(Base):
    """Purchase Order table for tracking product purchases."""
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    
    # Unique Purchase ID for tracking, reporting, and referencing
    purchase_id = Column(String(50), index=True, nullable=False)
    
    # Order Info
    order_number = Column(String(50), nullable=False)
    order_placed_by = Column(String(100), nullable=False)
    order_date = Column(DateTime, default=datetime.now)
    
    # Product Info (linked to products table)
    product_id = Column(Integer, ForeignKey("products.id"))
    part_code = Column(String(50))  # Stored for quick reference
    item_description = Column(String(255))
    hsn_code = Column(String(20))
    category_name = Column(String(100))
    
    # Supplier Info
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    supplier_name = Column(String(150))  # Stored for quick reference
    
    # Quantity
    quantity = Column(Integer, default=1)
    dispatched_quantity = Column(Integer, default=0)  # How much has been dispatched so far
    short_closed = Column(Boolean, default=False)  # Whether any qty was short-closed
    short_closed_quantity = Column(Integer, default=0)  # How many units were short-closed
    
    # Pricing - Support for all 3 currencies (reference prices)
    price_currency = Column(String(10), default="USD")  # Primary currency
    price_usd = Column(Float, default=0)
    price_inr = Column(Float, default=0)
    price_rmb = Column(Float, default=0)
    unit_price = Column(Float, default=0)  # Price in selected currency
    
    # Calculations
    subtotal = Column(Float, default=0)  # quantity * unit_price
    other_charges = Column(Float, default=0)
    total = Column(Float, default=0)  # subtotal + other_charges
    
    # GST
    gst_applicable = Column(Boolean, default=True)
    gst_percentage = Column(Float, default=18)
    gst_amount = Column(Float, default=0)
    
    # Final Total
    final_total = Column(Float, default=0)  # total + gst_amount
    
    # Delivery Info
    delivery_date = Column(DateTime, nullable=True)
    delivery_type = Column(String(50), default="sea")  # sea, air, courier, etc.
    
    # Status
    pi_status = Column(String(50), default="open")  # open, confirmed, shipped, delivered, cancelled
    
    # Notes
    remarks = Column(String(500))
    
    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    product = relationship("Product")
    supplier = relationship("Supplier")
    payments = relationship("PurchasePayment", back_populates="purchase_order")


# =============================================================================
# Model Hooks
# =============================================================================

@event.listens_for(PurchaseOrder, "before_insert")
def _purchase_order_before_insert(mapper, connection, target: PurchaseOrder):  # noqa: ARG001
    """
    Ensure identifiers exist for every purchase order.

    This makes purchase_id truly automatic across:
    - API inserts
    - SQLAdmin inserts
    - scripts/tests creating ORM objects directly
    """
    ids = None
    if not getattr(target, "purchase_id", None) or not str(target.purchase_id).strip():
        ids = ids or generate_missing_ids(connection)
        target.purchase_id = ids.purchase_id

    if not getattr(target, "order_number", None) or not str(target.order_number).strip():
        ids = ids or generate_missing_ids(connection)
        target.order_number = ids.order_number

    if not getattr(target, "order_date", None):
        target.order_date = datetime.now()

# =============================================================================
# Purchase Payment Model
# =============================================================================

class PurchasePayment(Base):
    """Tracks payments made to suppliers against purchase orders."""
    __tablename__ = "purchase_payments"

    id = Column(Integer, primary_key=True, index=True)
    
    # Links
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"), nullable=True)
    
    # Payment Details
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.now)
    payment_mode = Column(String(50))  # Bank Transfer, Check, Cash, etc.
    reference_number = Column(String(100))  # Transaction ID, Check No, etc.
    remarks = Column(String(500))
    
    # Metadata
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    supplier = relationship("Supplier", back_populates="payments")
    purchase_order = relationship("PurchaseOrder", back_populates="payments")


# =============================================================================
# Dispatch Models
# =============================================================================

class DispatchMaster(Base):
    """Dispatch header/master table for tracking shipments from suppliers."""
    __tablename__ = "dispatch_master"

    id = Column(Integer, primary_key=True, index=True)
    
    # Unique Dispatch ID for tracking
    dispatch_id = Column(String(50), unique=True, index=True, nullable=False)
    
    # Linked Purchase Order ID (reference)
    purchase_id = Column(String(50), index=True, nullable=False)
    
    # Dispatch Info
    dispatch_date = Column(DateTime, default=datetime.now)  # Auto-saved when created
    dispatched_by = Column(String(100), nullable=False)
    
    # Delivery Details
    delivery_type = Column(String(50), nullable=False)  # sea, air, courier, local
    consignment_type = Column(String(100), nullable=False)  # Full, Partial, etc.
    consignment_number = Column(String(100), nullable=False)
    consignment_saved_at = Column(DateTime, default=datetime.now)  # Exact datetime when saved
    expected_arrival_date = Column(DateTime, nullable=False)
    
    # Supplier Info
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    supplier_name = Column(String(150))
    
    # Currency
    currency = Column(String(10), default="USD")
    
    # Totals (calculated)
    total_quantity = Column(Integer, default=0)
    total_amount = Column(Float, default=0)
    
    # Status
    status = Column(String(50), default="dispatched")  # dispatched, in_transit, delivered, cancelled
    remarks = Column(String(500))
    
    # Metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    supplier = relationship("Supplier")
    items = relationship("DispatchItem", back_populates="dispatch", cascade="all, delete-orphan")


class DispatchItem(Base):
    """Individual items in a dispatch, linked to purchase orders."""
    __tablename__ = "dispatch_items"

    id = Column(Integer, primary_key=True, index=True)
    
    # Link to Dispatch Master
    dispatch_id = Column(Integer, ForeignKey("dispatch_master.id"), nullable=False)
    
    # Link to Purchase Order (item level)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id"))
    
    # Product Info (copied from PO for quick reference - NOT editable)
    part_code = Column(String(50))
    description = Column(String(255))
    hsn_code = Column(String(20))
    category_name = Column(String(100))
    
    # Supplier (NOT editable)
    supplier_name = Column(String(150))
    
    # Quantity (EDITABLE - but cannot exceed ordered quantity)
    ordered_quantity = Column(Integer, default=0)  # Original quantity from PO
    dispatch_quantity = Column(Integer, default=0)  # Actual dispatched quantity
    
    # Pricing (EDITABLE for dispatch adjustments)
    price_currency = Column(String(10), default="USD")
    original_price = Column(Float, default=0)  # Original price from PO
    dispatch_price = Column(Float, default=0)  # Adjusted price for this dispatch
    
    # Calculated
    total = Column(Float, default=0)  # dispatch_quantity * dispatch_price
    
    # Metadata
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    dispatch = relationship("DispatchMaster", back_populates="items")
    purchase_order = relationship("PurchaseOrder")


# =============================================================================
# Dispatch ID Generation Hook
# =============================================================================

@event.listens_for(DispatchMaster, "before_insert")
def _dispatch_master_before_insert(mapper, connection, target: DispatchMaster):  # noqa: ARG001
    """Generate unique dispatch ID if not provided."""
    if not getattr(target, "dispatch_id", None) or not str(target.dispatch_id).strip():
        # Generate dispatch ID based on current count
        result = connection.execute(
            text("SELECT COUNT(*) FROM dispatch_master")
        )
        count = result.scalar() or 0
        target.dispatch_id = f"DSP-{datetime.now().strftime('%Y%m')}-{count + 1:04d}"
    
    if not getattr(target, "dispatch_date", None):
        target.dispatch_date = datetime.now()
    
    if not getattr(target, "consignment_saved_at", None):
        target.consignment_saved_at = datetime.now()
