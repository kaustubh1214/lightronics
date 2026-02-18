"""
Lightweight SQLite schema checks/migrations for Purchase module.

Why:
- SQLAlchemy create_all() won't ALTER existing tables.
- Existing installations may have purchase_orders without purchase_id.
- We need to keep the backend working without requiring manual migration steps.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Iterable, Tuple

from sqlalchemy import text

from database import engine


def _table_exists(conn, table_name: str) -> bool:
    row = conn.execute(
        text("SELECT name FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    ).fetchone()
    return bool(row)


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info('{table_name}')")).fetchall()
    return any(r[1] == column_name for r in rows)  # r[1] = name


def _fetch_orders_missing_purchase_id(conn) -> Iterable[Tuple[int, str]]:
    """
    Returns (id, order_date) for rows needing backfill.
    order_date may be NULL or string depending on how it was inserted historically.
    """
    return conn.execute(
        text(
            """
            SELECT id, order_date
            FROM purchase_orders
            WHERE purchase_id IS NULL OR purchase_id = ''
            ORDER BY id
            """
        )
    ).fetchall()


def ensure_purchase_schema() -> None:
    """
    Ensure the Purchase module schema is compatible with current code.

    Safe to run multiple times.
    """
    with engine.begin() as conn:
        if not _table_exists(conn, "purchase_orders"):
            # Fresh DBs will have the correct schema via create_all()
            return

        if not _column_exists(conn, "purchase_orders", "purchase_id"):
            # SQLite can't add NOT NULL during ALTER TABLE; we backfill immediately.
            conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN purchase_id VARCHAR(50)"))

        # Backfill missing purchase_id values.
        records = list(_fetch_orders_missing_purchase_id(conn))
        if records:
            date_counters = defaultdict(int)
            for row_id, order_date in records:
                # Best-effort parse of order_date (stored as str or datetime).
                date_str = datetime.now().strftime("%Y%m%d")
                if order_date:
                    if isinstance(order_date, str):
                        try:
                            parsed = datetime.fromisoformat(order_date.replace("Z", "+00:00"))
                            date_str = parsed.strftime("%Y%m%d")
                        except Exception:
                            pass
                    elif hasattr(order_date, "strftime"):
                        date_str = order_date.strftime("%Y%m%d")

                date_counters[date_str] += 1
                purchase_id = f"PUR-{date_str}-{date_counters[date_str]:04d}"
                conn.execute(
                    text("UPDATE purchase_orders SET purchase_id = :purchase_id WHERE id = :id"),
                    {"purchase_id": purchase_id, "id": row_id},
                )

        # Ensure dispatched_quantity and short_closed columns exist
        if not _column_exists(conn, "purchase_orders", "dispatched_quantity"):
            conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN dispatched_quantity INTEGER DEFAULT 0"))

        if not _column_exists(conn, "purchase_orders", "short_closed"):
            conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN short_closed BOOLEAN DEFAULT 0"))

        if not _column_exists(conn, "purchase_orders", "short_closed_quantity"):
            conn.execute(text("ALTER TABLE purchase_orders ADD COLUMN short_closed_quantity INTEGER DEFAULT 0"))

        # Enforce uniqueness via index (works even if the column wasn't declared UNIQUE).
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_purchase_orders_purchase_id
                ON purchase_orders(purchase_id)
                """
            )
        )

