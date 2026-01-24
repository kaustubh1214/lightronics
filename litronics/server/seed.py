"""
Litronics Product Management System - Database Seeding
Default data initialization
"""

from database import SessionLocal
from models import CurrencyRate, Category, HsnCode, Supplier


def seed_data():
    """Seed default data into the database."""
    db = SessionLocal()

    try:
        # Seed Currency Rates
        if db.query(CurrencyRate).count() == 0:
            db.add_all([
                CurrencyRate(
                    currency_code="USD",
                    currency_name="US Dollar",
                    rate_to_inr=83.50
                ),
                CurrencyRate(
                    currency_code="RMB",
                    currency_name="Chinese Yuan",
                    rate_to_inr=11.50
                ),
                CurrencyRate(
                    currency_code="INR",
                    currency_name="Indian Rupee",
                    rate_to_inr=1.00
                ),
            ])

        # Seed Categories
        if db.query(Category).count() == 0:
            db.add_all([
                Category(
                    category_name="Alu E-Cap - 3k hrs",
                    freight_type="sea",
                    freight_percentage=4
                ),
                Category(
                    category_name="Alu E-Cap - 6-8k hrs",
                    freight_type="sea",
                    freight_percentage=4
                ),
                Category(
                    category_name="Capacitors",
                    freight_type="sea",
                    freight_percentage=3.5
                ),
                Category(
                    category_name="Resistors",
                    freight_type="air",
                    freight_percentage=2
                ),
                Category(
                    category_name="ICs",
                    freight_type="air",
                    freight_percentage=5
                ),
            ])

        # Seed HSN Codes
        if db.query(HsnCode).count() == 0:
            db.add_all([
                HsnCode(
                    hsn_code="85322500",
                    description="Aluminum Electrolytic Capacitors",
                    hsn_category="Capacitors",
                    basic_custom_duty_percentage=7.5,
                    gst_percentage=18
                ),
                HsnCode(
                    hsn_code="85322400",
                    description="Ceramic Capacitors",
                    hsn_category="Capacitors",
                    basic_custom_duty_percentage=7.5,
                    gst_percentage=18
                ),
                HsnCode(
                    hsn_code="85423100",
                    description="Processors and Controllers",
                    hsn_category="ICs",
                    basic_custom_duty_percentage=0,
                    gst_percentage=18
                ),
                HsnCode(
                    hsn_code="85411000",
                    description="Diodes",
                    hsn_category="Diodes",
                    basic_custom_duty_percentage=0,
                    gst_percentage=18
                ),
                HsnCode(
                    hsn_code="94059900",
                    description="LED Bulbs and Lighting",
                    hsn_category="ZZZ",
                    basic_custom_duty_percentage=10,
                    gst_percentage=18
                ),
            ])

        # Seed Suppliers
        if db.query(Supplier).count() == 0:
            db.add_all([
                Supplier(
                    supplier_code="AXB001",
                    supplier_name="Axboom",
                    country="China",
                    currency_preference="RMB"
                ),
                Supplier(
                    supplier_code="ENF001",
                    supplier_name="Enfalion",
                    country="China",
                    currency_preference="RMB"
                ),
            ])

        db.commit()
        print("[OK] Default data seeded successfully")

    except Exception as e:
        print(f"Seed error: {e}")
        db.rollback()

    finally:
        db.close()
