import sys
import os
import requests
import urllib.parse
sys.path.append(os.path.abspath("../03_B3_Team_And_Trial_API"))
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
session = requests.Session()
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")
        session.cookies.set(k, v, domain="app.getpostman.com")
        session.cookies.set(k, v, domain=".getpostman.com")
        session.cookies.set(k, v, domain="identity.getpostman.com")

session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

invite_code = "0f47e335759cecc2e3ab0357ca6b86ce" # let's test one
continue_url = urllib.parse.quote(f"https://app.getpostman.com/web-invite-accept?invite_code={invite_code}")

url = f"https://identity.getpostman.com/login?cta=join-team&invite_code={invite_code}&continue={continue_url}"
res = session.get(url, allow_redirects=False)
print("Status:", res.status_code)
print("Location:", res.headers.get("Location", ""))
print("Response text:", res.text[:200])

