"""
Litronics Product Management System - FastAPI Backend
Main application entry point

Using SQLAlchemy + SQLite + SQLAdmin
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqladmin import Admin

from database import engine, Base
from models import (
    CurrencyRate,
    Category,
    HsnCode,
    Supplier,
    Product,
    CKDCosting,
    HsnCategoryMaster,
)
from routes import router
from admin import (
    ProductAdmin,
    CategoryAdmin,
    SupplierAdmin,
    HsnCodeAdmin,
    CurrencyRateAdmin,
    CKDCostingAdmin,
    PurchaseOrderAdmin,
    PurchasePaymentAdmin,
    HsnCategoryMasterAdmin,
)
from seed import seed_data
from purchase_migrations import ensure_purchase_schema


# =============================================================================
# Create Database Tables
# =============================================================================

Base.metadata.create_all(bind=engine)


# =============================================================================
# FastAPI Application Setup
# =============================================================================

app = FastAPI(
    title="Litronics API",
    version="1.0.0",
    description="Litronics Product Management System API"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# SQLAdmin Setup - Admin Panel at /admin
# =============================================================================

admin = Admin(app, engine, title="Litronics Admin")

admin.add_view(ProductAdmin)
admin.add_view(CategoryAdmin)
admin.add_view(SupplierAdmin)
admin.add_view(HsnCodeAdmin)
admin.add_view(CurrencyRateAdmin)
admin.add_view(CKDCostingAdmin)
admin.add_view(PurchaseOrderAdmin)
admin.add_view(PurchasePaymentAdmin)
admin.add_view(HsnCategoryMasterAdmin)


# =============================================================================
# Include API Routes
# =============================================================================

app.include_router(router)


# =============================================================================
# Startup Event - Seed Default Data
# =============================================================================

@app.on_event("startup")
def startup():
    """Initialize database with default data on application startup."""
    # Keep older SQLite databases compatible with current Purchase module.
    ensure_purchase_schema()
    seed_data()


# =============================================================================
# Static Files & Index Route
# =============================================================================

app.mount("/static", StaticFiles(directory="../public"), name="static")


@app.get("/")
def serve_index():
    """Serve the main frontend HTML file."""
    return FileResponse("../public/index.html")


# =============================================================================
# Entry Point
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
