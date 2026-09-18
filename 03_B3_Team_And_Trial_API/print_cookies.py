import sqlite3
import os

profile_path = "/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc"
cookie_db = os.path.join(profile_path, "Default", "Cookies")
if not os.path.exists(cookie_db):
    print("No cookie db")
else:
    conn = sqlite3.connect(cookie_db)
    c = conn.cursor()
    c.execute("SELECT host_key, name, value, encrypted_value FROM cookies WHERE host_key LIKE '%postman%'")
    for row in c.fetchall():
        print(f"HOST: {row[0]}, NAME: {row[1]}, HAS_VAL: {bool(row[2])}, HAS_ENC: {bool(row[3])}")
