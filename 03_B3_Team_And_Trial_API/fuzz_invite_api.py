import requests
from create_and_upgrade_team import extract_profile_cookies
import time

profile_path = "/home/dev/ChromeProfiles/hunggreen0002@maildrop.cc"
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

invite_code = "6653e86ccdac43f2a520227c0b6b4e6aaa56825343bd5b964cc19622754013a7"

endpoints = [
    f"/api/invitations/{invite_code}/accept",
    f"/api/multiuse-invitations/{invite_code}/accept",
    f"/api/teams/invitations/{invite_code}/accept",
    f"/api/user/invitations/{invite_code}/accept",
    f"/v1/invitations/{invite_code}/accept",
    f"/api/invites/{invite_code}/accept",
    f"/api/organizations/invitations/{invite_code}/accept"
]

services = ["god", "billing"]

for path in endpoints:
    for srv in services:
        payload = {
            "service": srv,
            "method": "POST",
            "path": path,
            "body": {}
        }
        res = session.post("https://go.postman.co/_api/ws/proxy", json=payload)
        print(f"[{srv}] POST {path} -> {res.status_code}")
        if res.status_code != 400 or "Resource not found" not in res.text:
            print(res.text[:200])
        time.sleep(1)

