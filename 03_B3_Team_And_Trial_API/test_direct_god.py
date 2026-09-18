import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
session = requests.Session()
for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")

org_id = "42977088"
domain = "gold-sunset-847124"

session.headers.update({
    "User-Agent": "PostmanDesktop/12.26.5 (Linux x86_64)",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Origin": f"https://{domain}.postman.co",
    "Referer": f"https://{domain}.postman.co/"
})

payload = {
    "tier": "enterprise_202603",
    "trial_type": "client_enterprise_7_days_trial"
}
res = session.post(f"https://god.postman.co/api/organizations/{org_id}/limited-duration-trial", json=payload)
print(res.status_code, res.text)
