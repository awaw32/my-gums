import sqlite3, json

DB = r"C:\Users\koko4\.local\share\mimocode\mimocode.db"
conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
c = conn.cursor()

# Fix: handle None content
# 1. Main session user messages
print("=== USER MESSAGES from ses_0af132428ffeWPcw6A8tR9Bw4O (تحية, 101 msgs) ===")
c.execute("""
    SELECT json_extract(m.data, '$.content') as content
    FROM message m
    WHERE m.session_id = 'ses_0af132428ffeWPcw6A8tR9Bw4O'
      AND json_extract(m.data, '$.role') = 'user'
""")
for i, row in enumerate(c.fetchall()):
    content = row[0] or '(no content)'
    print(f"  [{i+1}] {content[:300]}")

# 2. Main session tool call sequence
print("\n=== TOOL CALLS from ses_0af132428ffeWPcw6A8tR9Bw4O ===")
c.execute("""
    SELECT json_extract(p.data, '$.tool') as tool,
           json_extract(p.data, '$.state.input') as inp
    FROM message m
    JOIN part p ON p.message_id = m.id
    WHERE m.session_id = 'ses_0af132428ffeWPcw6A8tR9Bw4O'
      AND json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'tool'
""")
for i, row in enumerate(c.fetchall()):
    tool = row[0]
    inp = row[1] or ''
    if tool == 'actor':
        try:
            data = json.loads(inp)
            op = json.loads(data.get('operation', '{}'))
            desc = op.get('description', 'N/A')
            stype = op.get('subagent_type', 'N/A')
            print(f"  [{i+1}] actor | type={stype} | desc={desc}")
        except:
            print(f"  [{i+1}] actor | {inp[:200]}")
    elif tool == 'bash':
        try:
            data = json.loads(inp)
            cmd = data.get('command', '')[:150]
            print(f"  [{i+1}] bash | {cmd}")
        except:
            print(f"  [{i+1}] bash | {inp[:200]}")
    elif tool in ('read', 'write', 'edit', 'glob', 'grep'):
        try:
            data = json.loads(inp)
            fp = data.get('file_path', data.get('pattern', '')) or ''
            fp = fp.replace('C:\\Users\\koko4\\OneDrive\\Apps\\my-gums-main\\\u200f\u200fmy-gums\u062a\u0637\u0648\u064a\u0631 - \u0646\u0633\u062e\u0629\\', '')
            print(f"  [{i+1}] {tool} | {fp[:120]}")
        except:
            print(f"  [{i+1}] {tool} | {inp[:200]}")
    else:
        print(f"  [{i+1}] {tool} | {inp[:200]}")

# 3. Deep research session user messages
print("\n=== MESSAGES from ses_0a4d42618ffeqZGjEmzpQk61IW (deep research) ===")
c.execute("""
    SELECT json_extract(m.data, '$.role') as role,
           json_extract(m.data, '$.content') as content
    FROM message m
    WHERE m.session_id = 'ses_0a4d42618ffeqZGjEmzpQk61IW'
""")
for i, row in enumerate(c.fetchall()):
    content = row[1] or '(no content)'
    print(f"  [{i+1}] {row[0]}: {content[:400]}")

# 4. Auto Dream session
print("\n=== MESSAGES from ses_0b12136e4ffeLcO7oCZSfduVVZ (Auto Dream, 24 msgs) ===")
c.execute("""
    SELECT json_extract(m.data, '$.role') as role,
           json_extract(m.data, '$.content') as content
    FROM message m
    WHERE m.session_id = 'ses_0b12136e4ffeLcO7oCZSfduVVZ'
""")
for i, row in enumerate(c.fetchall()):
    content = row[1] or '(no content)'
    print(f"  [{i+1}] {row[0]}: {content[:400]}")

conn.close()
