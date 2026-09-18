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

org_id = "42977091"

print("Trying /api/organizations/{org_id}/trial ...")
payload = {
    "path": f"/api/organizations/{org_id}/trial",
    "method": "POST",
    "service": "billing",
    "body": {
        "trial_type": "client_enterprise_7_days_trial"
    }
}
res = session.post("https://go.postman.co/_api/ws/proxy", json=payload)
print(res.status_code, res.text)

print("\nTrying /api/accounts/{org_id}/limited-duration-trial with billing service ...")
payload = {
    "path": f"/api/accounts/{org_id}/limited-duration-trial",
    "method": "POST",
    "service": "billing",
    "body": {
        "tier": "enterprise_202603",
        "trial_type": "client_enterprise_7_days_trial"
    }
}
res = session.post("https://go.postman.co/_api/ws/proxy", json=payload)
print(res.status_code, res.text)

print("\nTrying /api/organizations/{org_id}/limited-duration-trial with god service ...")
payload = {
    "path": f"/api/organizations/{org_id}/limited-duration-trial",
    "method": "POST",
    "service": "god",
    "body": {
        "tier": "enterprise_202603",
        "trial_type": "client_enterprise_7_days_trial"
    }
}
res = session.post("https://go.postman.co/_api/ws/proxy", json=payload)
print(res.status_code, res.text)

