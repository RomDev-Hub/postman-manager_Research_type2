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
    "x-entity-team-id": org_id,
    "Referer": f"https://{domain}.postman.co/"
})

url = f"https://{domain}.postman.co/_api/ws/proxy"
payload = {
    "path": "/v1/api/trial/journey/start/enterprise-7-days-trial",
    "method": "POST",
    "service": "trial"
}
res = session.post(url, json=payload)
print(res.status_code, res.text)
