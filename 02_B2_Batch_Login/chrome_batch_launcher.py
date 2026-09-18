#!/usr/bin/env python3
import os
import sys
import time
import json
import sqlite3
import hashlib
import subprocess
from typing import List

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import padding
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False

def detect_chrome_path():
    if sys.platform == "win32":
        paths = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
        ]
    elif sys.platform == "darwin":
        paths = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
    else:
        paths = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
    
    for p in paths:
        if os.path.exists(p):
            return p
    return paths[0] if paths else "google-chrome"

def encrypt_password_basic(password: str) -> bytes:
    if not password:
        return b""
    key = hashlib.pbkdf2_hmac("sha1", b"peanuts", b"saltysalt", 1, dklen=16)
    iv = b" " * 16
    if HAS_CRYPTOGRAPHY:
        padder = padding.PKCS7(128).padder()
        padded_data = padder.update(password.encode("utf-8")) + padder.finalize()
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        encryptor = cipher.encryptor()
        ciphertext = encryptor.update(padded_data) + encryptor.finalize()
        return b"v10" + ciphertext
    else:
        # Fallback using openssl if cryptography is not installed
        try:
            key_hex = key.hex()
            iv_hex = iv.hex()
            proc = subprocess.Popen(
                ["openssl", "enc", "-aes-128-cbc", "-K", key_hex, "-iv", iv_hex],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE
            )
            stdout, _ = proc.communicate(input=password.encode("utf-8"))
            return b"v10" + stdout
        except Exception:
            return b""

def prepopulate_login_data(profile_dir: str, email: str, password: str):
    def_dir = os.path.join(profile_dir, "Default")
    os.makedirs(def_dir, exist_ok=True)
    db_path = os.path.join(def_dir, "Login Data")
    
    enc_pass = encrypt_password_basic(password)
    chrome_epoch_microsec = int((time.time() + 11644473600) * 1000000)
    
    conn = sqlite3.connect(db_path, timeout=3.0)
    c = conn.cursor()
    c.execute('CREATE TABLE IF NOT EXISTS meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR)')
    c.execute('INSERT OR REPLACE INTO meta (key, value) VALUES ("version", "43"), ("last_compatible_version", "40")')
    
    c.execute('''CREATE TABLE IF NOT EXISTS logins (
        origin_url VARCHAR NOT NULL, action_url VARCHAR, username_element VARCHAR, username_value VARCHAR, 
        password_element VARCHAR, password_value BLOB, submit_element VARCHAR, signon_realm VARCHAR NOT NULL, 
        date_created INTEGER NOT NULL, blacklisted_by_user INTEGER NOT NULL, scheme INTEGER NOT NULL, 
        password_type INTEGER, times_used INTEGER, form_data BLOB, display_name VARCHAR, icon_url VARCHAR, 
        federation_url VARCHAR, skip_zero_click INTEGER, generation_upload_status INTEGER, possible_username_pairs BLOB, 
        id INTEGER PRIMARY KEY AUTOINCREMENT, date_last_used INTEGER NOT NULL DEFAULT 0, moving_blocked_for BLOB, 
        date_password_modified INTEGER NOT NULL DEFAULT 0, sender_email VARCHAR, sender_name VARCHAR, 
        date_received INTEGER, sharing_notification_displayed INTEGER NOT NULL DEFAULT 0, keychain_identifier BLOB, 
        sender_profile_image_url VARCHAR, date_last_filled INTEGER NOT NULL DEFAULT 0, actor_login_approved INTEGER NOT NULL DEFAULT 0, 
        UNIQUE (origin_url, username_element, username_value, password_element, signon_realm)
    )''')
    
    origins = [
        ("https://identity.getpostman.com/login", "https://identity.getpostman.com/"),
        ("https://identity.getpostman.com/enterprise/login/authchooser", "https://identity.getpostman.com/")
    ]
    
    for orig_url, signon_realm in origins:
        c.execute("DELETE FROM logins WHERE signon_realm = ? AND username_value = ?", (signon_realm, email))
        c.execute('''INSERT INTO logins (
            origin_url, action_url, username_element, username_value, password_element, 
            password_value, submit_element, signon_realm, date_created, blacklisted_by_user, 
            scheme, password_type, times_used, form_data, display_name, icon_url, federation_url, 
            skip_zero_click, generation_upload_status, possible_username_pairs, date_last_used, 
            moving_blocked_for, date_password_modified, sender_email, sender_name, date_received, 
            sharing_notification_displayed, keychain_identifier, sender_profile_image_url, date_last_filled, actor_login_approved
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''', (
            orig_url, orig_url, 'username', email, 'password', enc_pass, '', signon_realm, 
            chrome_epoch_microsec, 0, 0, 0, 1, b'', '', '', '', 0, 0, b'', chrome_epoch_microsec, 
            b'', chrome_epoch_microsec, '', '', 0, 0, b'', '', chrome_epoch_microsec, 0
        ))
    
    conn.commit()
    conn.close()

def init_preferences(profile_dir: str, profile_name: str):
    def_dir = os.path.join(profile_dir, "Default")
    os.makedirs(def_dir, exist_ok=True)
    pref_path = os.path.join(def_dir, "Preferences")
    
    pref_data = {
        "profile": {"name": profile_name, "password_manager_enabled": True},
        "credentials_enable_service": True,
        "credentials_enable_autosignin": True,
        "autofill": {"profile_enabled": True},
        "password_manager": {"enabled": True},
        "session": {"restore_on_startup": 5}  # 5 = open new tab
    }
    
    with open(pref_path, "w") as f:
        json.dump(pref_data, f, indent=2)

def fix_preferences_after_close(profile_dir: str):
    """Ghi đè lại Preferences để đảm bảo Chrome tin rằng nó đã đóng hợp lệ, ngăn popup Restore Tabs."""
    pref_path = os.path.join(profile_dir, "Default", "Preferences")
    if os.path.exists(pref_path):
        try:
            with open(pref_path, "r", encoding="utf-8") as f:
                pref_data = json.load(f)
                
            if "profile" not in pref_data: pref_data["profile"] = {}
            pref_data["profile"]["exit_type"] = "Normal"
            pref_data["profile"]["exited_cleanly"] = True
            
            with open(pref_path, "w", encoding="utf-8") as f:
                json.dump(pref_data, f, indent=2)
        except Exception as e:
            pass

def launch_batch(emails: List[str], password: str, profiles_base_dir: str, batch_size: int = 6):
    chrome_path = detect_chrome_path()
    print(f"Detected Chrome at: {chrome_path}")
    
    for i in range(0, len(emails), batch_size):
        batch = emails[i:i+batch_size]
        print(f"\n--- BATCH {i//batch_size + 1} ---")
        print(f"Preparing to launch {len(batch)} profiles: {', '.join(batch)}")
        
        processes = []
        for email in batch:
            profile_dir = os.path.join(profiles_base_dir, email)
            os.makedirs(profile_dir, exist_ok=True)
            
            # Setup database and preferences before launch
            prepopulate_login_data(profile_dir, email, password)
            init_preferences(profile_dir, email)
            
            # Launch Chrome
            cmd = [
                chrome_path,
                f"--user-data-dir={profile_dir}",
                "--no-first-run",
                "--no-default-browser-check",
                "--password-store=basic",
                "https://identity.getpostman.com/login"
            ]
            print(f"Launching profile for: {email}")
            proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            processes.append((email, profile_dir, proc))
            time.sleep(1) # stagger launches slightly
            
        print("\nAll profiles in this batch have been launched.")
        print("Please log in manually on the opened windows. The password should autofill.")
        input("Press ENTER when you have finished logging in. The script will GRACEFULLY CLOSE these windows...")
        
        # Gracefully terminate all processes in the current batch
        print("Closing windows gracefully...")
        for email, profile_dir, proc in processes:
            try:
                proc.terminate() # Send SIGTERM (or equivalent on Windows)
            except Exception:
                pass
        
        # Give Chrome a moment to write data and close
        time.sleep(3)
        
        # Force kill if still hanging, and fix preferences
        for email, profile_dir, proc in processes:
            try:
                if proc.poll() is None:
                    proc.kill()
            except Exception:
                pass
            fix_preferences_after_close(profile_dir)
            
        print(f"Batch {i//batch_size + 1} closed.")

if __name__ == "__main__":
    emails = [
        "hunggreen0001@maildrop.cc", "hunggreen0002@maildrop.cc", "hunggreen0003@maildrop.cc",
        "hunggreen0004@maildrop.cc", "hunggreen0005@maildrop.cc", "hunggreen0006@maildrop.cc",
        "hunggreen0007@maildrop.cc", "hunggreen0008@maildrop.cc", "hunggreen0009@maildrop.cc",
        "hunggreen0011@maildrop.cc", "hunggreen0012@maildrop.cc", "hunggreen0013@maildrop.cc",
        "hunggreen0016@maildrop.cc", "hunggreen0017@maildrop.cc", "hunggreen0019@maildrop.cc",
        "hunggreen0020@maildrop.cc", "hunggreen0021@maildrop.cc", "hunggreen0022@maildrop.cc",
        "hunggreen0023@maildrop.cc", "hunggreen0024@maildrop.cc", "hunggreen0025@maildrop.cc"
    ]
    
    password = "Pass@0909"
    
    # Store profiles in current directory under ChromeProfiles
    base_dir = os.path.join(os.path.abspath("."), "ChromeProfiles")
    
    print(f"Starting Chrome Batch Launcher.")
    print(f"Profiles will be saved in: {base_dir}")
    
    launch_batch(emails, password, base_dir, batch_size=6)
    
    print("\nAll batches completed! You can now use the ChromeProfiles directory for cookie extraction.")
