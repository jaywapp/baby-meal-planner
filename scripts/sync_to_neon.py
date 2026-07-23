# -*- coding: utf-8 -*-
"""
Aina -> Neon(BabyMeal) one-way sync.

Reads Aina's SSOT (SQLite + hyerim-rules.md markdown) and pushes the current
state into the BabyMeal Neon Postgres so the web app reflects what the user
told the Aina bot.

Scope:
  - fridge_stock : full-state sync from the cube-inventory markdown table
                   (source is the SSOT; Neon is reconciled to match exactly).
  - growth       : upsert-by-date from child_records (몸무게/키). Never deletes.
  - meal_plans   : from Aina meal_plans.ingredients_json (structured at author
                   time). Range-scoped full-state: within the min..max date that
                   Aina plans, Neon is reconciled to match (adds/edits/deletes
                   propagate); dates outside that range are left untouched so a
                   web-only meal far from Aina's schedule is never clobbered.
                   Requires the one-shot migrate_meals_to_aina.py to have run.

Design notes:
  - Idempotent: safe to run repeatedly; result depends only on current source state.
  - Cheap no-op: if source files are unchanged since last run, exits without
    opening a Neon connection (so a global Stop hook is inexpensive).
  - Best-effort: sync failure logs and exits 0 so it never blocks the bot.
"""

import argparse
import hashlib
import json
import os
import re
import sqlite3
import sys
from datetime import datetime, timezone

# ---------------------------------------------------------------- paths / config
AINA_ROOT = os.environ.get("AINA_ROOT", r"D:\aina")
AINA_DB = os.environ.get("AINA_DB", os.path.join(AINA_ROOT, "data", "aina.db"))
HYERIM_RULES = os.environ.get(
    "HYERIM_RULES", os.path.join(AINA_ROOT, "data", "memory", "hyerim-rules.md")
)
BABYMEAL_ENV = os.environ.get(
    "BABYMEAL_ENV", os.path.join(AINA_ROOT, "ina", "babymeal", ".env.local")
)
STATE_FILE = os.environ.get(
    "NEON_SYNC_STATE", os.path.join(AINA_ROOT, "data", ".neon-sync-state.json")
)
LOG_FILE = os.environ.get(
    "NEON_SYNC_LOG", os.path.join(AINA_ROOT, "data", "logs", "neon-sync.log")
)
FAMILY_DISCORD_ID = 1515258400131514491


def log(msg):
    ts = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    line = f"[{ts}] {msg}"
    print(line)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------- env / conn
def load_conn_string():
    """Resolve a Neon connection string, preferring a direct (unpooled) URL."""
    env = {}
    if os.path.exists(BABYMEAL_ENV):
        with open(BABYMEAL_ENV, "r", encoding="utf-8") as f:
            for raw in f:
                m = re.match(r'^([A-Z_][A-Z0-9_]*)="?([^"\r\n]*)"?$', raw.strip())
                if m:
                    env[m.group(1)] = m.group(2)
    for key in ("DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING", "DATABASE_URL",
                "POSTGRES_URL"):
        val = os.environ.get(key) or env.get(key)
        if val:
            if "sslmode=" not in val:
                val += ("&" if "?" in val else "?") + "sslmode=require"
            return val
    return None


# ---------------------------------------------------------------- change detection
def source_fingerprint():
    parts = []
    for path in (AINA_DB, HYERIM_RULES):
        try:
            st = os.stat(path)
            parts.append(f"{path}:{st.st_mtime_ns}:{st.st_size}")
        except OSError:
            parts.append(f"{path}:missing")
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(state):
    try:
        os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
    except OSError as e:
        log(f"WARN could not write state file: {e}")


# ---------------------------------------------------------------- parsers
def parse_fridge_markdown(path):
    """Extract cube inventory rows from the '현재 냉장고 큐브 재고' table."""
    if not os.path.exists(path):
        log(f"WARN hyerim-rules.md not found: {path}")
        return None
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    items, in_table = [], False
    for line in lines:
        if "냉장고 큐브 재고" in line:
            in_table = True
            continue
        if in_table:
            s = line.strip()
            if s.startswith("|"):
                cells = [c.strip() for c in s.strip("|").split("|")]
                if len(cells) < 4:
                    continue
                ingredient, size_raw, count_raw, made_raw = cells[:4]
                if ingredient in ("재료", "") or set(ingredient) <= {"-", ":"}:
                    continue  # header / separator row
                size_m = re.search(r"(\d+)", size_raw)
                count_m = re.search(r"(\d+)", count_raw)
                if not size_m or not count_m:
                    continue
                made = made_raw if re.match(r"\d{4}-\d{2}-\d{2}", made_raw) else None
                items.append({
                    "ingredient": ingredient,
                    "size": int(size_m.group(1)),
                    "count": int(count_m.group(1)),
                    "made_date": made,
                })
            elif s.startswith("#") or s.startswith("---"):
                break  # end of the table section
    return items


def read_growth_rows(db_path):
    """Group child_records 몸무게/키 by date -> {date: {weight, height}}."""
    con = sqlite3.connect(db_path)
    try:
        rows = con.execute(
            "SELECT record_type, value, recorded_at FROM child_records "
            "WHERE record_type IN ('몸무게','키')"
        ).fetchall()
    finally:
        con.close()
    by_date = {}
    for rtype, value, recorded_at in rows:
        date = str(recorded_at)[:10]
        try:
            num = float(value)
        except (TypeError, ValueError):
            continue
        entry = by_date.setdefault(date, {"weight": None, "height": None})
        if rtype == "몸무게":
            entry["weight"] = num
        elif rtype == "키":
            entry["height"] = num
    return by_date


# ---------------------------------------------------------------- sync ops
def sync_fridge(cur, items, dry):
    """Reconcile Neon fridge_stock to exactly match the markdown table."""
    changed = 0
    keep = set()
    for it in items:
        keep.add((it["ingredient"], it["size"]))
        if dry:
            continue
        cur.execute(
            """
            INSERT INTO fridge_stock (ingredient, size, count, made_date)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (ingredient, size)
            DO UPDATE SET count = EXCLUDED.count, made_date = EXCLUDED.made_date
            """,
            (it["ingredient"], it["size"], it["count"], it["made_date"]),
        )
        changed += 1
    # delete Neon rows not present in the source snapshot
    cur.execute("SELECT ingredient, size FROM fridge_stock")
    removed = 0
    for ingredient, size in cur.fetchall():
        if (ingredient, size) not in keep:
            removed += 1
            if not dry:
                cur.execute(
                    "DELETE FROM fridge_stock WHERE ingredient = %s AND size = %s",
                    (ingredient, size),
                )
    log(f"fridge: upserted {changed}, removed {removed} (source rows: {len(items)})")
    return changed + removed


def sync_growth(cur, by_date, dry):
    """Upsert growth_records by date (no deletes); refresh baby.weight to latest."""
    if not by_date:
        log("growth: no source rows")
        return 0
    changed = 0
    for date, e in sorted(by_date.items()):
        if e["weight"] is None and e["height"] is None:
            continue
        if dry:
            changed += 1
            continue
        cur.execute("SELECT id FROM growth_records WHERE date = %s", (date,))
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "UPDATE growth_records SET weight = COALESCE(%s, weight), "
                "height = COALESCE(%s, height) WHERE date = %s",
                (e["weight"], e["height"], date),
            )
        else:
            cur.execute(
                "INSERT INTO growth_records (date, weight, height) VALUES (%s, %s, %s)",
                (date, e["weight"] if e["weight"] is not None else 0, e["height"]),
            )
        changed += 1
    # baby.weight follows the newest growth record overall (across all sources),
    # so a stale source date can never roll the displayed weight backwards.
    if not dry:
        cur.execute(
            "UPDATE baby SET weight = gr.weight FROM ("
            "  SELECT weight FROM growth_records ORDER BY date DESC LIMIT 1"
            ") gr WHERE baby.id = 1"
        )
    log(f"growth: synced {changed} date(s)")
    return changed


MEALTYPE_TO_SLOT = {"오전": "morning", "아침": "morning", "저녁": "evening"}


def read_meal_rows(db_path):
    """Read structured meals from Aina -> {(date, slot): (ingredients, note)}."""
    con = sqlite3.connect(db_path)
    try:
        cols = [r[1] for r in con.execute("PRAGMA table_info(meal_plans)")]
        if "ingredients_json" not in cols:
            return None  # migration not run yet -> skip meals entirely
        rows = con.execute(
            "SELECT plan_date, meal_type, ingredients_json, description "
            "FROM meal_plans ORDER BY plan_date, meal_type, id"
        ).fetchall()
    finally:
        con.close()

    meals = {}
    for plan_date, meal_type, ingredients_json, description in rows:
        slot = MEALTYPE_TO_SLOT.get(meal_type)
        if not slot:
            continue
        if ingredients_json:
            try:
                ingredients = json.loads(ingredients_json)
            except ValueError:
                ingredients = [{"name": (description or "식단")[:40], "type": "etc"}]
        else:
            ingredients = [{"name": (description or "식단")[:40], "type": "etc"}]
        meals[(str(plan_date)[:10], slot)] = (ingredients, description)
    return meals


def sync_meal(cur, meals, dry):
    """Range-scoped full-state reconcile of Neon meal_plans from Aina."""
    if meals is None:
        log("meals: ingredients_json column absent (migration not run) — skipped")
        return 0
    if not meals:
        log("meals: no source rows — skipped (Neon left untouched)")
        return 0

    dates = [d for (d, _s) in meals]
    dmin, dmax = min(dates), max(dates)
    changed = 0
    for (date, slot), (ingredients, note) in sorted(meals.items()):
        if dry:
            changed += 1
            continue
        cur.execute(
            """
            INSERT INTO meal_plans (date, slot, ingredients, note)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (date, slot)
            DO UPDATE SET ingredients = EXCLUDED.ingredients, note = EXCLUDED.note
            """,
            (date, slot, json.dumps(ingredients, ensure_ascii=False), note),
        )
        changed += 1
    # delete Neon rows inside Aina's planning window that Aina no longer has
    cur.execute(
        "SELECT date::text, slot FROM meal_plans WHERE date BETWEEN %s AND %s",
        (dmin, dmax),
    )
    removed = 0
    for date, slot in cur.fetchall():
        if (date, slot) not in meals:
            removed += 1
            if not dry:
                cur.execute(
                    "DELETE FROM meal_plans WHERE date = %s AND slot = %s",
                    (date, slot),
                )
    log(f"meals: upserted {changed}, removed {removed} within {dmin}..{dmax}")
    return changed + removed


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="sync fridge + growth + meals")
    ap.add_argument("--fridge", action="store_true")
    ap.add_argument("--growth", action="store_true")
    ap.add_argument("--meals", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true",
                    help="ignore change-detection and sync anyway")
    args = ap.parse_args()

    explicit = args.fridge or args.growth or args.meals
    do_fridge = args.all or args.fridge or not explicit
    do_growth = args.all or args.growth or not explicit
    do_meals = args.all or args.meals or not explicit
    dry = args.dry_run

    # cheap no-op when nothing changed (keeps the global Stop hook inexpensive)
    fp = source_fingerprint()
    state = load_state()
    if not args.force and not dry and state.get("fingerprint") == fp:
        return 0  # silent: sources unchanged since last successful sync

    conn_str = load_conn_string()
    if not conn_str:
        log("SKIP no DATABASE_URL available (offline/env missing) — not blocking")
        return 0

    try:
        import psycopg2
    except ImportError:
        log("SKIP psycopg2 not installed — run: pip install psycopg2-binary")
        return 0

    total = 0
    try:
        conn = psycopg2.connect(conn_str, connect_timeout=10)
    except Exception as e:  # noqa: BLE001 - best effort, must not block bot
        log(f"SKIP could not connect to Neon: {e}")
        return 0

    try:
        with conn:
            with conn.cursor() as cur:
                if do_fridge:
                    items = parse_fridge_markdown(HYERIM_RULES)
                    if items is not None:
                        total += sync_fridge(cur, items, dry)
                if do_growth:
                    total += sync_growth(cur, read_growth_rows(AINA_DB), dry)
                if do_meals:
                    total += sync_meal(cur, read_meal_rows(AINA_DB), dry)
    except Exception as e:  # noqa: BLE001
        log(f"ERROR during sync (rolled back): {e}")
        conn.close()
        return 0
    conn.close()

    if not dry:
        state["fingerprint"] = fp
        state["last_synced_at"] = datetime.now(timezone.utc).astimezone().isoformat()
        save_state(state)
    log(f"sync complete ({'dry-run' if dry else 'applied'}), {total} change(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
