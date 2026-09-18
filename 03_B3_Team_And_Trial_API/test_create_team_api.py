import os
import sys
import json
import sqlite3
import hashlib
import requests
import subprocess
try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import padding
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False

def decrypt_cookie_linux(encrypted: bytes) -> str:
    if not encrypted or len(encrypted) <= 3: return ""
    if not encrypted.startswith(b"v10"):
        try: return encrypted.decode("utf-8", errors="ignore")
        except: return ""
    key = hashlib.pbkdf2_hmac("sha1", b"peanuts", b"saltysalt", 1, dklen=16)
    iv = b" " * 16
    ciphertext = encrypted[3:]
    if HAS_CRYPTOGRAPHY:
        try:
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
            decryptor = cipher.decryptor()
            raw = decryptor.update(ciphertext) + decryptor.finalize()
            pad = raw[-1]
            unpadded = raw[:-pad] if pad <= 16 else raw
            if len(unpadded) > 32: return unpadded[32:].decode("utf-8", errors="ignore")
            return unpadded.decode("utf-8", errors="ignore")
        except: return ""
    return ""

def extract_profile_cookies(profile_path: str) -> dict:
    cookie_db = os.path.join(profile_path, "Default", "Cookies")
    if not os.path.exists(cookie_db): return {}
    cookies = {}
    try:
        conn = sqlite3.connect(cookie_db, timeout=1.5)
        c = conn.cursor()
        c.execute("SELECT host_key, name, value, encrypted_value FROM cookies WHERE host_key LIKE '%postman%'")
        rows = c.fetchall()
        conn.close()
        for host, name, val, enc in rows:
            if val: cookies[name] = val
            elif enc:
                dec = decrypt_cookie_linux(enc)
                if dec: cookies[name] = dec
    except: pass
    return cookies

def create_team(profile_path: str, domain: str = "god.postman.co"):
    cookies = extract_profile_cookies(profile_path)
    if not cookies:
        print("No cookies found!")
        return

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "Content-Type": "application/json"
    })
    
    allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid", "getpostman-user"]
    for k, v in cookies.items():
        if k in allowed_cookies:
            session.cookies.set(k, v, domain=".postman.co")
            session.cookies.set(k, v, domain=".getpostman.com")
            session.cookies.set(k, v, domain="identity.getpostman.com")
            session.cookies.set(k, v, domain="app.getpostman.com")

    import urllib.parse
    print("Fetching orgs...")
    user_id = ""
    if "getpostman-user" in cookies:
        try:
            raw_val = urllib.parse.unquote(cookies["getpostman-user"])
            store_data = json.loads(raw_val)
            user_id = store_data.get("id", "")
        except Exception as e:
            print("Error parsing getpostman-user:", e)
    
    if user_id:
        res = session.get(f"https://god.postman.co/api/users/{user_id}/organizations")
        print("Orgs:", res.status_code)
        try:
            data = res.json()
            for org in data.get("organizations", []):
                print(f"Team: {org.get('name')}, Domain: {org.get('domain')}, Plan: {org.get('plan')}")
        except:
            print("Could not parse orgs:", res.text)
    else:
        print("Could not find user_id in getpostman-user cookie")

if __name__ == "__main__":
    create_team("/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc", "go.postman.co")
