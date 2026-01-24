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
)
from sqlalchemy.orm import relationship

from database import Base


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
    
    # Order Info
    order_number = Column(String(50), unique=True, nullable=False)
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

