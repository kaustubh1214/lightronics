"""
Litronics Product Management System - SQLAdmin Configuration
Admin panel views and configuration
"""

from sqladmin import ModelView

from models import (
    Product,
    Category,
    Supplier,
    HsnCode,
    CurrencyRate,
    CKDCosting,
    PurchaseOrder,
)


# =============================================================================
# Product Admin View
# =============================================================================

class ProductAdmin(ModelView, model=Product):
    """Admin view for Product model."""
    column_list = [
        Product.id,
        Product.part_code,
        Product.description,
        Product.unit_price_usd,
        Product.landed_price_inr,
        Product.is_active,
    ]
    column_searchable_list = [Product.part_code, Product.description]
    column_sortable_list = [Product.id, Product.part_code, Product.landed_price_inr]
    form_columns = [
        Product.part_code,
        Product.description,
        Product.category,
        Product.pieces_per_unit,
        Product.packaging_quantity,
        Product.hsn,
        Product.unit_price_usd,
        Product.unit_price_rmb,
        Product.unit_price_inr,
        Product.primary_currency,
        Product.basic_custom_duty_percentage,
        Product.freight_percentage,
        Product.gst_percentage,
        Product.suppliers,
        Product.is_active,
    ]


# =============================================================================
# Category Admin View
# =============================================================================

class CategoryAdmin(ModelView, model=Category):
    """Admin view for Category model."""
    column_list = [
        Category.id,
        Category.category_name,
        Category.freight_type,
        Category.freight_percentage,
    ]
    form_columns = [
        Category.category_name,
        Category.freight_type,
        Category.freight_percentage,
    ]


# =============================================================================
# Supplier Admin View
# =============================================================================

class SupplierAdmin(ModelView, model=Supplier):
    """Admin view for Supplier model."""
    column_list = [
        Supplier.id,
        Supplier.supplier_code,
        Supplier.supplier_name,
        Supplier.country,
        Supplier.is_active,
    ]
    column_searchable_list = [Supplier.supplier_name, Supplier.supplier_code]
    form_columns = [
        Supplier.supplier_code,
        Supplier.supplier_name,
        Supplier.contact_person,
        Supplier.email,
        Supplier.phone,
        Supplier.country,
        Supplier.currency_preference,
        Supplier.is_active,
    ]


# =============================================================================
# HSN Code Admin View
# =============================================================================

class HsnCodeAdmin(ModelView, model=HsnCode):
    """Admin view for HsnCode model."""
    column_list = [
        HsnCode.id,
        HsnCode.hsn_code,
        HsnCode.description,
        HsnCode.hsn_category,
        HsnCode.basic_custom_duty_percentage,
        HsnCode.gst_percentage,
    ]
    form_columns = [
        HsnCode.hsn_code,
        HsnCode.description,
        HsnCode.hsn_category,
        HsnCode.basic_custom_duty_percentage,
        HsnCode.gst_percentage,
    ]


# =============================================================================
# Currency Rate Admin View
# =============================================================================

class CurrencyRateAdmin(ModelView, model=CurrencyRate):
    """Admin view for CurrencyRate model."""
    column_list = [
        CurrencyRate.id,
        CurrencyRate.currency_code,
        CurrencyRate.currency_name,
        CurrencyRate.rate_to_inr,
    ]
    form_columns = [
        CurrencyRate.currency_code,
        CurrencyRate.currency_name,
        CurrencyRate.rate_to_inr,
    ]


# =============================================================================
# CKD Costing Admin View
# =============================================================================

class CKDCostingAdmin(ModelView, model=CKDCosting):
    """Admin view for CKDCosting model."""
    column_list = [
        CKDCosting.prod_code,
        CKDCosting.prod_name,
        CKDCosting.category,
        CKDCosting.landed_price,
        CKDCosting.selling_price,
    ]
    column_searchable_list = [CKDCosting.prod_code, CKDCosting.prod_name]
    column_sortable_list = [CKDCosting.id, CKDCosting.prod_code, CKDCosting.landed_price]
    form_columns = [
        CKDCosting.prod_code,
        CKDCosting.prod_name,
        CKDCosting.category,
        CKDCosting.usd_price,
        CKDCosting.solder_points,
        CKDCosting.rmb_price,
        CKDCosting.rmb_rate,
        CKDCosting.usd_rate,
        CKDCosting.value,
        CKDCosting.rate_of_bcd,
        CKDCosting.with_bcd,
        CKDCosting.freight_percentage,
        CKDCosting.landed_price,
        CKDCosting.count_of_bom,
        CKDCosting.dollar_price,
        CKDCosting.supplier,
        CKDCosting.sale_percentage,
        CKDCosting.selling_price,
        CKDCosting.is_active,
    ]


# =============================================================================
# Purchase Order Admin View
# =============================================================================

class PurchaseOrderAdmin(ModelView, model=PurchaseOrder):
    """Admin view for PurchaseOrder model."""
    name = "Purchase Order"
    name_plural = "Purchase Orders"
    icon = "fa-solid fa-cart-shopping"
    
    column_list = [
        PurchaseOrder.id,
        PurchaseOrder.order_number,
        PurchaseOrder.order_placed_by,
        PurchaseOrder.part_code,
        PurchaseOrder.supplier_name,
        PurchaseOrder.quantity,
        PurchaseOrder.final_total,
        PurchaseOrder.pi_status,
        PurchaseOrder.delivery_date,
    ]
    column_searchable_list = [
        PurchaseOrder.order_number,
        PurchaseOrder.part_code,
        PurchaseOrder.order_placed_by,
    ]
    column_sortable_list = [
        PurchaseOrder.id,
        PurchaseOrder.order_number,
        PurchaseOrder.order_date,
        PurchaseOrder.final_total,
    ]
    column_default_sort = [(PurchaseOrder.created_at, True)]  # Newest first
    form_columns = [
        PurchaseOrder.order_number,
        PurchaseOrder.order_placed_by,
        PurchaseOrder.product,
        PurchaseOrder.part_code,
        PurchaseOrder.item_description,
        PurchaseOrder.hsn_code,
        PurchaseOrder.category_name,
        PurchaseOrder.supplier,
        PurchaseOrder.supplier_name,
        PurchaseOrder.quantity,
        PurchaseOrder.price_currency,
        PurchaseOrder.price_usd,
        PurchaseOrder.price_inr,
        PurchaseOrder.price_rmb,
        PurchaseOrder.unit_price,
        PurchaseOrder.subtotal,
        PurchaseOrder.other_charges,
        PurchaseOrder.total,
        PurchaseOrder.gst_applicable,
        PurchaseOrder.gst_percentage,
        PurchaseOrder.gst_amount,
        PurchaseOrder.final_total,
        PurchaseOrder.delivery_date,
        PurchaseOrder.delivery_type,
        PurchaseOrder.pi_status,
        PurchaseOrder.remarks,
        PurchaseOrder.is_active,
    ]
