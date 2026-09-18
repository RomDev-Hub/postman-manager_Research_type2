import os
import sqlite3
import json
import traceback
import urllib.parse
import hashlib
import requests
try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import padding
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False

def decrypt_cookie_value(encrypted: bytes, password=b'peanuts', salt=b'saltysalt', iterations=1):
    if not encrypted or len(encrypted) <= 3: return ""
    if not encrypted.startswith(b"v10"):
        try: return encrypted.decode("utf-8", errors="ignore")
        except: return ""
    try:
        if HAS_CRYPTOGRAPHY:
            key = hashlib.pbkdf2_hmac("sha1", password, salt, iterations, dklen=16)
            iv = b" " * 16
            ciphertext = encrypted[3:]
            cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
            decryptor = cipher.decryptor()
            raw = decryptor.update(ciphertext) + decryptor.finalize()
            pad = raw[-1]
            unpadded = raw[:-pad] if pad <= 16 else raw
            if len(unpadded) > 32: return unpadded[32:].decode("utf-8", errors="ignore")
            return unpadded.decode("utf-8", errors="ignore")
    except Exception as e:
        pass
    return ""

def extract_profile_cookies(profile_path, domain=".postman.co"):
    cookies_path = os.path.join(profile_path, "Default", "Network", "Cookies")
    if not os.path.exists(cookies_path):
        cookies_path = os.path.join(profile_path, "Default", "Cookies")
    if not os.path.exists(cookies_path):
        print("Could not find Cookies db for", profile_path)
        return {}
    
    cookies = {}
    try:
        conn = sqlite3.connect(f"file:{cookies_path}?mode=ro", uri=True)
        cursor = conn.cursor()
        cursor.execute("SELECT name, encrypted_value FROM cookies WHERE host_key LIKE ?", (f"%{domain}%",))
        for name, encrypted_value in cursor.fetchall():
            decrypted = decrypt_cookie_value(encrypted_value)
            if decrypted:
                cookies[name] = decrypted
        conn.close()
    except Exception as e:
        traceback.print_exc()
    return cookies

def create_and_upgrade_team(profile_path, team_name, team_domain):
    print(f"\n--- Processing team {team_name} ({team_domain}) using {profile_path} ---")
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
    
    # 2. Create Team
    print(f"Creating team: {team_name}...")
    create_payload = {
        "path": "/api/organizations/add",
        "method": "POST",
        "service": "god",
        "body": {
            "name": team_name,
            "team_domain": team_domain,
            "preserve_personal_context": False
        }
    }
    
    res = session.post("https://go.postman.co/_api/ws/proxy", json=create_payload)
    if res.status_code != 200:
        print(f"Failed to create team. Status: {res.status_code}, Body: {res.text}")
        return None
        
    data = res.json()
    org_id = data.get("organization_id")
    invite_links = data.get("multiuse_invitations", [])
    link = invite_links[0].get("link") if invite_links else None
    
    print(f"Success! Organization ID: {org_id}")
    add_data = data
    print(f"DEBUG: add_data: {add_data}")
    invite_code = add_data.get("inviteCode")
    print(f"Invite Code: {invite_code} | Link: {link}")
    
    # 3. Upgrade to Enterprise Trial
    if org_id:
        print(f"Activating Enterprise Trial 7 days for Org {org_id}...")
        # Send the proxy payload through the proxy URL
        domain = data.get("organization_domain", "go") # Fallback to go if not provided, though it's usually returned
        trial_proxy_url = f"https://{domain}.postman.co/_api/ws/proxy"
        
        session.headers.update({
            "x-entity-team-id": org_id,
            "Referer": f"https://{domain}.postman.co/"
        })

        upgrade_payload = {
            "service": "trial",
            "method": "POST",
            "path": "/v1/api/start/trial/journey",
            "body": {
                "trialId": "enterprise-7-days-trial"
            }
        }
        trial_res = session.post(trial_proxy_url, json=upgrade_payload)
        if trial_res.status_code == 200:
            print("Enterprise Trial Activated Successfully!")
        else:
            print(f"Trial activation failed. Status: {trial_res.status_code}, Body: {trial_res.text}")
            
    return {
        "team_name": team_name,
        "org_id": org_id,
        "invite_link": link
    }

if __name__ == "__main__":
    import sys
    import os
    # For testing, we use hunggreen0001
    email = sys.argv[1] if len(sys.argv) > 1 else "hunggreen0001@maildrop.cc"
    profile = os.path.join("/home/dev/ChromeProfiles", email) if not email.startswith("/") else email
    # Example format: (Name, Domain)
    teams_to_create = [("VinFast 001", "vinfast-001"), ("VinFast 002", "vinfast-002")]
    results = []
    
    for team_name, team_domain in teams_to_create:
        res = create_and_upgrade_team(profile, team_name, team_domain)
        if res:
            results.append(res)
            
    # Save links
    with open("invite_links.txt", "w") as f:
        for r in results:
            f.write(f"Team: {r['team_name']} | Org ID: {r['org_id']} | Link: {r['invite_link']}\n")
    print("\nAll done! Links saved to invite_links.txt")
