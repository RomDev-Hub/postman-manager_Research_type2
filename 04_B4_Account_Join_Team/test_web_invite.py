import sys
import os
sys.path.append(os.path.abspath("../03_B3_Team_And_Trial_API"))
import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
session = requests.Session()
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid", "postman-workspace-id", "postman.auth_cookie"]

for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")
        session.cookies.set(k, v, domain="app.getpostman.com")
        session.cookies.set(k, v, domain="identity.getpostman.com")

session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
})

invite_code = "86785a55cabfdc59ed293a8f48d257ff737db0f326dcf60a3e5486f7a24f4662"
url = f"https://app.getpostman.com/web-invite-accept?invite_code={invite_code}"

print(f"GET {url}")
res = session.get(url, allow_redirects=False)
print(f"Status: {res.status_code}")
if res.status_code in [301, 302, 307, 308]:
    print(f"Redirects to: {res.headers.get('Location')}")
print("Cookies received:", res.cookies.get_dict())
