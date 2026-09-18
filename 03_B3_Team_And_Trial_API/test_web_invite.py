import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
session = requests.Session()
for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")
        session.cookies.set(k, v, domain="app.getpostman.com")
        session.cookies.set(k, v, domain="identity.getpostman.com")

session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
})

invite_code = "6653e86ccdac43f2a520227c0b6b4e6aaa56825343bd5b964cc19622754013a7"

res = session.get(f"https://app.getpostman.com/web-invite-accept?invite_code={invite_code}", allow_redirects=False)
print("web-invite-accept GET:")
print(res.status_code, res.headers.get("Location", ""))
print(res.text[:300])

