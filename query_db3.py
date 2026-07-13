import sqlite3, json

DB = r"C:\Users\koko4\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# 1. Task schema
c.execute("PRAGMA table_info(task)")
print("=== TASK TABLE SCHEMA ===")
for row in c.fetchall():
    print(f"  {row}")

c.execute("SELECT * FROM task ORDER BY rowid DESC LIMIT 20")
print("\n=== TASKS ===")
for row in c.fetchall():
    d = dict(row)
    print(f"  {d}")

# 2. Main substantive sessions: the greeting (101 msgs), dream (24 msgs), deep research
# Get user messages from the big session ses_0af132428ffeWPcw6A8tR9Bw4O (تحية = greeting, 101 msgs)
print("\n=== USER MESSAGES from ses_0af132428ffeWPcw6A8tR9Bw4O (101 msgs) ===")
c.execute("""
    SELECT substr(json_extract(m.data, '$.content'), 1, 300)
    FROM message m
    WHERE m.session_id = 'ses_0af132428ffeWPcw6A8tR9Bw4O'
      AND json_extract(m.data, '$.role') = 'user'
    LIMIT 30
""")
for i, row in enumerate(c.fetchall()):
    print(f"  [{i+1}] {row[0][:250]}")

# 3. User messages from Auto Dream session
print("\n=== USER MESSAGES from ses_0b12136e4ffeLcO7oCZSfduVVZ (Auto Dream) ===")
c.execute("""
    SELECT substr(json_extract(m.data, '$.content'), 1, 300)
    FROM message m
    WHERE m.session_id = 'ses_0b12136e4ffeLcO7oCZSfduVVZ'
      AND json_extract(m.data, '$.role') = 'user'
""")
for i, row in enumerate(c.fetchall()):
    print(f"  [{i+1}] {row[0][:250]}")

# 4. Check what the subagent explore calls did in ses_0af132428ffeWPcw6A8tR9Bw4O
print("\n=== ASSISTANT TOOL CALLS from ses_0af132428ffeWPcw6A8tR9Bw4O (main work) ===")
c.execute("""
    SELECT json_extract(p.data, '$.tool') as tool,
           substr(json_extract(p.data, '$.state.input'), 1, 250) as inp
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = 'ses_0af132428ffeWPcw6A8tR9Bw4O'
      AND json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'tool'
""")
for i, row in enumerate(c.fetchall()):
    print(f"  [{i+1}] {row[0]} | {row[1][:200]}")

# 5. Also check the deep research session
print("\n=== SESSION: deep research ses_0a4d42618ffeqZGjEmzpQk61IW ===")
c.execute("""
    SELECT json_extract(m.data, '$.role') as role,
           substr(json_extract(m.data, '$.content'), 1, 400) as content
    FROM message m
    WHERE m.session_id = 'ses_0a4d42618ffeqZGjEmzpQk61IW'
""")
for i, row in enumerate(c.fetchall()):
    print(f"  [{i+1}] {row[0]}: {row[1][:300]}")

# 6. Check what workflow_run records exist
print("\n=== WORKFLOW RUNS ===")
c.execute("SELECT * FROM workflow_run LIMIT 10")
cols = [d[0] for d in c.description]
for row in c.fetchall():
    print(f"  {dict(zip(cols, row))}")

conn.close()
