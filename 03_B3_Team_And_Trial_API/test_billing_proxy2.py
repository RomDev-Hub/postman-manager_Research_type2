import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
session = requests.Session()
for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")

org_id = "42976683" # Using an older team ID to test
domain = "interstellar-flare-9477016"
url = f"https://{domain}.postman.co/_api/ws/proxy"

session.headers.update({
    "User-Agent": "PostmanDesktop/12.26.5 (Linux x86_64)",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "x-entity-team-id": org_id,
    "Referer": f"https://{domain}.postman.co/"
})

# Let's try multiple plans just in case
plans = ["enterprise-7-days-trial", "client_enterprise_7_days_trial", "client_pqa_extended_enterprise_trial_202406"]

for plan in plans:
    payload = {
        "path": f"/api/v1/billing/teams/{org_id}/trial",
        "method": "post",
        "service": "billing",
        "body": {
            "plan": plan
        }
    }
    res = session.post(url, json=payload)
    print(f"Plan: {plan} -> {res.status_code} {res.text}")
