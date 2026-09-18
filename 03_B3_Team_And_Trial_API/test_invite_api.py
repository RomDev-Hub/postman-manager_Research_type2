import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
session = requests.Session()
for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")

session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Content-Type": "application/json",
    "Accept": "application/json"
})

invite_code = "6653e86ccdac43f2a520227c0b6b4e6aaa56825343bd5b964cc19622754013a7"

print("Trying GET /api/invitations/...")
res = session.get(f"https://god.postman.co/api/invitations/{invite_code}")
print(res.status_code, res.text[:200])

print("\nTrying POST /api/invitations/accept...")
res = session.post(f"https://god.postman.co/api/invitations/{invite_code}/accept")
print(res.status_code, res.text[:200])

print("\nTrying POST _api/ws/proxy...")
payload = {
    "service": "god",
    "method": "POST",
    "path": f"/api/invitations/{invite_code}/accept"
}
res = session.post("https://go.postman.co/_api/ws/proxy", json=payload)
print(res.status_code, res.text[:200])

