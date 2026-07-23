# -*- coding: utf-8 -*-
"""
One-shot migration: make Aina's SQLite the meal SSOT without losing the meals
that currently live only in Neon.

Steps:
  1. Add `ingredients_json` column to Aina meal_plans (structured chips).
  2. Copy every current Neon meal_plans row into Aina, keyed by (plan_date,
     meal_type), storing the ingredient array verbatim in ingredients_json and a
     human-readable `description`. Neon's ingredients already carry the correct
     type/test flags, so this round-trips losslessly.
  3. Structure the one legacy free-text Aina row (2026-07-01 게 테스트) so meal
     sync never has to parse free text.

After this runs, Aina SQLite ⊇ Neon meals and `scripts/sync_to_neon.py --meals`
can push Aina -> Neon safely.

Idempotent: re-running rewrites the same rows.
"""

import json
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sync_to_neon import load_conn_string, AINA_DB, FAMILY_DISCORD_ID, log  # noqa: E402

SLOT_TO_MEALTYPE = {"morning": "오전", "evening": "저녁"}


def describe(ingredients):
    parts = []
    for ing in ingredients:
        name = ing.get("name", "")
        amount = ing.get("amount")
        label = f"{name} {amount}" if amount else name
        if ing.get("test"):
            label += "(테스트)"
        parts.append(label)
    return ", ".join(parts)


def ensure_column(con):
    cols = [r[1] for r in con.execute("PRAGMA table_info(meal_plans)")]
    if "ingredients_json" not in cols:
        con.execute("ALTER TABLE meal_plans ADD COLUMN ingredients_json TEXT")
        log("migrate: added ingredients_json column to Aina meal_plans")
    else:
        log("migrate: ingredients_json column already present")


def upsert_aina_meal(con, plan_date, meal_type, ingredients, note):
    """Delete-then-insert by (plan_date, meal_type) to avoid duplicate rows."""
    ingredients_json = json.dumps(ingredients, ensure_ascii=False)
    description = describe(ingredients)
    if note and note not in description:
        description = f"{description}  · {note}" if description else note
    con.execute(
        "DELETE FROM meal_plans WHERE plan_date = ? AND meal_type = ?",
        (plan_date, meal_type),
    )
    con.execute(
        "INSERT INTO meal_plans (discord_id, plan_date, meal_type, description, "
        "ingredients_json, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))",
        (FAMILY_DISCORD_ID, plan_date, meal_type, description, ingredients_json),
    )


def main():
    conn_str = load_conn_string()
    if not conn_str:
        log("migrate: no DATABASE_URL — aborting")
        return 1
    import psycopg2

    neon = psycopg2.connect(conn_str, connect_timeout=10)
    try:
        with neon.cursor() as cur:
            cur.execute("SELECT date::text, slot, ingredients, note FROM meal_plans")
            neon_rows = cur.fetchall()
    finally:
        neon.close()
    log(f"migrate: read {len(neon_rows)} meal rows from Neon")

    con = sqlite3.connect(AINA_DB)
    try:
        ensure_column(con)

        # 2. backfill from Neon
        for date, slot, ingredients, note in neon_rows:
            meal_type = SLOT_TO_MEALTYPE.get(slot, slot)
            if isinstance(ingredients, str):
                ingredients = json.loads(ingredients)
            upsert_aina_meal(con, date, meal_type, ingredients, note)

        # 3. structure the legacy free-text row (게 테스트 3일차)
        legacy = con.execute(
            "SELECT id, plan_date, meal_type, description, ingredients_json "
            "FROM meal_plans WHERE ingredients_json IS NULL"
        ).fetchall()
        for row_id, plan_date, meal_type, desc, _ in legacy:
            if plan_date == "2026-07-01" and desc and "게" in desc:
                ing = [
                    {"name": "쌀죽", "amount": "80g", "type": "grain"},
                    {"name": "게", "amount": "20g", "type": "test", "test": True},
                ]
            else:
                # generic fallback: keep the text as a single etc chip
                ing = [{"name": (desc or "식단")[:40], "type": "etc"}]
            con.execute(
                "UPDATE meal_plans SET ingredients_json = ? WHERE id = ?",
                (json.dumps(ing, ensure_ascii=False), row_id),
            )
            log(f"migrate: structured legacy row {plan_date} {meal_type}")

        con.commit()
        total = con.execute("SELECT COUNT(*) FROM meal_plans").fetchone()[0]
        structured = con.execute(
            "SELECT COUNT(*) FROM meal_plans WHERE ingredients_json IS NOT NULL"
        ).fetchone()[0]
        log(f"migrate: done — Aina meal_plans now {total} rows, {structured} structured")
    finally:
        con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
