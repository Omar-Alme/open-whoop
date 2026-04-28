"""
Phase 6 — Data Storage
Parses raw JSONL logs and stores structured data in SQLite.
Also provides CSV/JSON export.

Run: python store.py import data/raw_logs/20260427_123456.jsonl
     python store.py export-csv
     python store.py export-json
     python store.py stats
"""

import csv
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DB_PATH = Path("data/whoop.db")


def get_db() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS heart_rate (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            bpm INTEGER NOT NULL,
            rr_ms TEXT,
            raw_hex TEXT
        );

        CREATE TABLE IF NOT EXISTS raw_packets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            source TEXT NOT NULL,
            cmd TEXT,
            valid INTEGER,
            length INTEGER,
            raw_hex TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            log_file TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            hr_count INTEGER DEFAULT 0,
            packet_count INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_hr_ts ON heart_rate(ts);
        CREATE INDEX IF NOT EXISTS idx_raw_ts ON raw_packets(ts);
    """)
    return conn


def import_log(log_path: str):
    path = Path(log_path)
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    conn = get_db()
    hr_count = 0
    pkt_count = 0

    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            ts = entry.get("ts", "")
            entry_type = entry.get("type", "")

            if entry_type == "hr":
                conn.execute(
                    "INSERT INTO heart_rate (ts, bpm, rr_ms, raw_hex) VALUES (?, ?, ?, ?)",
                    (ts, entry["bpm"], json.dumps(entry.get("rr_ms", [])), entry.get("raw", "")),
                )
                hr_count += 1

            elif entry_type in ("cmd_response", "event", "data", "memfault", "hr_raw"):
                conn.execute(
                    "INSERT INTO raw_packets (ts, source, cmd, valid, length, raw_hex) VALUES (?, ?, ?, ?, ?, ?)",
                    (ts, entry_type, entry.get("cmd", ""), entry.get("valid"), entry.get("length"), entry.get("raw", "")),
                )
                pkt_count += 1

    conn.execute(
        "INSERT INTO sessions (log_file, imported_at, hr_count, packet_count) VALUES (?, ?, ?, ?)",
        (str(path), datetime.now().isoformat(), hr_count, pkt_count),
    )
    conn.commit()
    conn.close()

    print(f"Imported {log_path}")
    print(f"  Heart rate readings: {hr_count}")
    print(f"  Raw packets: {pkt_count}")


def export_csv():
    conn = get_db()
    rows = conn.execute("SELECT ts, bpm, rr_ms FROM heart_rate ORDER BY ts").fetchall()
    conn.close()

    out = Path("data/sessions/heart_rate.csv")
    out.parent.mkdir(exist_ok=True)

    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "bpm", "rr_intervals_ms"])
        for ts, bpm, rr in rows:
            w.writerow([ts, bpm, rr])

    print(f"Exported {len(rows)} HR readings to {out}")


def export_json():
    conn = get_db()
    rows = conn.execute("SELECT ts, bpm, rr_ms FROM heart_rate ORDER BY ts").fetchall()
    conn.close()

    data = [{"ts": ts, "bpm": bpm, "rr_ms": json.loads(rr)} for ts, bpm, rr in rows]
    out = Path("data/sessions/heart_rate.json")
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(data, indent=2))

    print(f"Exported {len(data)} HR readings to {out}")


def stats():
    conn = get_db()

    hr_count = conn.execute("SELECT COUNT(*) FROM heart_rate").fetchone()[0]
    pkt_count = conn.execute("SELECT COUNT(*) FROM raw_packets").fetchone()[0]
    session_count = conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]

    print(f"Database: {DB_PATH}")
    print(f"  Sessions imported: {session_count}")
    print(f"  Heart rate readings: {hr_count}")
    print(f"  Raw packets: {pkt_count}")

    if hr_count > 0:
        row = conn.execute("SELECT MIN(bpm), AVG(bpm), MAX(bpm) FROM heart_rate").fetchone()
        print(f"  HR range: {row[0]}-{row[2]} bpm (avg {row[1]:.0f})")
        row = conn.execute("SELECT MIN(ts), MAX(ts) FROM heart_rate").fetchone()
        print(f"  Time range: {row[0]} to {row[1]}")

    conn.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python store.py import <logfile.jsonl>")
        print("  python store.py export-csv")
        print("  python store.py export-json")
        print("  python store.py stats")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "import" and len(sys.argv) >= 3:
        import_log(sys.argv[2])
    elif cmd == "export-csv":
        export_csv()
    elif cmd == "export-json":
        export_json()
    elif cmd == "stats":
        stats()
    else:
        print(f"Unknown command: {cmd}")
