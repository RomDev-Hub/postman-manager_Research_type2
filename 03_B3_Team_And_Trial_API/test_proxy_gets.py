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

def check_proxy(path, service="god"):
    payload = {
        "path": path,
        "method": "GET",
        "service": service
    }
    res = session.post("https://go.postman.co/_api/ws/proxy", json=payload)
    print(f"[{service}] GET {path} -> {res.status_code}")
    print(res.text[:300])

org_id = "42977088"
check_proxy(f"/api/organizations/{org_id}")
check_proxy(f"/api/organizations")
check_proxy(f"/api/accounts")
check_proxy(f"/api/users/me")
check_proxy(f"/api/workspaces")
check_proxy(f"/api/teams")
