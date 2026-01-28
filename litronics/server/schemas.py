"""
Litronics Product Management System - Pydantic Schemas
Request/Response data validation models
"""

from typing import Optional, List
from pydantic import BaseModel


# =============================================================================
# Product Schemas
# =============================================================================

class ProductCreate(BaseModel):
    """Schema for creating a new product."""
    part_code: str
    description: str
    category_id: Optional[int] = None
    pieces_per_unit: Optional[int] = 1
    packaging_quantity: Optional[int] = 1
    hsn_code_id: Optional[int] = None
    unit_price_usd: Optional[float] = 0
    unit_price_rmb: Optional[float] = 0
    unit_price_inr: Optional[float] = 0
    primary_currency: Optional[str] = "USD"
    basic_custom_duty_percentage: Optional[float] = 0
    freight_percentage: Optional[float] = 0
    gst_percentage: Optional[float] = 18
    supplier_ids: Optional[List[int]] = []


# =============================================================================
# Purchase Order Schemas
# =============================================================================

class PurchaseOrderCreate(BaseModel):
    """Schema for creating a new purchase order."""
    order_placed_by: str
    product_id: Optional[int] = None
    part_code: Optional[str] = None
    item_description: Optional[str] = None
    hsn_code: Optional[str] = None
    category_name: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    quantity: Optional[int] = 1
    price_currency: Optional[str] = "USD"
    price_usd: Optional[float] = 0
    price_inr: Optional[float] = 0
    price_rmb: Optional[float] = 0
    unit_price: Optional[float] = 0
    other_charges: Optional[float] = 0
    gst_applicable: Optional[bool] = True
    gst_percentage: Optional[float] = 18
    delivery_date: Optional[str] = None  # ISO date string
    delivery_type: Optional[str] = "sea"
    remarks: Optional[str] = None


class PurchaseOrderUpdate(BaseModel):
    """Schema for updating a purchase order."""
    order_placed_by: Optional[str] = None
    quantity: Optional[int] = None
    price_currency: Optional[str] = None
    unit_price: Optional[float] = None
    other_charges: Optional[float] = None
    gst_applicable: Optional[bool] = None
    gst_percentage: Optional[float] = None
    delivery_date: Optional[str] = None
    delivery_type: Optional[str] = None
    pi_status: Optional[str] = None
    remarks: Optional[str] = None


# =============================================================================
# Payment Schemas
# =============================================================================

class PurchasePaymentCreate(BaseModel):
    """Schema for creating a new payment."""
    supplier_id: int
    purchase_order_id: Optional[int] = None
    amount: float
    payment_date: Optional[str] = None  # ISO date string
    payment_mode: Optional[str] = "Bank Transfer"
    reference_number: Optional[str] = None
    remarks: Optional[str] = None
