import requests
from create_and_upgrade_team import extract_profile_cookies

profile_path = "/home/dev/ChromeProfiles/hunggreen0001@maildrop.cc"
cookies = extract_profile_cookies(profile_path)
allowed_cookies = ["postman.sid", "_pm.store", "postman.sst", "postman.ssid"]
session = requests.Session()
for k, v in cookies.items():
    if k in allowed_cookies:
        session.cookies.set(k, v, domain=".postman.co")

domain = "interstellar-flare-9477016"
url = f"https://{domain}.postman.co/_api/ws/proxy"

session.headers.update({
    "User-Agent": "PostmanDesktop/12.26.5 (Linux x86_64)",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Referer": f"https://{domain}.postman.co/"
})

payload = {
    "service": "billing",
    "method": "get",
    "path": "/api/trials/bootstrap"
}
res = session.post(url, json=payload)
print(res.status_code, res.text)
