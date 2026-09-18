import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
session = requests.Session()
for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")

org_id = "42976683"
domain = "interstellar-flare-9477016"
url = f"https://{domain}.postman.co/_api/ws/proxy"

session.headers.update({
    "User-Agent": "PostmanDesktop/12.26.5 (Linux x86_64)",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-entity-team-id": org_id,
    "Referer": f"https://{domain}.postman.co/"
})

payload = {
    "path": f"/api/v1/billing/teams/{org_id}/trial",
    "method": "post",
    "service": "billing",
    "body": {
        "plan": "enterprise-7-days-extension-trial"
    }
}
res = session.post(url, json=payload)
print(res.status_code, res.text)
