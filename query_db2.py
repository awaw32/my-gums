import sqlite3, json

DB = r"C:\Users\koko4\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# 1. Detailed session info with message counts
print("=== SESSION DETAILS (with message counts) ===")
c.execute("""
    SELECT s.id, s.title, s.time_created,
           (SELECT COUNT(*) FROM message m WHERE m.session_id = s.id) as msg_count
    FROM session s
    ORDER BY s.time_created DESC
""")
for row in c.fetchall():
    print(f"  {row[0][:40]}... | msgs={row[3]} | {row[1][:80] if row[1] else 'N/A'} | ts={row[2]}")

# 2. Look at subagent (actor) calls - what patterns were used
print("\n=== SUBAGENT CALLS (explore patterns) ===")
c.execute("""
    SELECT json_extract(p.data, '$.state.input') as input_data
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'actor'
""")
for row in c.fetchall():
    try:
        data = json.loads(row[0])
        op = json.loads(data.get('operation', '{}'))
        desc = op.get('description', 'N/A')
        stype = op.get('subagent_type', 'N/A')
        prompt = op.get('prompt', '')[:150]
        print(f"  type={stype} | desc={desc} | prompt={prompt}...")
    except:
        print(f"  raw={row[0][:200]}")

# 3. Check for repeated edit patterns on same files
print("\n=== EDITED FILES (frequency) ===")
c.execute("""
    SELECT json_extract(json_extract(p.data, '$.state.input'), '$.file_path') as fp,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'edit'
    GROUP BY fp
    ORDER BY n DESC
""")
for row in c.fetchall():
    fp = row[0] or 'N/A'
    # shorten path
    fp = fp.replace('C:\\Users\\koko4\\OneDrive\\Apps\\my-gums-main\\‏‏my-gumsتطوير - نسخة\\', '')
    print(f"  [{row[1]}x] {fp}")

# 4. Check for repeated bash commands
print("\n=== BASH COMMANDS (frequency) ===")
c.execute("""
    SELECT json_extract(json_extract(p.data, '$.state.input'), '$.command') as cmd,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'bash'
    GROUP BY cmd
    ORDER BY n DESC
    LIMIT 30
""")
for row in c.fetchall():
    cmd = (row[0] or 'N/A')[:150]
    print(f"  [{row[1]}x] {cmd}")

# 5. Check tasks
print("\n=== TASKS ===")
c.execute("SELECT id, title, status, created_at FROM task ORDER BY created_at DESC LIMIT 20")
for row in c.fetchall():
    print(f"  {row[0][:40]}... | {row[1][:60] if row[1] else 'N/A'} | status={row[2]} | ts={row[3]}")

# 6. Check actor_registry for subagent types
print("\n=== ACTOR REGISTRY ===")
c.execute("SELECT * FROM actor_registry LIMIT 20")
for row in c.fetchall():
    print(f"  {dict(row)}")

conn.close()
