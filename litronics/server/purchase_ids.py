"""
Purchase ID / Order Number generation utilities.

Goals:
- Generate stable, human-readable identifiers (purchase_id + order_number)
- Work for API routes, SQLAdmin, and scripts (via connection/session)
- Keep the format backward compatible with existing data:
  - purchase_id: PUR-YYYYMMDD-0001
  - order_number: POYYYYMMDD-0001
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from sqlalchemy import text
from sqlalchemy.engine import Connection


@dataclass(frozen=True)
class GeneratedIds:
    purchase_id: str
    order_number: str


def _get_last_id_for_prefix(
    connection: Connection, table: str, column: str, like_prefix: str
) -> Optional[str]:
    """
    Return the last (lexicographically greatest) id for a given prefix.
    With zero-padded numeric suffixes this corresponds to the max sequence.
    """
    stmt = text(
        f"""
        SELECT {column}
        FROM {table}
        WHERE {column} LIKE :like_prefix
        ORDER BY {column} DESC
        LIMIT 1
        """
    )
    row = connection.execute(stmt, {"like_prefix": f"{like_prefix}%"}).fetchone()
    return row[0] if row and row[0] else None


def _next_sequence_number(last_value: Optional[str]) -> int:
    if not last_value:
        return 1
    # Expected: <PREFIX>-0001 or POYYYYMMDD-0001
    # Take the last dash chunk and parse int.
    try:
        suffix = str(last_value).split("-")[-1]
        return int(suffix) + 1
    except Exception:
        return 1


def generate_purchase_id(connection: Connection, now: Optional[datetime] = None) -> str:
    """Generate a purchase_id in the format PUR-YYYYMMDD-0001."""
    now = now or datetime.now()
    prefix = f"PUR-{now.strftime('%Y%m%d')}-"
    last = _get_last_id_for_prefix(connection, "purchase_orders", "purchase_id", prefix)
    seq = _next_sequence_number(last)
    return f"{prefix}{seq:04d}"


def generate_order_number(connection: Connection, now: Optional[datetime] = None) -> str:
    """Generate an order_number in the format POYYYYMMDD-0001."""
    now = now or datetime.now()
    prefix = f"PO{now.strftime('%Y%m%d')}-"
    last = _get_last_id_for_prefix(connection, "purchase_orders", "order_number", prefix)
    seq = _next_sequence_number(last)
    return f"{prefix}{seq:04d}"


def generate_missing_ids(connection: Connection, now: Optional[datetime] = None) -> GeneratedIds:
    """Convenience helper used by model hooks/routes."""
    now = now or datetime.now()
    return GeneratedIds(
        purchase_id=generate_purchase_id(connection, now=now),
        order_number=generate_order_number(connection, now=now),
    )

