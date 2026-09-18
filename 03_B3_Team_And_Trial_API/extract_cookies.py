import sqlite3
import json

def get_cookies():
    conn = sqlite3.connect('/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc/Default/Cookies')
    cursor = conn.cursor()
    cursor.execute("SELECT name, value FROM cookies WHERE host_key LIKE '%postman%'")
    cookies = {}
    for row in cursor.fetchall():
        cookies[row[0]] = row[1]
    conn.close()
    return cookies

if __name__ == "__main__":
    cookies = get_cookies()
    print(f"postman.sid: {cookies.get('postman.sid')}")
    print(f"_pm.store: {cookies.get('_pm.store')}")
    
    with open('/home/dev/postman_cookies.json', 'w') as f:
        json.dump(cookies, f, indent=4)
