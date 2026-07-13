import sqlite3, json, sys

DB = r"C:\Users\koko4\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# 1. List tables
c.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in c.fetchall()]
print("=== TABLES ===")
for t in tables:
    print(t)

# 2. Count sessions in last 30 days
c.execute("SELECT COUNT(*) FROM session")
print(f"\nTotal sessions: {c.fetchone()[0]}")

# 3. Recent sessions (last 30 days)
cutoff_ms = 1749456000000  # June 9, 2026 approx 30 days before July 9
c.execute("SELECT id, title, time_created FROM session ORDER BY time_created DESC LIMIT 20")
print("\n=== RECENT SESSIONS (last 20) ===")
for row in c.fetchall():
    print(f"  {row[0]} | {row[1][:80] if row[1] else 'N/A'} | ts={row[2]}")

# 4. Distill command: tool usage patterns in assistant messages (last 30 days)
print("\n=== TOOL USAGE PATTERNS (last 30 days) ===")
c.execute("""
    SELECT json_extract(p.data, '$.tool') as tool,
           substr(json_extract(p.data, '$.state.input'), 1, 200) as input_preview,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'tool'
      AND m.time_created > ?
    GROUP BY tool, input_preview
    ORDER BY n DESC
    LIMIT 50
""", (cutoff_ms,))
for row in c.fetchall():
    tool = row[0] or 'N/A'
    inp = (row[1] or 'N/A')[:120]
    n = row[2]
    print(f"  [{n}x] {tool} | {inp}")

# 5. Tool names only (aggregate)
print("\n=== TOOL NAMES AGGREGATE (last 30 days) ===")
c.execute("""
    SELECT json_extract(p.data, '$.tool') as tool,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'tool'
      AND m.time_created > ?
    GROUP BY tool
    ORDER BY n DESC
""", (cutoff_ms,))
for row in c.fetchall():
    print(f"  [{row[1]}x] {row[0]}")

# 6. User message keywords suggesting repetition
print("\n=== USER MESSAGES WITH REPETITION KEYWORDS ===")
c.execute("""
    SELECT m.id, substr(json_extract(m.data, '$.content'), 1, 300)
    FROM message m
    WHERE json_extract(m.data, '$.role') = 'user'
      AND m.time_created > ?
      AND (
        json_extract(m.data, '$.content') LIKE '%repeat%'
        OR json_extract(m.data, '$.content') LIKE '%again%'
        OR json_extract(m.data, '$.content') LIKE '%like last time%'
        OR json_extract(m.data, '$.content') LIKE '%same as%'
        OR json_extract(m.data, '$.content') LIKE '%the usual%'
        OR json_extract(m.data, '$.content') LIKE '%كل مرة%'
        OR json_extract(m.data, '$.content') LIKE '%مثل قبل%'
        OR json_extract(m.data, '$.content') LIKE '%نفس%'
        OR json_extract(m.data, '$.content') LIKE '%مره ثانيه%'
      )
    LIMIT 30
""", (cutoff_ms,))
for row in c.fetchall():
    print(f"  {row[0]}: {row[1][:250]}")

conn.close()
