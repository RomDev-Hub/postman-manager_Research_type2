import requests
import sqlite3
import shutil
import tempfile
import sys
import json
import os

def extract_profile_cookies(profile_path):
    # Try both paths
    db_path_1 = f"{profile_path}/Default/Network/Cookies"
    db_path_2 = f"{profile_path}/Default/Cookies"
    db_path = db_path_1 if os.path.exists(db_path_1) else db_path_2
    
    if not os.path.exists(db_path):
        return {}
        
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        shutil.copy2(db_path, tmp.name)
        tmp_db_path = tmp.name
    
    cookies = {}
    try:
        conn = sqlite3.connect(tmp_db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name, value FROM cookies WHERE host_key LIKE '%postman.co'")
        for name, value in cursor.fetchall():
            cookies[name] = value
        conn.close()
    finally:
        os.remove(tmp_db_path)
    return cookies

def get_teams(profile_path):
    cookies = extract_profile_cookies(profile_path)
    allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
    
    session = requests.Session()
    for k, v in cookies.items():
        if k in allowed_cookies:
            session.cookies.set(k, v, domain=".postman.co")
    
    session.headers.update({
        "User-Agent": "PostmanDesktop/12.26.5 (Linux x86_64)",
        "Content-Type": "application/json",
        "Accept": "application/json"
    })
    
    # 1. First get user details to get user_id
    user_payload = {
        "service": "god",
        "method": "GET",
        "path": "/api/users/me"
    }
    resp_user = session.post("https://go.postman.co/_api/ws/proxy", json=user_payload)
    if resp_user.status_code != 200:
        print("Failed to get user:", resp_user.status_code, resp_user.text)
        return
        
    user_id = resp_user.json().get("id")
    print("User ID:", user_id)
    
    # 2. Get organizations
    orgs_payload = {
        "service": "god",
        "method": "GET",
        "path": f"/api/users/{user_id}/organizations"
    }
    
    resp_orgs = session.post("https://go.postman.co/_api/ws/proxy", json=orgs_payload)
    print("Status:", resp_orgs.status_code)
    try:
        print("Body:", json.dumps(resp_orgs.json(), indent=2))
    except:
        print("Raw:", resp_orgs.text)

if __name__ == "__main__":
    get_teams("/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc")
