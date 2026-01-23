"""
Litronics Product Management System - FastAPI Backend
Using SQLAlchemy + SQLite + SQLAdmin
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqladmin import Admin, ModelView
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime  
import os

# Database Setup - SQLite (no installation needed!)
DATABASE_URL = "sqlite:///./litronics.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# =====================================================
# SQLAlchemy Models
# =====================================================

# Many-to-Many: Products <-> Suppliers
product_suppliers = Table(
    'product_suppliers', Base.metadata,
    Column('product_id', Integer, ForeignKey('products.id'), primary_key=True),
    Column('supplier_id', Integer, ForeignKey('suppliers.id'), primary_key=True)
)

class CurrencyRate(Base):
    __tablename__ = "currency_rates"
    id = Column(Integer, primary_key=True, index=True)
    currency_code = Column(String(10), unique=True, nullable=False)
    currency_name = Column(String(50), nullable=False)
    rate_to_inr = Column(Float, nullable=False, default=1)
    updated_at = Column(DateTime, default=datetime.now)

class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    category_name = Column(String(100), unique=True, nullable=False)
    freight_type = Column(String(20), default="sea")  # sea or air
    freight_percentage = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.now)
    products = relationship("Product", back_populates="category")

class HsnCode(Base):
    __tablename__ = "hsn_codes"
    id = Column(Integer, primary_key=True, index=True)
    hsn_code = Column(String(20), unique=True, nullable=False)
    description = Column(String(255))
    hsn_category = Column(String(100))  # Category for the HSN (e.g., ZZZ)
    basic_custom_duty_percentage = Column(Float, default=0)
    gst_percentage = Column(Float, default=18)  # GST % applicable for this HSN
    created_at = Column(DateTime, default=datetime.now)
    products = relationship("Product", back_populates="hsn")

class Supplier(Base):
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
    products = relationship("Product", secondary=product_suppliers, back_populates="suppliers")

class Product(Base):
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
    suppliers = relationship("Supplier", secondary=product_suppliers, back_populates="products")

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

# Create all tables
Base.metadata.create_all(bind=engine)

# =====================================================
# FastAPI App
# =====================================================

app = FastAPI(title="Litronics API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =====================================================
# SQLAdmin Setup - Admin Panel at /admin
# =====================================================

admin = Admin(app, engine, title="Litronics Admin")

class ProductAdmin(ModelView, model=Product):
    column_list = [Product.id, Product.part_code, Product.description, Product.unit_price_usd, 
                   Product.landed_price_inr, Product.is_active]
    column_searchable_list = [Product.part_code, Product.description]
    column_sortable_list = [Product.id, Product.part_code, Product.landed_price_inr]
    form_columns = [Product.part_code, Product.description, Product.category, Product.pieces_per_unit,
                    Product.packaging_quantity, Product.hsn, Product.unit_price_usd, Product.unit_price_rmb,
                    Product.unit_price_inr, Product.primary_currency, Product.basic_custom_duty_percentage,
                    Product.freight_percentage, Product.gst_percentage, Product.suppliers, Product.is_active]

class CategoryAdmin(ModelView, model=Category):
    column_list = [Category.id, Category.category_name, Category.freight_type, Category.freight_percentage]
    form_columns = [Category.category_name, Category.freight_type, Category.freight_percentage]

class SupplierAdmin(ModelView, model=Supplier):
    column_list = [Supplier.id, Supplier.supplier_code, Supplier.supplier_name, Supplier.country, Supplier.is_active]
    column_searchable_list = [Supplier.supplier_name, Supplier.supplier_code]
    form_columns = [Supplier.supplier_code, Supplier.supplier_name, Supplier.contact_person, 
                    Supplier.email, Supplier.phone, Supplier.country, Supplier.currency_preference, Supplier.is_active]

class HsnCodeAdmin(ModelView, model=HsnCode):
    column_list = [HsnCode.id, HsnCode.hsn_code, HsnCode.description, HsnCode.hsn_category, HsnCode.basic_custom_duty_percentage, HsnCode.gst_percentage]
    form_columns = [HsnCode.hsn_code, HsnCode.description, HsnCode.hsn_category, HsnCode.basic_custom_duty_percentage, HsnCode.gst_percentage]

class CurrencyRateAdmin(ModelView, model=CurrencyRate):
    column_list = [CurrencyRate.id, CurrencyRate.currency_code, CurrencyRate.currency_name, CurrencyRate.rate_to_inr]
    form_columns = [CurrencyRate.currency_code, CurrencyRate.currency_name, CurrencyRate.rate_to_inr]

class CKDCostingAdmin(ModelView, model=CKDCosting):
    column_list = [CKDCosting.prod_code, CKDCosting.prod_name, CKDCosting.category, CKDCosting.landed_price, CKDCosting.selling_price]
    column_searchable_list = [CKDCosting.prod_code, CKDCosting.prod_name]
    column_sortable_list = [CKDCosting.id, CKDCosting.prod_code, CKDCosting.landed_price]
    form_columns = [CKDCosting.prod_code, CKDCosting.prod_name, CKDCosting.category, 
                    CKDCosting.usd_price, CKDCosting.solder_points, CKDCosting.rmb_price,
                    CKDCosting.rmb_rate, CKDCosting.usd_rate, CKDCosting.value,
                    CKDCosting.rate_of_bcd, CKDCosting.with_bcd, CKDCosting.freight_percentage,
                    CKDCosting.landed_price, CKDCosting.count_of_bom, CKDCosting.dollar_price,
                    CKDCosting.supplier, CKDCosting.sale_percentage, CKDCosting.selling_price,
                    CKDCosting.is_active]

admin.add_view(ProductAdmin)
admin.add_view(CategoryAdmin)
admin.add_view(SupplierAdmin)
admin.add_view(HsnCodeAdmin)
admin.add_view(CurrencyRateAdmin)
admin.add_view(CKDCostingAdmin)

# =====================================================
# Database Dependency
# =====================================================

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# =====================================================
# Seed Default Data
# =====================================================

def seed_data():
    db = SessionLocal()
    try:
        # Check if data exists
        if db.query(CurrencyRate).count() == 0:
            db.add_all([
                CurrencyRate(currency_code="USD", currency_name="US Dollar", rate_to_inr=83.50),
                CurrencyRate(currency_code="RMB", currency_name="Chinese Yuan", rate_to_inr=11.50),
                CurrencyRate(currency_code="INR", currency_name="Indian Rupee", rate_to_inr=1.00),
            ])
        
        if db.query(Category).count() == 0:
            db.add_all([
                Category(category_name="Alu E-Cap - 3k hrs", freight_type="sea", freight_percentage=4),
                Category(category_name="Alu E-Cap - 6-8k hrs", freight_type="sea", freight_percentage=4),
                Category(category_name="Capacitors", freight_type="sea", freight_percentage=3.5),
                Category(category_name="Resistors", freight_type="air", freight_percentage=2),
                Category(category_name="ICs", freight_type="air", freight_percentage=5),
            ])
        
        if db.query(HsnCode).count() == 0:
            db.add_all([
                HsnCode(hsn_code="85322500", description="Aluminum Electrolytic Capacitors", hsn_category="Capacitors", basic_custom_duty_percentage=7.5, gst_percentage=18),
                HsnCode(hsn_code="85322400", description="Ceramic Capacitors", hsn_category="Capacitors", basic_custom_duty_percentage=7.5, gst_percentage=18),
                HsnCode(hsn_code="85423100", description="Processors and Controllers", hsn_category="ICs", basic_custom_duty_percentage=0, gst_percentage=18),
                HsnCode(hsn_code="85411000", description="Diodes", hsn_category="Diodes", basic_custom_duty_percentage=0, gst_percentage=18),
                HsnCode(hsn_code="94059900", description="LED Bulbs and Lighting", hsn_category="ZZZ", basic_custom_duty_percentage=10, gst_percentage=18),
            ])
        
        if db.query(Supplier).count() == 0:
            db.add_all([
                Supplier(supplier_code="AXB001", supplier_name="Axboom", country="China", currency_preference="RMB"),
                Supplier(supplier_code="ENF001", supplier_name="Enfalion", country="China", currency_preference="RMB"),
            ])
        
        db.commit()
        print("✅ Default data seeded successfully")
    except Exception as e:
        print(f"Seed error: {e}")
    finally:
        db.close()

# Seed on startup
@app.on_event("startup")
def startup():
    seed_data()

# =====================================================
# Pydantic Models
# =====================================================

class ProductCreate(BaseModel):
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

# =====================================================
# API Routes
# =====================================================

@app.get("/api/products")
def get_products(db: Session = Depends(get_db)):
    products = db.query(Product).filter(Product.is_active == True).all()
    result = []
    for p in products:
        result.append({
            "id": p.id, "part_code": p.part_code, "description": p.description,
            "category_name": p.category.category_name if p.category else None,
            "hsn_code": p.hsn.hsn_code if p.hsn else None,
            "unit_price_usd": p.unit_price_usd, "unit_price_rmb": p.unit_price_rmb,
            "basic_custom_duty_percentage": p.basic_custom_duty_percentage,
            "freight_percentage": p.freight_percentage, "gst_percentage": p.gst_percentage,
            "landed_price_inr": p.landed_price_inr
        })
    return {"success": True, "data": result}

@app.post("/api/products")
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    # Get currency rate
    rate = db.query(CurrencyRate).filter(CurrencyRate.currency_code == product.primary_currency).first()
    rate_to_inr = rate.rate_to_inr if rate else 83.50
    
    # Calculate landed price
    if product.primary_currency == "USD":
        base_price = product.unit_price_usd * rate_to_inr
    elif product.primary_currency == "RMB":
        base_price = product.unit_price_rmb * rate_to_inr
    else:
        base_price = product.unit_price_inr
    
    bcd = base_price * (product.basic_custom_duty_percentage / 100)
    freight = base_price * (product.freight_percentage / 100)
    subtotal = base_price + bcd + freight
    gst = subtotal * (product.gst_percentage / 100)
    landed_price_inr = subtotal + gst
    
    # Create product
    db_product = Product(
        part_code=product.part_code, description=product.description,
        category_id=product.category_id, pieces_per_unit=product.pieces_per_unit,
        packaging_quantity=product.packaging_quantity, hsn_code_id=product.hsn_code_id,
        unit_price_usd=product.unit_price_usd, unit_price_rmb=product.unit_price_rmb,
        unit_price_inr=product.unit_price_inr, primary_currency=product.primary_currency,
        basic_custom_duty_percentage=product.basic_custom_duty_percentage,
        freight_percentage=product.freight_percentage, gst_percentage=product.gst_percentage,
        landed_price_inr=landed_price_inr, landed_price_usd=landed_price_inr / rate_to_inr
    )
    
    # Link suppliers
    if product.supplier_ids:
        suppliers = db.query(Supplier).filter(Supplier.id.in_(product.supplier_ids)).all()
        db_product.suppliers = suppliers
    
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return {"success": True, "id": db_product.id, "message": "Product created"}

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if product:
        product.is_active = False
        db.commit()
    return {"success": True, "message": "Product deleted"}

@app.get("/api/categories")
def get_categories(db: Session = Depends(get_db)):
    cats = db.query(Category).all()
    return {"success": True, "data": [{"id": c.id, "category_name": c.category_name, "freight_percentage": c.freight_percentage} for c in cats]}

@app.get("/api/suppliers")
def get_suppliers(db: Session = Depends(get_db)):
    sups = db.query(Supplier).filter(Supplier.is_active == True).all()
    return {"success": True, "data": [{"id": s.id, "supplier_name": s.supplier_name} for s in sups]}

@app.get("/api/hsn-codes")
def get_hsn_codes(db: Session = Depends(get_db)):
    hsns = db.query(HsnCode).all()
    return {"success": True, "data": [{
        "id": h.id, 
        "hsn_code": h.hsn_code, 
        "description": h.description, 
        "hsn_category": h.hsn_category,
        "basic_custom_duty_percentage": h.basic_custom_duty_percentage,
        "gst_percentage": h.gst_percentage
    } for h in hsns]}

@app.get("/api/hsn-codes/{hsn_id}")
def get_hsn_by_id(hsn_id: int, db: Session = Depends(get_db)):
    """Get HSN details by ID"""
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
            "gst_percentage": hsn.gst_percentage
        }
    }

@app.post("/api/hsn-codes")
def create_hsn_code(hsn: dict, db: Session = Depends(get_db)):
    """Create a new HSN code"""
    # Check if exists
    existing = db.query(HsnCode).filter(HsnCode.hsn_code == hsn.get("hsn_code")).first()
    if existing:
        raise HTTPException(status_code=400, detail="HSN Code already exists")
    
    new_hsn = HsnCode(
        hsn_code=hsn.get("hsn_code"),
        description=hsn.get("description"),
        hsn_category=hsn.get("hsn_category"),
        basic_custom_duty_percentage=float(hsn.get("basic_custom_duty_percentage", 0)),
        gst_percentage=float(hsn.get("gst_percentage", 18))
    )
    
    db.add(new_hsn)
    db.commit()
    db.refresh(new_hsn)
    
    return {"success": True, "id": new_hsn.id, "message": "HSN Code created successfully"}

@app.get("/api/products/by-part-code/{part_code}")
def get_product_by_part_code(part_code: str, db: Session = Depends(get_db)):
    """Get product details including HSN data by part code"""
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
            "gst_percentage": product.hsn.gst_percentage
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
            "hsn": hsn_data
        }
    }

@app.get("/api/currency-rates")
def get_currency_rates(db: Session = Depends(get_db)):
    rates = db.query(CurrencyRate).all()
    return {"success": True, "data": [{"currency_code": r.currency_code, "rate_to_inr": r.rate_to_inr} for r in rates]}

# Serve static files
app.mount("/static", StaticFiles(directory="../public"), name="static")

@app.get("/")
def serve_index():
    return FileResponse("../public/index.html")

@app.get("/api/health")
def health():
    return {"status": "OK"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
