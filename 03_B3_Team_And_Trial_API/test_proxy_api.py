import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc"
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

payload = {
    "service": "god",
    "method": "GET",
    "path": "/api/users/me"
}
res = session.post("https://go.postman.co/_api/ws/proxy", json=payload)
print("Users me:", res.status_code, res.text[:500])

payload = {
    "service": "god",
    "method": "GET",
    "path": "/api/me"
}
res = session.post("https://go.postman.co/_api/ws/proxy", json=payload)
print("Me:", res.status_code, res.text[:500])
