#!/usr/bin/env python3
"""Check existing database tables and their columns"""
from db import get_conn

conn = get_conn()
cur = conn.cursor()

# Get all tables
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema='public' 
    ORDER BY table_name
""")
tables = [r[0] for r in cur.fetchall()]

print("Tables in database:")
for table in tables:
    print(f"\n{table}:")
    cur.execute(f"""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = %s 
        ORDER BY ordinal_position
    """, (table,))
    for col, dtype in cur.fetchall():
        print(f"  - {col}: {dtype}")

conn.close()
