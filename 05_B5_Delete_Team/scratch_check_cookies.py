import sqlite3
import tempfile
import shutil
db_path = "/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc/Default/Cookies"
with tempfile.NamedTemporaryFile(delete=False) as tmp:
    shutil.copy2(db_path, tmp.name)
    tmp_db_path = tmp.name
conn = sqlite3.connect(tmp_db_path)
cursor = conn.cursor()
cursor.execute("SELECT name, value, length(encrypted_value) FROM cookies WHERE host_key LIKE '%postman.co'")
print(cursor.fetchall())
conn.close()
